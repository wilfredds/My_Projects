-- ============================================================================
--  RLS policy tests — spec §9, "Test the roles before you demo"
-- ============================================================================
--  Reading a policy and believing it is not testing it. The interesting bugs
--  are the ones where the SQL is perfectly valid and the answer is wrong: a
--  `using` clause that lets crew un-cancel a booking, a view that quietly
--  bypasses the base table's policies. Those only show up when you ask the
--  database, as each role, and check what comes back.
--
--  HOW TO RUN
--
--    Locally (recommended — it is destructive):
--      createdb hiroshi_test
--      psql -d hiroshi_test -f supabase/local/00-supabase-shim.sql
--      psql -d hiroshi_test -f supabase/schema.sql
--      psql -d hiroshi_test -f supabase/verify-rls.sql
--
--    Or use the runner, which does all four steps:
--      npm run db:test
--
--  Do NOT run this against a Supabase project holding real bookings — it
--  inserts test staff and reservations.
--
--  HOW IT WORKS
--
--  `set role authenticated` drops us to the same low-privilege role a real
--  browser session uses, and `request.jwt.claims` supplies the user id that
--  `auth.uid()` reads. From RLS's point of view this is indistinguishable from
--  a real logged-in request — which is the whole point.
-- ============================================================================

\set ON_ERROR_STOP on
\set QUIET on
\pset pager off

create schema if not exists test;

create table if not exists test.results (
  id bigint generated always as identity primary key,
  name text not null,
  passed boolean not null,
  detail text
);
truncate test.results;

