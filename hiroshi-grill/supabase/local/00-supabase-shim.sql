-- ============================================================================
--  Supabase shim — FOR LOCAL TESTING ONLY. Never run this on Supabase.
-- ============================================================================
--  Supabase ships an `auth` schema, an `auth.uid()` function and the roles
--  `anon` / `authenticated` / `service_role` out of the box. A plain Postgres
--  has none of them, so `schema.sql` cannot even parse locally without this.
--
--  This file recreates just enough of that surface to run the real schema and
--  its policy tests against a local database — which is the only way to check
--  RLS honestly. Reading a policy and believing it is not testing it; the
--  interesting bugs are the ones where the SQL is valid and the answer is
--  wrong.
--
--  Fidelity note: on Supabase, `auth.uid()` reads the `sub` claim of the
--  verified JWT. Here it reads a session setting we set by hand. From RLS's
--  point of view those are identical — a policy only ever sees the uuid that
--  comes back.
-- ============================================================================

create schema if not exists auth;

-- The columns RLS and our foreign keys actually reference. The real table has
-- far more (encrypted password, confirmation tokens, and so on) — all of it
-- managed by Supabase Auth, none of it our business.
create table if not exists auth.users (
  id uuid primary key,
  email text unique,
  created_at timestamptz not null default now()
);

-- The `coalesce(nullif(..., ''), '{}')` is not defensive noise. A logged-out
-- request has no `sub` claim, and depending on how it arrives the setting is
-- either absent or an empty string — and `''::jsonb` is a hard error, not a
-- null. Getting this wrong made the first run of verify-rls.sql report that
-- the public could not book a table at all, which was the shim's fault and not
-- the schema's. Supabase's real auth.uid() returns NULL for anon; so does this.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(
    coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'sub',
    ''
  )::uuid;
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    -- The service role bypasses RLS entirely. That is not a quirk to work
    -- around; it is exactly why its key must never reach a browser.
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to authenticated, service_role;
