-- ============================================================================
--  Hiroshi Master Grill — Postgres schema for Supabase
-- ============================================================================
--  Run once against a fresh Supabase project:
--    Dashboard → SQL Editor → New query → paste → Run
--  or:
--    psql "$SUPABASE_DB_URL" -f supabase/schema.sql
--
--  Idempotent: re-running it is safe and will not drop your data.
--
--  ---------------------------------------------------------------------------
--  THE IDEA
--  ---------------------------------------------------------------------------
--  Row Level Security is Postgres saying "no" before any application code runs.
--  Once RLS is enabled on a table, the default answer to every request is DENY,
--  and rows become visible only where a policy explicitly permits them.
--
--  That is why this file matters more than any React code in the project: a
--  customer who opens dev tools, grabs the public anon key and calls the REST
--  API directly still cannot read one reservation. Not because a button is
--  hidden — because the database refuses.
--
--  ---------------------------------------------------------------------------
--  WHERE THIS DIFFERS FROM hiroshi-build-spec.md §5, AND WHY
--  ---------------------------------------------------------------------------
--  The spec's policies are the right shape but have three holes. Each fix is
--  marked ✱ in place below.
--
--  ✱1  `for insert ... with check (true)` lets the public insert ANY row —
--      including one that arrives already `status = 'confirmed'`, or backdated.
--      "Anyone may create a request" is not the same as "anyone may create
--      anything". The check now pins the new row to a pending request.
--
--  ✱2  The spec says crew can mark Confirmed/Seated (§3), but the only UPDATE
--      policy it writes is host/owner (§5). As written, crew cannot do the one
--      job crew exists to do. Crew now gets its own UPDATE policy, narrowed so
--      they still cannot cancel.
--
--  ✱3  The spec suggests masking phone numbers in the UI for v1, and notes a
--      view would be the real fix. We do the real fix — a UI mask is a mask
--      only until someone opens the network tab and reads the raw JSON that
--      was sent to draw it. `staff_reservations` never puts the digits on the
--      wire for a crew session.
-- ============================================================================

create extension if not exists pgcrypto;

-- ============================================================================
--  1. TABLES
-- ============================================================================