-- Records an outcome. security definer so it can write the results table no
-- matter which low-privilege role the test is currently impersonating.
create or replace function test.record(name text, passed boolean, detail text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into test.results (name, passed, detail) values (name, passed, detail);
end;
$$;

-- Runs a statement AS THE CURRENT ROLE and reports what happened, as either
-- 'rows=N' or 'error:SQLSTATE'. Deliberately NOT security definer: it has to
-- run with the caller's privileges or it would test nothing at all.
--
-- The distinction it captures is worth knowing. When a policy's `using` clause
-- excludes a row, the row is simply invisible and you get rows=0 — no error.
-- When a `with check` clause rejects a row you are writing, that IS an error
-- (42501). So "silently did nothing" and "loudly refused" are both correct
-- outcomes depending on which half of the policy did the work.
create or replace function test.run(stmt text)
returns text
language plpgsql
as $$
declare
  n bigint;
begin
  execute stmt;
  get diagnostics n = row_count;
  return 'rows=' || n;
exception when others then
  return 'error:' || sqlstate;
end;
$$;

grant usage on schema test to anon, authenticated;
grant execute on function test.record(text, boolean, text) to anon, authenticated;
grant execute on function test.run(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
--  Seed. Run as superuser, which bypasses RLS — this is the setup, not a test.
-- ---------------------------------------------------------------------------
delete from public.reservation_events;
delete from public.reservations;
delete from public.profiles;
delete from auth.users;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'crew@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'host@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'owner@example.com'),
  -- A real auth account with NO profile row: the "signed up but is not staff"
  -- case. This is the one people forget.
  ('44444444-4444-4444-4444-444444444444', 'random@example.com');

insert into public.profiles (id, full_name, role) values
  ('11111111-1111-1111-1111-111111111111', 'Cha the crew', 'crew'),
  ('22222222-2222-2222-2222-222222222222', 'Kuya the host', 'host'),
  ('33333333-3333-3333-3333-333333333333', 'The owner', 'owner');

insert into public.reservations (id, name, contact, reserve_date, reserve_time, party_size, package, status) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Ana Reyes',  '0917 123 4567', current_date,     '18:00', 4, 'master',  'pending'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Ben Cruz',   '0918 222 3333', current_date,     '19:30', 2, 'classic', 'confirmed'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Carla Lim',  '0999 888 7777', current_date + 1, '12:00', 8, 'premium', 'cancelled');

\echo ''
\echo '=========================================================='
\echo ' Hiroshi RLS policy tests'
\echo '=========================================================='

-- ===========================================================================
--  ANON — the public, logged out
-- ===========================================================================
set role anon;
-- What Supabase actually sends for a logged-out request: a claims object with
-- a role and no `sub`, so auth.uid() comes back NULL.
set request.jwt.claims = '{"role":"anon"}';

select test.record(
  'anon: may file a pending reservation request',
  test.run($q$insert into public.reservations (name, contact, reserve_date, reserve_time, party_size)
             values ('Walk In', '0900 000 0000', current_date, '20:00', 2)$q$) = 'rows=1');

-- ✱1 The spec's original `with check (true)` would have allowed this, walking a
-- self-confirmed booking straight past the host.
select test.record(
  'anon: CANNOT self-confirm a booking on insert',
  test.run($q$insert into public.reservations (name, contact, reserve_date, reserve_time, party_size, status)
             values ('Sneaky', '0900 000 0001', current_date, '20:00', 2, 'confirmed')$q$) like 'error:%',
  test.run($q$insert into public.reservations (name, contact, reserve_date, reserve_time, party_size, status)
             values ('Sneaky', '0900 000 0002', current_date, '20:00', 2, 'confirmed')$q$));

-- The headline claim from the spec: open dev tools, use the public key, and the
-- database still says no.
select test.record(
  'anon: CANNOT read reservations',
  test.run($q$select * from public.reservations$q$) in ('rows=0', 'error:42501'),
  test.run($q$select * from public.reservations$q$));

select test.record(
  'anon: CANNOT read profiles',
  test.run($q$select * from public.profiles$q$) in ('rows=0', 'error:42501'));

select test.record(
  'anon: CANNOT read the masked staff view either',
  test.run($q$select * from public.staff_reservations$q$) in ('rows=0', 'error:42501'));

reset role;

-- ===========================================================================
--  LOGGED IN, BUT NOT STAFF — an auth account with no profile row
-- ===========================================================================
set role authenticated;
set request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444"}';

select test.record(
  'non-staff login: CANNOT read reservations',
  test.run($q$select * from public.reservations$q$) = 'rows=0',
  test.run($q$select * from public.reservations$q$));

select test.record(
  'non-staff login: staff_role() is null',
  public.staff_role() is null);

reset role;

-- ===========================================================================
--  CREW — sees the list, moves bookings forward, nothing else
-- ===========================================================================
set role authenticated;
set request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';

select test.record(
  'crew: reads the reservation list',
  (select count(*) from public.reservations) > 0);

select test.record(
  'crew: sees contact numbers MASKED in the staff view',
  (select bool_and(contact like '••••%') from public.staff_reservations),
  (select string_agg(distinct contact, ', ') from public.staff_reservations));

select test.record(
  'crew: staff view reports contact_visible = false',
  (select bool_and(contact_visible = false) from public.staff_reservations));

select test.record(
  'crew: can confirm a pending booking',
  test.run($q$update public.reservations set status = 'confirmed'
             where id = 'aaaaaaaa-0000-0000-0000-000000000001'$q$) = 'rows=1');

select test.record(
  'crew: can seat a confirmed booking',
  test.run($q$update public.reservations set status = 'seated'
             where id = 'aaaaaaaa-0000-0000-0000-000000000002'$q$) = 'rows=1');

-- ✱2 The cancel button is not merely hidden from crew in the UI.
select test.record(
  'crew: CANNOT cancel a booking',
  test.run($q$update public.reservations set status = 'cancelled'
             where id = 'aaaaaaaa-0000-0000-0000-000000000001'$q$) like 'error:%',
  test.run($q$update public.reservations set status = 'cancelled'
             where id = 'aaaaaaaa-0000-0000-0000-000000000001'$q$));

select test.record(
  'crew: CANNOT resurrect a cancelled booking',
  test.run($q$update public.reservations set status = 'confirmed'
             where id = 'aaaaaaaa-0000-0000-0000-000000000003'$q$) = 'rows=0');

-- The column half of the rule: confirming is allowed, editing is not.
select test.record(
  'crew: CANNOT rewrite a guest phone number while confirming',
  test.run($q$update public.reservations set status = 'confirmed', contact = '0900 000 9999'
             where id = 'aaaaaaaa-0000-0000-0000-000000000001'$q$) = 'error:42501');

select test.record(
  'crew: CANNOT edit the party size',
  test.run($q$update public.reservations set party_size = 30
             where id = 'aaaaaaaa-0000-0000-0000-000000000001'$q$) like 'error:%');

select test.record(
  'crew: CANNOT delete a booking',
  test.run($q$delete from public.reservations
             where id = 'aaaaaaaa-0000-0000-0000-000000000001'$q$) = 'rows=0');

select test.record(
  'crew: CANNOT read the audit trail',
  test.run($q$select * from public.reservation_events$q$) = 'rows=0');

select test.record(
  'crew: CANNOT read another staff member''s profile',
  (select count(*) from public.profiles) = 1);

reset role;

-- ===========================================================================
--  HOST — everything crew can, plus contacts, cancelling and editing
-- ===========================================================================
set role authenticated;
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222"}';

select test.record(
  'host: sees FULL contact numbers',
  (select bool_and(contact not like '••••%') from public.staff_reservations),
  (select string_agg(distinct contact, ', ') from public.staff_reservations));

select test.record(
  'host: staff view reports contact_visible = true',
  (select bool_and(contact_visible) from public.staff_reservations));

select test.record(
  'host: can cancel a booking',
  test.run($q$update public.reservations set status = 'cancelled'
             where id = 'aaaaaaaa-0000-0000-0000-000000000002'$q$) = 'rows=1');

select test.record(
  'host: can edit a booking''s details',
  test.run($q$update public.reservations set notes = 'moved to the corner table'
             where id = 'aaaaaaaa-0000-0000-0000-000000000001'$q$) = 'rows=1');

select test.record(
  'host: can read the audit trail',
  (select count(*) from public.reservation_events) > 0);

select test.record(
  'host: CANNOT read the staff roster',
  (select count(*) from public.profiles) = 1);

reset role;

-- ===========================================================================
--  OWNER
-- ===========================================================================
set role authenticated;
set request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333"}';

select test.record(
  'owner: sees FULL contact numbers',
  (select bool_and(contact not like '••••%') from public.staff_reservations));

select test.record(
  'owner: can read the staff roster',
  (select count(*) from public.profiles) = 3,
  (select count(*)::text from public.profiles));

select test.record(
  'owner: can read the audit trail',
  (select count(*) from public.reservation_events) > 0);

select test.record(
  'owner: can count today''s covers and pending requests',
  (select count(*) from public.reservations where reserve_date = current_date) > 0);

-- ===========================================================================
--  THINGS NOBODY MAY DO — the absent policies
-- ===========================================================================

-- Least privilege (§6): no route through the API creates a host or an owner.
select test.record(
  'nobody: CANNOT promote themselves by inserting a profile',
  test.run($q$insert into public.profiles (id, full_name, role)
             values ('44444444-4444-4444-4444-444444444444', 'Sneaky', 'owner')$q$) like 'error:%');

select test.record(
  'nobody: CANNOT change their own role',
  test.run($q$update public.profiles set role = 'owner'
             where id = '33333333-3333-3333-3333-333333333333'$q$) like 'error:%');

-- The audit trail is append-only, and that applies to the owner too. There is
-- no policy permitting a write, so the trigger is the only author.
select test.record(
  'owner: CANNOT forge an audit event',
  test.run($q$insert into public.reservation_events (reservation_id, action)
             values ('aaaaaaaa-0000-0000-0000-000000000001', 'created')$q$) like 'error:%');

select test.record(
  'owner: CANNOT delete an audit event',
  test.run($q$delete from public.reservation_events$q$) like 'error:%');

reset role;

-- ===========================================================================
--  THE AUDIT TRAIL RECORDED WHAT ACTUALLY HAPPENED
-- ===========================================================================

select test.record(
  'audit: logged crew confirming a booking',
  exists (select 1 from public.reservation_events
          where actor_role = 'crew' and action = 'status_changed' and to_status = 'confirmed'));

select test.record(
  'audit: logged the host cancelling a booking',
  exists (select 1 from public.reservation_events
          where actor_role = 'host' and to_status = 'cancelled'));

select test.record(
  'audit: logged the public creating a request',
  exists (select 1 from public.reservation_events
          where action = 'created' and actor_role is null));

-- A deleted booking leaves its evidence behind — the point of ON DELETE SET NULL.
delete from public.reservations where id = 'aaaaaaaa-0000-0000-0000-000000000003';
select test.record(
  'audit: a deleted booking still leaves a deletion event',
  exists (select 1 from public.reservation_events where action = 'deleted'));

-- ===========================================================================
--  RATE LIMITING
-- ===========================================================================
set role anon;
set request.jwt.claims = '{"role":"anon"}';

-- Three requests against a limit of 3 all pass; the fourth does not.
select test.record(
  'rate limit: allows requests up to the cap',
  (select bool_and(public.check_rate_limit('test:burst', 3, 60))
   from generate_series(1, 3)));

select test.record(
  'rate limit: refuses the request after the cap',
  public.check_rate_limit('test:burst', 3, 60) = false);

-- Buckets are independent, so one noisy visitor cannot lock everyone else out.
select test.record(
  'rate limit: a different caller has their own budget',
  public.check_rate_limit('test:someone-else', 3, 60) = true);

-- A zero-second window has always already expired, which is the cheapest way
-- to test that an elapsed window resets the count instead of staying blocked.
select test.record(
  'rate limit: the window resets once it has elapsed',
  public.check_rate_limit('test:burst', 3, 0) = true);

-- The counter is not something a caller can read or reset.
select test.record(
  'rate limit: caller CANNOT read the counter table',
  test.run($q$select * from public.rate_limits$q$) in ('rows=0', 'error:42501'));

select test.record(
  'rate limit: caller CANNOT delete their own counter',
  test.run($q$delete from public.rate_limits$q$) like 'error:%');

reset role;

-- ===========================================================================
--  RESULTS
-- ===========================================================================
\set QUIET off
\echo ''

select
  case when passed then '  PASS' else '! FAIL' end as result,
  name,
  case when passed then null else detail end as got
from test.results
order by id;

\echo ''
select
  count(*) filter (where passed)       as passed,
  count(*) filter (where not passed)   as failed,
  count(*)                             as total
from test.results;

-- Fail the whole script — and therefore `npm run db:test` — if anything failed.
do $$
declare
  failures int;
begin
  select count(*) into failures from test.results where not passed;
  if failures > 0 then
    raise exception '% RLS test(s) FAILED', failures;
  end if;
  raise notice 'All RLS tests passed.';
end;
$$;