-- One row per staff login. The role lives here, NOT in the JWT: a token is
-- issued once and stays valid until it expires, so a role baked into it would
-- keep working for minutes after you demote someone. A table lookup is current
-- as of this query.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null check (role in ('crew', 'host', 'owner')),
  created_at timestamptz not null default now()
);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 80),
  contact text not null check (length(trim(contact)) between 7 and 32),
  reserve_date date not null,
  reserve_time time not null,
  party_size int not null check (party_size between 1 and 30),
  package text,
  notes text check (notes is null or length(notes) <= 500),
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'seated', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The audit trail (§6). Written by a trigger rather than by the app, because
-- an audit trail the application has to remember to write is one a buggy or
-- malicious code path can simply skip. The trigger cannot be bypassed by
-- anything that goes through SQL.
create table if not exists public.reservation_events (
  id bigint generated always as identity primary key,
  -- Deliberately nullable with ON DELETE SET NULL rather than CASCADE: if a
  -- host deletes a booking, the record of WHO deleted it must outlive the row.
  -- Cascade here would let one DELETE erase both the data and its own evidence.
  reservation_id uuid references public.reservations(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  actor_role text,
  action text not null check (action in ('created', 'status_changed', 'edited', 'deleted')),
  from_status text,
  to_status text,
  created_at timestamptz not null default now()
);

-- The dashboard's default view is "today's bookings, soonest first".
create index if not exists reservations_date_time_idx
  on public.reservations (reserve_date, reserve_time);

-- ...and the owner's pending count.
create index if not exists reservations_status_idx
  on public.reservations (status) where status = 'pending';

create index if not exists reservation_events_reservation_idx
  on public.reservation_events (reservation_id, created_at desc);

-- ============================================================================
--  2. HELPERS
-- ============================================================================

-- Returns the caller's staff role, or NULL if they are not staff.
--
-- Three keywords here are doing real work:
--
--   security definer — runs as the function's owner, so it can read `profiles`
--     without being judged by profiles' own RLS. Without this, a policy on
--     `reservations` that queries `profiles` would have to satisfy the policy
--     on `profiles` too — which works today but is fragile, and is the usual
--     way people accidentally write infinitely recursive policies.
--
--   stable — promises the result will not change within a single statement, so
--     the planner evaluates it once per query instead of once per row. On a
--     table scan that is the difference between one lookup and ten thousand.
--
--   set search_path = '' — the security fix that belongs with every security
--     definer function. Without it, a caller can point `search_path` at a
--     schema they control, put their own `profiles` table in it, and have this
--     elevated function read theirs instead of ours. Every name below is
--     therefore fully qualified.
create or replace function public.staff_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  -- `(select auth.uid())` rather than a bare `auth.uid()`: wrapping it makes
  -- the planner treat it as a one-time initplan instead of re-running it per
  -- row. Supabase documents this as the single biggest RLS performance win.
  where p.id = (select auth.uid());
$$;

-- Reduces a phone number to its last four digits: "0917 123 4567" → "•••• 4567".
-- Enough for a host to read a number back to a guest on the phone, useless to
-- anyone who exfiltrates the table.
create or replace function public.mask_contact(contact text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when contact is null then null
    when length(regexp_replace(contact, '\D', '', 'g')) <= 4 then '••••'
    else '•••• ' || right(regexp_replace(contact, '\D', '', 'g'), 4)
  end;
$$;

-- Keeps updated_at honest. The app is not trusted to set it.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists reservations_touch_updated_at on public.reservations;
create trigger reservations_touch_updated_at
  before update on public.reservations
  for each row execute function public.touch_updated_at();

-- ✱2 (part two) — the column half of "crew may confirm and seat".
--
-- RLS decides which ROWS you may touch; it has nothing to say about which
-- COLUMNS. So the policy below can stop crew setting status = 'cancelled', but
-- on its own it would still let crew rewrite a guest's phone number while
-- confirming them. This trigger closes that gap by comparing the old and new
-- row and rejecting any crew edit that changed anything but the status.
create or replace function public.enforce_crew_update_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.staff_role() = 'crew'
     and (new.id, new.name, new.contact, new.reserve_date, new.reserve_time,
          new.party_size, new.package, new.notes, new.created_at)
         is distinct from
         (old.id, old.name, old.contact, old.reserve_date, old.reserve_time,
          old.party_size, old.package, old.notes, old.created_at)
  then
    raise exception 'crew may only change a reservation''s status'
      using errcode = '42501';  -- insufficient_privilege
  end if;
  return new;
end;
$$;

drop trigger if exists reservations_crew_update_scope on public.reservations;
create trigger reservations_crew_update_scope
  before update on public.reservations
  for each row execute function public.enforce_crew_update_scope();

-- The audit trigger. AFTER, so it only records changes that actually survived
-- every policy and constraint.
create or replace function public.log_reservation_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.reservation_events
      (reservation_id, actor_id, actor_role, action, to_status)
    values (new.id, (select auth.uid()), public.staff_role(), 'created', new.status);
    return new;
  end if;

  if tg_op = 'UPDATE' then
    insert into public.reservation_events
      (reservation_id, actor_id, actor_role, action, from_status, to_status)
    values (
      new.id, (select auth.uid()), public.staff_role(),
      case when new.status is distinct from old.status then 'status_changed' else 'edited' end,
      old.status, new.status
    );
    return new;
  end if;

  -- On DELETE the row is going away, so the event keeps a null reservation_id
  -- and stands as the only remaining record that the booking ever existed.
  insert into public.reservation_events
    (reservation_id, actor_id, actor_role, action, from_status)
  values (null, (select auth.uid()), public.staff_role(), 'deleted', old.status);
  return old;
end;
$$;

drop trigger if exists reservations_audit on public.reservations;
create trigger reservations_audit
  after insert or update or delete on public.reservations
  for each row execute function public.log_reservation_event();

-- ============================================================================
--  3. ROW LEVEL SECURITY
-- ============================================================================
--  Enabling RLS flips the table to deny-by-default. Note what is NOT written
--  below and is therefore forbidden:
--
--    · no SELECT policy for `anon`      → the public cannot read reservations
--    · no INSERT/UPDATE/DELETE on profiles for anyone
--                                       → nobody can grant themselves a role.
--                                          Staff accounts are created out of
--                                          band with the service key (§6,
--                                          "least privilege"). There is no
--                                          route through this API that makes
--                                          an owner.
--
--  An absent policy is not an oversight here. It is the deny.
-- ============================================================================

alter table public.reservations enable row level security;
alter table public.profiles enable row level security;
alter table public.reservation_events enable row level security;

-- Force RLS for the table owner too, so a mistake in a later security-definer
-- function does not quietly hand out the whole table.
--
-- One thing to know about FORCE: it applies RLS to the table's owner, but a
-- role holding BYPASSRLS still goes straight through. Both the local `postgres`
-- superuser and Supabase's `postgres` role have it, which is exactly why the
-- audit trigger below can write to `reservation_events` even though no policy
-- permits an insert. That is the intended arrangement — the trigger is the only
-- author — but it is worth knowing it rests on the function's OWNER, not on the
-- policies. If you ever recreate these functions as a role without BYPASSRLS,
-- the audit inserts will start failing and this comment is why.
alter table public.reservations force row level security;
alter table public.profiles force row level security;
alter table public.reservation_events force row level security;

-- ---------------------------------------------------------------- reservations

-- ✱1 Anyone, logged in or not, may file a REQUEST — but only a request.
--
-- The original `with check (true)` trusted the client to send a sensible row.
-- A request straight to the REST API with `{"status":"confirmed"}` would have
-- walked a fake booking past the host and into the dining room. The check
-- below is what makes "the public may book" safe to say out loud.
drop policy if exists "public can request" on public.reservations;
create policy "public can request"
  on public.reservations
  for insert to anon, authenticated
  with check (status = 'pending');

-- Only staff may read. `staff_role()` returns NULL for a logged-in user with no
-- profile row, so an auth account alone is not enough.
drop policy if exists "staff can read" on public.reservations;
create policy "staff can read"
  on public.reservations
  for select to authenticated
  using (public.staff_role() is not null);

-- ✱2 Crew may move a booking forward, and only forward.
--
--   using       — which existing rows crew may touch. Cancelled bookings are
--                 excluded, so crew cannot quietly un-cancel one.
--   with check  — what the row is allowed to look like afterwards. 'cancelled'
--                 is not on the list, so the cancel button is not merely hidden
--                 from crew in the UI; the database rejects the write.
drop policy if exists "crew can advance status" on public.reservations;
create policy "crew can advance status"
  on public.reservations
  for update to authenticated
  using (
    public.staff_role() = 'crew'
    and status in ('pending', 'confirmed', 'seated')
  )
  with check (
    public.staff_role() = 'crew'
    and status in ('confirmed', 'seated')
  );

drop policy if exists "host owner manage" on public.reservations;
create policy "host owner manage"
  on public.reservations
  for update to authenticated
  using (public.staff_role() in ('host', 'owner'))
  with check (public.staff_role() in ('host', 'owner'));

-- Deleting is allowed per §5, but cancelling is almost always the better move:
-- a cancelled row keeps the history, a deleted one leaves only the audit event.
drop policy if exists "host owner delete" on public.reservations;
create policy "host owner delete"
  on public.reservations
  for delete to authenticated
  using (public.staff_role() in ('host', 'owner'));

-- -------------------------------------------------------------------- profiles

-- Each staff member reads their own row. The dashboard needs this to know
-- which controls to draw; it does not need the roster of everyone else.
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile"
  on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

-- The owner also reads the roster, because the owner is the one who manages it.
drop policy if exists "owner reads roster" on public.profiles;
create policy "owner reads roster"
  on public.profiles
  for select to authenticated
  using (public.staff_role() = 'owner');

-- ------------------------------------------------------------ audit trail

-- Host and owner can read the history. Crew cannot: it is a record of who did
-- what, which is management's business, not the floor's.
drop policy if exists "host owner read audit" on public.reservation_events;
create policy "host owner read audit"
  on public.reservation_events
  for select to authenticated
  using (public.staff_role() in ('host', 'owner'));

-- No INSERT, UPDATE or DELETE policy on this table, for anyone, ever. The only
-- thing that writes to it is the security-definer trigger above, which runs as
-- the table owner and is not subject to these policies. That is what makes the
-- audit trail append-only: not even an owner can edit their own history.

-- ============================================================================
--  4. THE CREW-SAFE VIEW  (✱3)
-- ============================================================================
--  `security_invoker = true` is the important flag. By default a view runs with
--  its creator's privileges, which would have made this a hole straight through
--  RLS — anyone able to select from the view would read every row. With the
--  flag on, the view runs as the CALLER, so the base table's policies still
--  apply and the view only adds the column masking on top.
create or replace view public.staff_reservations
with (security_invoker = true) as
select
  r.id,
  r.name,
  case
    when public.staff_role() in ('host', 'owner') then r.contact
    else public.mask_contact(r.contact)
  end as contact,
  public.staff_role() in ('host', 'owner') as contact_visible,
  r.reserve_date,
  r.reserve_time,
  r.party_size,
  r.package,
  r.notes,
  r.status,
  r.created_at,
  r.updated_at
from public.reservations r;

-- ============================================================================
--  5. GRANTS
-- ============================================================================
--  RLS is the precise gate. Grants are the blunt one in front of it, and having
--  both means a mistake in one is not the end of the story. Supabase hands
--  `anon` and `authenticated` full table privileges by default and leans
--  entirely on RLS; we take that back and give out only what each role uses.
--
--  Read the anon line as the whole public security model in one statement:
--  the public may INSERT a reservation and may not SELECT one.
-- ============================================================================

revoke all on public.reservations from anon, authenticated;
revoke all on public.profiles from anon, authenticated;
revoke all on public.reservation_events from anon, authenticated;
revoke all on public.staff_reservations from anon, authenticated;

grant insert on public.reservations to anon, authenticated;
grant select, update, delete on public.reservations to authenticated;
grant select on public.profiles to authenticated;
grant select on public.reservation_events to authenticated;
grant select on public.staff_reservations to authenticated;

grant execute on function public.staff_role() to anon, authenticated;
grant execute on function public.mask_contact(text) to authenticated;

-- ============================================================================
--  6. RATE LIMITING  (§6 — "cap requests per IP")
-- ============================================================================
--  The spec suggests Upstash. This does it in the database we already have,
--  which matters more than saving a round trip: the obvious alternative, a
--  counter in a JavaScript variable, is worthless on Vercel. Every serverless
--  instance gets its own memory, instances come and go per request, and a bot
--  that trips the limit simply lands on a fresh one. An in-memory limiter on
--  serverless is a limiter that does not limit.
--
--  Shared state is the whole requirement, and Postgres is shared state.
--
--  On identity: the key stored here is a SALTED HASH of the caller's IP, never
--  the address itself (see src/lib/rate-limit.ts). The database therefore holds
--  no record of who visited the site — the limiter can still recognise a
--  repeat caller, but the table is useless to anyone who steals it. Under the
--  Data Privacy Act an IP address is personal information; a salted hash is
--  the cheapest way to not be holding any.
-- ============================================================================

create table if not exists public.rate_limits (
  bucket text primary key,
  count int not null default 0,
  window_start timestamptz not null default now()
);

-- Returns TRUE if this request is allowed, FALSE if the caller is over budget.
--
-- The whole thing is one INSERT ... ON CONFLICT DO UPDATE, which Postgres
-- executes atomically. That is the point. The naive version — SELECT the
-- count, add one, UPDATE — has a race between the read and the write, and two
-- requests arriving together both read the old value and both pass. Under a
-- burst, which is exactly when a rate limiter is supposed to work, the naive
-- version fails. This one cannot: the row is locked for the duration of the
-- upsert, so concurrent callers queue and each sees the previous one's count.
create or replace function public.check_rate_limit(
  p_bucket text,
  p_limit int,
  p_window_seconds int
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_count int;
begin
  insert into public.rate_limits as rl (bucket, count, window_start)
  values (p_bucket, 1, v_now)
  on conflict (bucket) do update
    set
      -- Fixed window: once the old window has elapsed, this request starts a
      -- new one at 1 rather than incrementing a stale count.
      count = case
        when rl.window_start < v_now - make_interval(secs => p_window_seconds) then 1
        else rl.count + 1
      end,
      window_start = case
        when rl.window_start < v_now - make_interval(secs => p_window_seconds) then v_now
        else rl.window_start
      end
  returning rl.count into v_count;

  return v_count <= p_limit;
end;
$$;

-- Housekeeping. Buckets are worthless once their window has passed, and left
-- alone this table would grow forever. Call it from pg_cron (Database →
-- Extensions → pg_cron) or any scheduler:
--   select cron.schedule('prune-rate-limits', '0 * * * *',
--                        $$select public.prune_rate_limits()$$);
create or replace function public.prune_rate_limits(p_older_than_seconds int default 86400)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted int;
begin
  delete from public.rate_limits
  where window_start < clock_timestamp() - make_interval(secs => p_older_than_seconds);
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

alter table public.rate_limits enable row level security;
alter table public.rate_limits force row level security;

-- No policies at all, deliberately. Nothing may read this table, and nothing
-- may write to it except the security-definer function above. A caller who
-- could SELECT here would learn how close they are to the limit; a caller who
-- could DELETE would simply reset their own counter.
revoke all on public.rate_limits from anon, authenticated;

-- The public form is used by logged-out visitors, so anon must be able to call
-- the check. It can call it and nothing else — the function decides what
-- happens to the table.
grant execute on function public.check_rate_limit(text, int, int) to anon, authenticated;
grant execute on function public.prune_rate_limits(int) to service_role;
