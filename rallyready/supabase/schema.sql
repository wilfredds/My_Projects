-- ============================================================================
--  RallyReady — Postgres schema for Supabase
-- ============================================================================
--  Run this once against a fresh Supabase project:
--    Dashboard → SQL Editor → New query → paste → Run
--  or:
--    psql "$SUPABASE_DB_URL" -f supabase/schema.sql
--
--  It is idempotent: re-running it is safe and will not drop your data.
--
--  Covers the complete data model from the product spec, including tables the
--  app does not read yet (programs, benchmarks, badges arrive in Phases 2-5).
--  Getting the schema and its policies right once is cheaper than migrating
--  a live database later.
--
--  Security model
--  --------------
--  Every table has Row-Level Security ON with no permissive default. A user
--  can read and write only their own rows. The exception is content marked
--  `is_public = true` (drills and programs), which everybody can read but only
--  the owner can modify.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- enum types
do $$
begin
  if not exists (select 1 from pg_type where typname = 'skill_level') then
    create type skill_level as enum ('beginner', 'intermediate', 'advanced');
  end if;
  if not exists (select 1 from pg_type where typname = 'discipline') then
    create type discipline as enum ('singles', 'doubles', 'both');
  end if;
  if not exists (select 1 from pg_type where typname = 'drill_category') then
    create type drill_category as enum
      ('footwork', 'net', 'rear-court', 'conditioning', 'agility', 'plyometric',
       'warmup', 'cooldown');
  end if;
  if not exists (select 1 from pg_type where typname = 'drill_style') then
    create type drill_style as enum ('shadow', 'ghosting', 'ladder', 'hiit', 'custom');
  end if;
  if not exists (select 1 from pg_type where typname = 'call_mode') then
    create type call_mode as enum ('sequential', 'random', 'deception', 'number', 'weighted');
  end if;
end $$;

-- Added later: Strokes mode names the shot as well as the corner, and Pattern
-- mode calls a whole rally. Enum values can only be appended, never inserted.
do $$
begin
  alter type call_mode add value if not exists 'stroke';
  alter type call_mode add value if not exists 'pattern';
  end if;
  if not exists (select 1 from pg_type where typname = 'session_source') then
    create type session_source as enum ('timer', 'conditioning', 'benchmark');
  end if;
  if not exists (select 1 from pg_type where typname = 'program_focus') then
    create type program_focus as enum ('footwork', 'conditioning', 'rest', 'matchplay');
  end if;
  if not exists (select 1 from pg_type where typname = 'enrollment_status') then
    create type enrollment_status as enum ('active', 'paused', 'completed', 'abandoned');
  end if;
  if not exists (select 1 from pg_type where typname = 'benchmark_test') then
    create type benchmark_test as enum ('b_endurance_style', 'spider_sprint');
  end if;
  if not exists (select 1 from pg_type where typname = 'training_goal') then
    create type training_goal as enum ('stamina', 'footwork', 'match-ready', 'consistency');
  end if;
  if not exists (select 1 from pg_type where typname = 'drill_location') then
    create type drill_location as enum ('court', 'anywhere');
  end if;
end
$$;

-- `warmup` and `cooldown` arrived after the first release. A fresh database
-- gets them from the create above and these two lines do nothing.
--
-- UPGRADING AN EXISTING DATABASE: Postgres refuses to *use* a new enum value in
-- the same transaction that adds it, so if your client wraps this whole file in
-- one transaction the warm-up rows further down will fail with "unsafe use of
-- new value". Run these two statements on their own first, then run the file.
alter type drill_category add value if not exists 'warmup';
alter type drill_category add value if not exists 'cooldown';

-- ================================================================== profiles
create table if not exists public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  display_name       text        not null default 'Player',
  avatar_url         text,
  skill_level        skill_level   not null default 'intermediate',
  primary_discipline discipline    not null default 'both',
  goal               training_goal  not null default 'footwork',
  court_access       drill_location not null default 'court',
  created_at         timestamptz    not null default now()
);

-- Added in Phases 2 and 4; keeps an existing database in step with a fresh one.
alter table public.profiles
  add column if not exists goal         training_goal  not null default 'footwork',
  add column if not exists court_access drill_location not null default 'court';

alter table public.profiles enable row level security;

drop policy if exists "profiles are self-readable" on public.profiles;
create policy "profiles are self-readable"
  on public.profiles for select using (auth.uid() = id);

drop policy if exists "profiles are self-writable" on public.profiles;
create policy "profiles are self-writable"
  on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "profiles are self-updatable" on public.profiles;
create policy "profiles are self-updatable"
  on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "profiles are self-deletable" on public.profiles;
create policy "profiles are self-deletable"
  on public.profiles for delete using (auth.uid() = id);

-- A profile row should exist the moment someone signs up, so the app never has
-- to special-case "signed in but no profile yet".
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(coalesce(new.email, 'Player'), '@', 1)
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ==================================================================== drills
--  `default_interval_ms`, `default_call_mode`, `enabled_corners`,
--  `default_warmup_sec`, `default_cooldown_sec` and `level` extend the model in
--  the spec. Without them a seeded drill cannot express what §4 asks for —
--  "net corners only", "slower interval", "deception on" — so the timer would
--  need those settings hard-coded in the client instead of living with the drill.
create table if not exists public.drills (
  id                   uuid primary key default gen_random_uuid(),
  slug                 text           not null unique,
  name                 text           not null,
  category             drill_category not null,
  mode                 drill_style    not null,
  description          text           not null default '',
  coaching_cues        text[]         not null default '{}',
  common_faults        text[]         not null default '{}',
  default_work_sec     integer        not null default 30 check (default_work_sec between 1 and 1800),
  default_rest_sec     integer        not null default 30 check (default_rest_sec between 0 and 1800),
  default_rounds       integer        not null default 6  check (default_rounds between 1 and 100),
  corners              integer        not null default 6  check (corners in (4, 6, 8)),
  video_url            text,
  is_public            boolean        not null default false,
  created_by           uuid references auth.users (id) on delete set null,
  default_interval_ms  integer        not null default 1400
                         check (default_interval_ms between 300 and 10000),
  default_call_mode    call_mode      not null default 'random',
  enabled_corners      text[],  -- null = every zone in the layout
  default_warmup_sec   integer        not null default 60 check (default_warmup_sec >= 0),
  default_cooldown_sec integer        not null default 60 check (default_cooldown_sec >= 0),
  level                skill_level    not null default 'intermediate',
  -- Phase 11. Singles and doubles are different sports on the same court, so a
  -- drill says which it is for; `pattern_ids` names the rallies a pattern-mode
  -- drill runs, and empty means "whatever suits the player", resolved client-side
  -- from the drill's discipline and the player's level.
  discipline           discipline     not null default 'both',
  pattern_ids          text[]         not null default '{}',
  -- Phase 3. A non-null `circuit` makes this a conditioning circuit rather than
  -- a corner-calling drill: an ordered list of
  -- {exerciseSlug, workSec, restSec}, repeated `circuit_rounds` times. Kept as
  -- jsonb rather than a child table because it is an ordered value object that
  -- is always read and written whole, never queried into.
  circuit              jsonb,
  circuit_rounds       integer        not null default 1 check (circuit_rounds between 1 and 20),
  location             drill_location not null default 'court',
  equipment            text[]         not null default '{}',
  created_at           timestamptz    not null default now()
);

-- Added in Phase 3; keeps an existing database in step with a fresh one.
alter table public.drills
  add column if not exists circuit        jsonb,
  add column if not exists circuit_rounds integer not null default 1,
  add column if not exists location       drill_location not null default 'court',
  add column if not exists equipment      text[] not null default '{}';

-- Added in Phase 11.
alter table public.drills
  add column if not exists discipline  discipline not null default 'both',
  add column if not exists pattern_ids text[]     not null default '{}';

create index if not exists drills_public_idx on public.drills (is_public) where is_public;
create index if not exists drills_created_by_idx on public.drills (created_by);

alter table public.drills enable row level security;

drop policy if exists "public drills are readable by everyone" on public.drills;
create policy "public drills are readable by everyone"
  on public.drills for select using (is_public or auth.uid() = created_by);

drop policy if exists "users create their own drills" on public.drills;
create policy "users create their own drills"
  on public.drills for insert with check (auth.uid() = created_by);

drop policy if exists "users update their own drills" on public.drills;
create policy "users update their own drills"
  on public.drills for update using (auth.uid() = created_by) with check (auth.uid() = created_by);

drop policy if exists "users delete their own drills" on public.drills;
create policy "users delete their own drills"
  on public.drills for delete using (auth.uid() = created_by);

-- ================================================================== sessions
--  `drill_name` is denormalised on purpose: a training log should record what
--  you actually did, even after the drill is renamed, deleted, or was a
--  one-off custom setup with no drill_id at all.
create table if not exists public.sessions (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid           not null references auth.users (id) on delete cascade,
  drill_id             uuid references public.drills (id) on delete set null,
  drill_name           text,
  started_at           timestamptz    not null default now(),
  duration_sec         integer        not null default 0 check (duration_sec >= 0),
  rounds_completed     integer        not null default 0 check (rounds_completed >= 0),
  avg_shot_interval_ms integer        check (avg_shot_interval_ms is null or avg_shot_interval_ms >= 0),
  notes                text,
  source               session_source not null default 'timer',
  created_at           timestamptz    not null default now()
);

create index if not exists sessions_user_started_idx
  on public.sessions (user_id, started_at desc);

alter table public.sessions enable row level security;

drop policy if exists "sessions are private" on public.sessions;
create policy "sessions are private"
  on public.sessions for select using (auth.uid() = user_id);

drop policy if exists "users log their own sessions" on public.sessions;
create policy "users log their own sessions"
  on public.sessions for insert with check (auth.uid() = user_id);

drop policy if exists "users edit their own sessions" on public.sessions;
create policy "users edit their own sessions"
  on public.sessions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users delete their own sessions" on public.sessions;
create policy "users delete their own sessions"
  on public.sessions for delete using (auth.uid() = user_id);

-- ========================================================== session_metrics
create table if not exists public.session_metrics (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid   not null references public.sessions (id) on delete cascade,
  metric_key   text   not null,
  metric_value numeric not null
);

create index if not exists session_metrics_session_idx on public.session_metrics (session_id);

-- One row per metric per session, so that rating a session's effort a second
-- time corrects the first answer instead of recording two contradictory ones.
-- Existing duplicates are collapsed first, keeping the most recent row, or the
-- unique index below would refuse to build on a database that already has them.
delete from public.session_metrics a
  using public.session_metrics b
 where a.session_id = b.session_id
   and a.metric_key = b.metric_key
   and a.id < b.id;

create unique index if not exists session_metrics_key_idx
  on public.session_metrics (session_id, metric_key);

alter table public.session_metrics enable row level security;

-- Ownership is inherited from the parent session.
drop policy if exists "metrics follow their session" on public.session_metrics;
create policy "metrics follow their session"
  on public.session_metrics for select
  using (exists (
    select 1 from public.sessions s
    where s.id = session_id and s.user_id = auth.uid()
  ));

drop policy if exists "metrics are written with their session" on public.session_metrics;
create policy "metrics are written with their session"
  on public.session_metrics for insert
  with check (exists (
    select 1 from public.sessions s
    where s.id = session_id and s.user_id = auth.uid()
  ));

-- An upsert that lands on the unique index above becomes an UPDATE, so the
-- owner needs update rights as well as insert ones.
drop policy if exists "metrics are updatable by their owner" on public.session_metrics;
create policy "metrics are updatable by their owner"
  on public.session_metrics for update
  using (exists (
    select 1 from public.sessions s
    where s.id = session_id and s.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.sessions s
    where s.id = session_id and s.user_id = auth.uid()
  ));

drop policy if exists "metrics are deletable by their owner" on public.session_metrics;
create policy "metrics are deletable by their owner"
  on public.session_metrics for delete
  using (exists (
    select 1 from public.sessions s
    where s.id = session_id and s.user_id = auth.uid()
  ));

-- ========================================================= readiness_checks
-- The daily check-in behind auto-regulation. One row per user per day: a second
-- answer is a change of mind, not a second morning.
create table if not exists public.readiness_checks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  -- Stored as the player's own local date, not a timestamp: "today" is a
  -- calendar question, and a UTC instant puts an evening check-in in Manila on
  -- the wrong day.
  date       date not null,
  created_at timestamptz not null default now(),
  sleep      smallint not null check (sleep between 1 and 5),
  soreness   smallint not null check (soreness between 1 and 5),
  energy     smallint not null check (energy between 1 and 5),
  unique (user_id, date)
);

create index if not exists readiness_user_date_idx
  on public.readiness_checks (user_id, date desc);

alter table public.readiness_checks enable row level security;

drop policy if exists "users read their own check-ins" on public.readiness_checks;
create policy "users read their own check-ins"
  on public.readiness_checks for select using (auth.uid() = user_id);

drop policy if exists "users write their own check-ins" on public.readiness_checks;
create policy "users write their own check-ins"
  on public.readiness_checks for insert with check (auth.uid() = user_id);

drop policy if exists "users update their own check-ins" on public.readiness_checks;
create policy "users update their own check-ins"
  on public.readiness_checks for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users delete their own check-ins" on public.readiness_checks;
create policy "users delete their own check-ins"
  on public.readiness_checks for delete using (auth.uid() = user_id);

-- ================================================================== programs
create table if not exists public.programs (
  id          uuid        primary key default gen_random_uuid(),
  slug        text        not null unique,
  name        text        not null,
  description text        not null default '',
  total_weeks integer     not null default 8 check (total_weeks between 4 and 16),
  level       skill_level not null default 'intermediate',
  is_public   boolean     not null default false,
  created_by  uuid references auth.users (id) on delete set null,
  -- Phase 4. A plan is periodised from these two, so they belong with it:
  -- `location` is what makes a no-court program possible at all.
  location          drill_location not null default 'court',
  sessions_per_week integer        not null default 3
                      check (sessions_per_week between 2 and 6),
  created_at  timestamptz not null default now()
);

-- Added in Phase 4; keeps an existing database in step with a fresh one.
alter table public.programs
  add column if not exists location          drill_location not null default 'court',
  add column if not exists sessions_per_week integer not null default 3;

alter table public.programs enable row level security;

drop policy if exists "public programs are readable by everyone" on public.programs;
create policy "public programs are readable by everyone"
  on public.programs for select using (is_public or auth.uid() = created_by);

drop policy if exists "users create their own programs" on public.programs;
create policy "users create their own programs"
  on public.programs for insert with check (auth.uid() = created_by);

drop policy if exists "users update their own programs" on public.programs;
create policy "users update their own programs"
  on public.programs for update using (auth.uid() = created_by) with check (auth.uid() = created_by);

drop policy if exists "users delete their own programs" on public.programs;
create policy "users delete their own programs"
  on public.programs for delete using (auth.uid() = created_by);

-- ============================================================== program_days
create table if not exists public.program_days (
  id         uuid          primary key default gen_random_uuid(),
  program_id uuid          not null references public.programs (id) on delete cascade,
  week_no    integer       not null check (week_no >= 1),
  day_no     integer       not null check (day_no between 1 and 7),
  title      text          not null,
  focus      program_focus not null,
  -- Drills referenced by slug rather than uuid. Slugs are stable across
  -- re-seeding and identical on both backends, where a uuid would have to be
  -- resolved twice and would break the moment a drill row was recreated.
  drill_slugs text[]       not null default '{}',
  notes      text,
  unique (program_id, week_no, day_no)
);

alter table public.program_days
  add column if not exists drill_slugs text[] not null default '{}';
alter table public.program_days drop column if exists drill_ids;

create index if not exists program_days_program_idx on public.program_days (program_id, week_no, day_no);

alter table public.program_days enable row level security;

-- Visibility is inherited from the parent program.
drop policy if exists "program days follow their program" on public.program_days;
create policy "program days follow their program"
  on public.program_days for select
  using (exists (
    select 1 from public.programs p
    where p.id = program_id and (p.is_public or p.created_by = auth.uid())
  ));

drop policy if exists "authors write their program days" on public.program_days;
create policy "authors write their program days"
  on public.program_days for insert
  with check (exists (
    select 1 from public.programs p where p.id = program_id and p.created_by = auth.uid()
  ));

drop policy if exists "authors update their program days" on public.program_days;
create policy "authors update their program days"
  on public.program_days for update
  using (exists (
    select 1 from public.programs p where p.id = program_id and p.created_by = auth.uid()
  ));

drop policy if exists "authors delete their program days" on public.program_days;
create policy "authors delete their program days"
  on public.program_days for delete
  using (exists (
    select 1 from public.programs p where p.id = program_id and p.created_by = auth.uid()
  ));

-- ======================================================= program_enrollments
create table if not exists public.program_enrollments (
  id           uuid              primary key default gen_random_uuid(),
  user_id      uuid              not null references auth.users (id) on delete cascade,
  program_id   uuid              not null references public.programs (id) on delete cascade,
  started_on   date              not null default current_date,
  current_week integer           not null default 1 check (current_week >= 1),
  current_day  integer           not null default 1 check (current_day between 1 and 7),
  status       enrollment_status not null default 'active',
  created_at   timestamptz       not null default now(),
  unique (user_id, program_id)
);

alter table public.program_enrollments enable row level security;

drop policy if exists "enrollments are private" on public.program_enrollments;
create policy "enrollments are private"
  on public.program_enrollments for select using (auth.uid() = user_id);

drop policy if exists "users enrol themselves" on public.program_enrollments;
create policy "users enrol themselves"
  on public.program_enrollments for insert with check (auth.uid() = user_id);

drop policy if exists "users update their enrollment" on public.program_enrollments;
create policy "users update their enrollment"
  on public.program_enrollments for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users leave a program" on public.program_enrollments;
create policy "users leave a program"
  on public.program_enrollments for delete using (auth.uid() = user_id);

-- ================================================================ benchmarks
create table if not exists public.benchmarks (
  id            uuid           primary key default gen_random_uuid(),
  user_id       uuid           not null references auth.users (id) on delete cascade,
  test_type     benchmark_test not null,
  taken_at      timestamptz    not null default now(),
  score         numeric        not null,
  level_reached integer,
  raw           jsonb          not null default '{}'::jsonb
);

create index if not exists benchmarks_user_taken_idx
  on public.benchmarks (user_id, test_type, taken_at desc);

alter table public.benchmarks enable row level security;

drop policy if exists "benchmarks are private" on public.benchmarks;
create policy "benchmarks are private"
  on public.benchmarks for select using (auth.uid() = user_id);

drop policy if exists "users record their own benchmarks" on public.benchmarks;
create policy "users record their own benchmarks"
  on public.benchmarks for insert with check (auth.uid() = user_id);

drop policy if exists "users delete their own benchmarks" on public.benchmarks;
create policy "users delete their own benchmarks"
  on public.benchmarks for delete using (auth.uid() = user_id);

-- =================================================================== streaks
create table if not exists public.streaks (
  id                    uuid        primary key default gen_random_uuid(),
  user_id               uuid        not null unique references auth.users (id) on delete cascade,
  current_streak        integer     not null default 0,
  longest_streak        integer     not null default 0,
  last_active_date      date,
  weekly_sessions_count integer     not null default 0,
  updated_at            timestamptz not null default now()
);

alter table public.streaks enable row level security;

drop policy if exists "streaks are private" on public.streaks;
create policy "streaks are private"
  on public.streaks for select using (auth.uid() = user_id);

drop policy if exists "users write their own streak" on public.streaks;
create policy "users write their own streak"
  on public.streaks for insert with check (auth.uid() = user_id);

drop policy if exists "users update their own streak" on public.streaks;
create policy "users update their own streak"
  on public.streaks for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ==================================================== badges / user_badges
create table if not exists public.badges (
  id          uuid        primary key default gen_random_uuid(),
  slug        text        not null unique,
  name        text        not null,
  description text        not null default '',
  icon        text        not null default 'award',
  -- Grouped so beginners and advanced players both have something in reach.
  tier        text        not null default 'bronze' check (tier in ('bronze', 'silver', 'gold')),
  created_at  timestamptz not null default now()
);

alter table public.badges enable row level security;

-- Badge definitions are catalogue data: readable by anyone, writable by nobody
-- through the anon key (seeded by this script / the service role).
drop policy if exists "badge definitions are public" on public.badges;
create policy "badge definitions are public" on public.badges for select using (true);

create table if not exists public.user_badges (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users (id) on delete cascade,
  badge_id   uuid        not null references public.badges (id) on delete cascade,
  awarded_at timestamptz not null default now(),
  unique (user_id, badge_id)
);

alter table public.user_badges enable row level security;

drop policy if exists "unlocks are private" on public.user_badges;
create policy "unlocks are private"
  on public.user_badges for select using (auth.uid() = user_id);

drop policy if exists "users record their own unlocks" on public.user_badges;
create policy "users record their own unlocks"
  on public.user_badges for insert with check (auth.uid() = user_id);

-- ============================================================================
--  Seed content
-- ============================================================================
--  Mirrors src/lib/data/seed/drills.ts, keyed by slug. Kept in sync by hand;
--  the client bundles the same catalogue so a fresh install works offline.

-- >>> generated from src/lib/data/seed/drills.ts — do not edit by hand
insert into public.drills (
  slug, name, category, mode, description, coaching_cues, common_faults, default_work_sec, default_rest_sec, default_rounds, corners, default_interval_ms, default_call_mode, enabled_corners, default_warmup_sec, default_cooldown_sec, level, discipline, pattern_ids, is_public, circuit, circuit_rounds, location, equipment
) values
(
  'six-corner-shadow', 'Six-Corner Shadow', 'footwork', 'shadow',
  'The benchmark solo session. Six targets, random calls, full shadow swing at every corner. Builds the movement pattern and the engine behind it at the same time.',
  array[
      'Split-step as the call lands — land light, weight on the balls of your feet.',
      'Racket up and in front on every recovery; never let it drop below your waist.',
      'Chassé to the sides and rear, lunge to the net. Running flat-footed wastes a step.',
      'Recover through base after every corner, not around it.',
      'Finish each movement with a shadow swing so the arm learns the timing too.'
    ],
  array[
      'Standing tall between calls instead of staying loaded in a low ready position.',
      'Skipping the split-step and starting late.',
      'Crossing the feet on the way to the rear corners.',
      'Drifting past base on the recovery and getting caught flat.'
    ],
  30, 30, 6, 6,
  1350, 'random',
  null,
  60, 60, 'intermediate',
  'both', '{}', true,
  null, 1, 'court',
  '{}'
),
(
  'four-corner-footwork', 'Four-Corner Footwork', 'footwork', 'ghosting',
  'The classic four-corner pattern: two net corners, two rear corners. Fewer targets means longer travel and a harder recovery — the best place to start if six feels frantic.',
  array[
      'Two-step chassé to the rear, lunge to the front. Economy beats effort.',
      'Push off the outside foot to change direction rather than shuffling round.',
      'Keep the hips square to the net until the last step.',
      'Land each lunge with the knee tracking over the toes, never inside them.'
    ],
  array[
      'Over-striding to the net so there is nothing left to push back out with.',
      'Turning the shoulders early and losing balance on the way back.',
      'Bouncing on the spot instead of holding a stable, loaded base.'
    ],
  30, 30, 6, 4,
  1650, 'random',
  null,
  60, 60, 'beginner',
  'both', '{}', true,
  null, 1, 'court',
  '{}'
),
(
  'net-footwork', 'Front-Court Net Footwork', 'net', 'shadow',
  'Net corners only, at a deliberate pace. This is a technique drill disguised as a fitness drill — every rep is a full lunge and a full push back to base.',
  array[
      'The racket leg leads every lunge — right leg for right-handers.',
      'Drive out of the lunge with the front leg. The back leg is a brake, not an engine.',
      'Take the shuttle early and high: reach in front of the knee, not beside it.',
      'Chest up. Bending at the waist kills the recovery before it starts.'
    ],
  array[
      'Landing on a straight leg and jarring the knee.',
      'Letting the racket head drop below the net tape.',
      'Standing up out of the lunge before pushing back.'
    ],
  20, 25, 6, 4,
  1800, 'random',
  array[
      'net-left',
      'net-right'
    ],
  60, 60, 'beginner',
  'doubles', '{}', true,
  null, 1, 'court',
  '{}'
),
(
  'rear-court-scissor', 'Rear-Court Scissor Recovery', 'rear-court', 'shadow',
  'Rear corners only, slow calls, maximum quality. Get behind the shuttle, scissor-jump the legs, land balanced and recover. The most common place a returning player loses time.',
  array[
      'Turn side-on early, then chassé back. Never run backwards.',
      'Scissor the legs in the air: hitting leg back, landing leg forward.',
      'Land on the non-racket foot first and let it absorb the drop.',
      'Rotate hips and shoulders through the shot; the arm follows the body.'
    ],
  array[
      'Reaching backwards for the shuttle instead of getting behind it.',
      'Landing flat on both feet, which stalls the recovery.',
      'Losing the racket-up ready position on the way back to base.'
    ],
  20, 40, 6, 4,
  2200, 'random',
  array[
      'rear-left',
      'rear-right'
    ],
  90, 60, 'intermediate',
  'singles', '{}', true,
  null, 1, 'court',
  '{}'
),
(
  'deception-reaction', 'Deception Reaction', 'footwork', 'ghosting',
  'A fake call, then the real one. Trains the second split-step — the thing that separates players who get wrong-footed from players who do not.',
  array[
      'Split-step on the first call and again on the second. That is the whole drill.',
      'Tall in the hips, low in the knees — you cannot redirect out of a deep squat.',
      'Move your eyes before your feet.',
      'Accept a slower first step in exchange for never being wrong-footed.'
    ],
  array[
      'Committing full body weight to the fake and losing the second step.',
      'Freezing on the fake instead of re-splitting.',
      'Anticipating a pattern rather than reacting to the call.'
    ],
  25, 35, 5, 6,
  1800, 'deception',
  null,
  90, 60, 'advanced',
  'singles', '{}', true,
  null, 1, 'court',
  '{}'
),
(
  'match-rhythm-intervals', 'Match Rhythm Intervals', 'conditioning', 'ghosting',
  'Built on measured singles match data — roughly 5–6 second rallies against 11–12 seconds between them. Short, sharp work blocks at a true 1:2 ratio, so the session trains the energy system a match actually uses.',
  array[
      'Treat every work block as a rally: full intensity, then genuinely recover.',
      'Use the rest. Walk, breathe through the nose, let the heart rate drop.',
      'Movement quality matters more than the number of corners covered.'
    ],
  array[
      'Pacing the work block like a jog because you are saving energy for later.',
      'Standing still during rest instead of walking it off.'
    ],
  6, 12, 12, 6,
  1100, 'random',
  null,
  90, 90, 'intermediate',
  'singles', '{}', true,
  null, 1, 'anywhere',
  '{}'
),
(
  'tabata-shadow', 'Tabata Shadow', 'conditioning', 'hiit',
  'Twenty seconds on, ten seconds off, eight times. Four minutes that will tell you exactly how much base you have — and nothing to hide behind.',
  array[
      'Twenty seconds is short. Go from the first call, not the third.',
      'When you tire, shorten the recovery step — never the split-step.',
      'Hold the racket up even when your arms want to drop.'
    ],
  array[
      'Fading in rounds 5 to 8 because rounds 1 and 2 were too hard.',
      'Letting footwork collapse into running once fatigue sets in.'
    ],
  20, 10, 8, 6,
  1000, 'random',
  null,
  120, 120, 'advanced',
  'singles', '{}', true,
  null, 1, 'anywhere',
  '{}'
),
(
  'multifeed-shadow', 'Multifeed Shadow Intervals', 'conditioning', 'ghosting',
  'Ten seconds flat out, thirty to recover, over and over. Short efforts are the point: multifeed falls apart as a training tool the moment your movement gets sloppy, so the block ends before it can.',
  array[
      'Ten seconds is a sprint, not a pace. Empty the tank each block.',
      'The moment your footwork turns into running, the block has done its job.',
      'Use the full thirty seconds — this is not a work-capacity drill, it is a speed one.',
      'Racket up throughout, even on the last round.'
    ],
  array[
      'Treating the work block as a jog to preserve energy for later rounds.',
      'Cutting the rest short and turning a speed session into a slog.'
    ],
  10, 30, 10, 6,
  880, 'random',
  null,
  120, 120, 'advanced',
  'doubles', '{}', true,
  null, 1, 'anywhere',
  '{}'
),
(
  'rally-hiit', 'Rally HIIT', 'conditioning', 'hiit',
  'Longer rallies than a match usually gives you, with match-length recovery. Fifteen seconds on, fifteen off — a 1:1 ratio that is deliberately harder than real play, so real play feels easy.',
  array[
      'Fifteen seconds is roughly three long rallies back to back. Pace accordingly.',
      'Breathe through the nose in the rest; it settles the heart rate faster.',
      'Hold your movement quality to round eight, not just round three.'
    ],
  array[
      'Going out at a pace you can only hold for four rounds.',
      'Standing still in the rest instead of walking it off.'
    ],
  15, 15, 10, 6,
  1100, 'random',
  null,
  120, 120, 'intermediate',
  'both', '{}', true,
  null, 1, 'anywhere',
  '{}'
),
(
  'agility-ladder-circuit', 'Agility Ladder Circuit', 'agility', 'ladder',
  'Four ladder patterns, three times through. Trains foot speed and coordination rather than lungs — go for clean feet at high cadence, not for exhaustion.',
  array[
      'Cadence over stride. The ladder rewards how often your feet land, not how far they travel.',
      'Stay on the balls of the feet the whole way through.',
      'Chest up and eyes forward — looking down slows every pattern.',
      'Stop the block early if the pattern falls apart. Sloppy reps train sloppy feet.'
    ],
  array[
      'Chasing speed before the pattern is automatic.',
      'Letting the heels touch down and turning quick feet into running.'
    ],
  30, 25, 3, 4,
  1000, 'random',
  null,
  0, 120, 'intermediate',
  'both', '{}', true,
  '[{"exerciseSlug":"ladder-in-out","workSec":30,"restSec":25},{"exerciseSlug":"ladder-lateral-shuffle","workSec":30,"restSec":25},{"exerciseSlug":"ladder-crossover","workSec":30,"restSec":25},{"exerciseSlug":"ladder-high-knees","workSec":25,"restSec":40}]'::jsonb, 3, 'anywhere',
  array[
      'agility ladder (or tape)'
    ]
),
(
  'plyometric-power-circuit', 'Plyometric Power Circuit', 'plyometric', 'custom',
  'Five explosive movements, three rounds. This is the drive behind a jump smash and the push out of a deep lunge — power work, so quality matters far more than the count.',
  array[
      'Every landing is a rep too. Land soft, absorb, then go again.',
      'Quality drops before your legs do. Stop the block when the jumps get scrappy.',
      'Full recovery between exercises — this is power training, not conditioning.',
      'Do this on a forgiving surface, never on concrete.'
    ],
  array[
      'Rushing the reps and turning a power session into a cardio one.',
      'Landing stiff-legged, which is where the knee and shin complaints start.',
      'Adding rounds instead of adding height.'
    ],
  25, 35, 3, 4,
  1000, 'random',
  null,
  0, 180, 'advanced',
  'both', '{}', true,
  '[{"exerciseSlug":"plyo-jump-squat","workSec":25,"restSec":35},{"exerciseSlug":"plyo-split-jump","workSec":25,"restSec":35},{"exerciseSlug":"plyo-lateral-bound","workSec":25,"restSec":35},{"exerciseSlug":"plyo-tuck-jump","workSec":20,"restSec":40},{"exerciseSlug":"plyo-step-jump","workSec":25,"restSec":45}]'::jsonb, 3, 'anywhere',
  array[
      'a low step or box (optional)'
    ]
),
(
  'home-court-circuit', 'No-Court Home Circuit', 'conditioning', 'custom',
  'No court, no ladder, no box — two square metres and your own bodyweight. Built for the evenings when the hall is shut and doing nothing is the alternative.',
  array[
      'Nothing here needs equipment. If a movement hurts, halve the range, not the effort.',
      'Keep the rest honest: forty seconds is enough to go hard again.',
      'Two rounds done properly beats four rounds rushed.'
    ],
  array[
      'Letting the lunges get shallow as the rounds add up.',
      'Rocking the hips through the plank taps, which removes the whole point.'
    ],
  30, 30, 3, 4,
  1000, 'random',
  null,
  0, 120, 'beginner',
  'both', '{}', true,
  '[{"exerciseSlug":"shadow-lunge","workSec":40,"restSec":25},{"exerciseSlug":"plyo-jump-squat","workSec":25,"restSec":35},{"exerciseSlug":"plyo-lateral-bound","workSec":30,"restSec":30},{"exerciseSlug":"core-plank-reach","workSec":40,"restSec":40}]'::jsonb, 3, 'anywhere',
  '{}'
),
(
  'stroke-shadow', 'Stroke Shadow', 'footwork', 'shadow',
  'The app calls the corner and the shot. Move there, play the full shadow stroke, recover. The closest thing to a coach shouting at you that fits in a pocket.',
  array[
      'Play the whole stroke — preparation, contact, follow-through — not a wave at the air.',
      'The shot changes the footwork. A smash wants a scissor jump; a drop wants you balanced.',
      'Recover to base between every one. Half the work of a stroke is what happens after it.',
      'Say the shot back to yourself as you play it. It is how the name and the movement stick.'
    ],
  array[
      'Playing the same swing whatever shot was called.',
      'Rushing the recovery to be ready for the next call — the call waits for you.',
      'Dropping the non-racket arm, which is what balances the whole shot.'
    ],
  45, 30, 5, 6,
  2000, 'stroke',
  null,
  60, 90, 'intermediate',
  'both', '{}', true,
  null, 1, 'anywhere',
  '{}'
),
(
  'stroke-rear-court', 'Overhead Repertoire', 'rear-court', 'shadow',
  'Rear court only, and only the three overheads — clear, drop, smash. The same preparation for all three is what makes them deceptive.',
  array[
      'Identical preparation every time. If the opponent can read the shot from your setup, none of the three work.',
      'Get behind the shuttle. Everything else is downstream of that.',
      'Scissor the feet on every one, even the drop.',
      'Recover forwards, not sideways — the reply is usually short.'
    ],
  array[
      'A visibly gentler wind-up for the drop, which announces it.',
      'Reaching backwards instead of moving the feet back.',
      'Landing flat-footed and staying there.'
    ],
  40, 40, 4, 4,
  2200, 'stroke',
  array[
      'rear-left',
      'rear-right'
    ],
  60, 90, 'advanced',
  'both', '{}', true,
  null, 1, 'anywhere',
  '{}'
),
(
  'strength-foundation', 'Foundation Strength', 'strength', 'custom',
  'Push, squat, hinge and brace — the four things a body does, in the versions a badminton player needs. No equipment, twelve minutes, anywhere.',
  array[
      'Quality over count. When the form goes, the set is over, whatever the clock says.',
      'Every exercise has an easier version in its own notes. Using it is not a step down.',
      'Breathe out on the effort. Holding your breath makes everything feel twice as hard.'
    ],
  array[
      'Racing the clock and losing the position — the position is the exercise.',
      'Skipping the easier version and doing five bad repetitions instead of twelve good ones.'
    ],
  40, 25, 3, 4,
  1000, 'random',
  null,
  0, 90, 'beginner',
  'both', '{}', true,
  '[{"exerciseSlug":"str-squat","workSec":45,"restSec":20},{"exerciseSlug":"str-push-up","workSec":40,"restSec":25},{"exerciseSlug":"str-glute-bridge","workSec":40,"restSec":20},{"exerciseSlug":"str-plank","workSec":35,"restSec":25}]'::jsonb, 3, 'anywhere',
  '{}'
),
(
  'strength-legs', 'Lunge Legs', 'strength', 'custom',
  'Single-leg strength and the ankles that survive landing. The lunge is the sport, and this is where the lunge gets paid for.',
  array[
      'Both legs get equal work, even though one of them will be noticeably better at this.',
      'Front shin vertical on every lunge. A short stride grinds the knee and trains nothing.',
      'Lower slowly on the calf raises — the lowering is what builds the tendon.'
    ],
  array[
      'Far more repetitions on the racket-side leg, which is how the imbalance got there.',
      'Bouncing out of the bottom instead of driving out of it.'
    ],
  40, 25, 3, 4,
  1000, 'random',
  null,
  0, 120, 'intermediate',
  'both', '{}', true,
  '[{"exerciseSlug":"str-split-squat","workSec":40,"restSec":20},{"exerciseSlug":"str-reverse-lunge","workSec":40,"restSec":20},{"exerciseSlug":"str-wall-sit","workSec":45,"restSec":25},{"exerciseSlug":"str-calf-raise","workSec":40,"restSec":25}]'::jsonb, 3, 'anywhere',
  '{}'
),
(
  'strength-core', 'Smash Core', 'strength', 'custom',
  'The core work a smash actually needs: resisting rotation and extension, not sit-ups. Ten minutes on the floor.',
  array[
      'Slow is the whole method here. Every one of these is easy done fast and useless done fast.',
      'Lower back stays where you put it. When it lifts, you have found the edge of your range.',
      'Both sides get the same time, including the side you will want to skip.'
    ],
  array[
      'Rushing the dead bugs so the back arches unnoticed.',
      'Holding a plank past the point where the hips have already sagged.'
    ],
  35, 25, 3, 4,
  1000, 'random',
  null,
  0, 90, 'beginner',
  'both', '{}', true,
  '[{"exerciseSlug":"str-plank","workSec":35,"restSec":20},{"exerciseSlug":"str-dead-bug","workSec":40,"restSec":20},{"exerciseSlug":"str-side-plank","workSec":40,"restSec":20},{"exerciseSlug":"str-bird-dog","workSec":40,"restSec":20},{"exerciseSlug":"str-superman","workSec":30,"restSec":25}]'::jsonb, 3, 'anywhere',
  '{}'
),
(
  'warmup-full', 'Full Warm-Up', 'warmup', 'custom',
  'Six and a half minutes, RAMP structure: raise the heart rate, mobilise every joint badminton punishes, then two minutes of sharp, court-specific movement. Do this before anything hard.',
  array[
      'Nothing here should be hard. If you are out of breath, you are going too fast.',
      'The joints get warm in the order they get loaded: ankles, hips, shoulders.',
      'The last two minutes are the ones that matter — that is where you actually get fast.',
      'Never skip it because you are short of time. Do the three-minute version instead.'
    ],
  array[
      'Static stretching before playing, which does not prevent injury and briefly costs you power.',
      'Starting at full pace, which is just an unwarmed sprint.',
      'Skipping the potentiate phase, so the first real effort of the day is cold.'
    ],
  30, 0, 1, 4,
  1000, 'sequential',
  null,
  0, 0, 'beginner',
  'both', '{}', true,
  '[{"exerciseSlug":"mob-march","workSec":50,"restSec":0},{"exerciseSlug":"mob-side-shuffle","workSec":40,"restSec":0},{"exerciseSlug":"mob-ankle-rolls","workSec":30,"restSec":0},{"exerciseSlug":"mob-leg-swings-front","workSec":30,"restSec":0},{"exerciseSlug":"mob-leg-swings-side","workSec":30,"restSec":0},{"exerciseSlug":"mob-hip-openers","workSec":30,"restSec":0},{"exerciseSlug":"mob-arm-circles","workSec":30,"restSec":0},{"exerciseSlug":"mob-torso-twists","workSec":30,"restSec":0},{"exerciseSlug":"mob-split-steps","workSec":30,"restSec":0},{"exerciseSlug":"mob-corner-walk","workSec":45,"restSec":0},{"exerciseSlug":"mob-shadow-swings","workSec":35,"restSec":0}]'::jsonb, 1, 'anywhere',
  '{}'
),
(
  'warmup-quick', 'Quick Warm-Up', 'warmup', 'custom',
  'Three minutes when that is genuinely all you have. Keeps the raise and the sharp work, trims the joint-by-joint mobility. Better than nothing by a very large margin.',
  array[
      'This is the compromise version. Use the full one when you have the time.',
      'Still build gradually — three minutes is not permission to start flat out.',
      'If one joint is stiff today, spend the shuffle block on that instead.'
    ],
  array[
      'Treating this as the default rather than the fallback.',
      'Skipping the split-steps, which are the most valuable thirty seconds in it.'
    ],
  30, 0, 1, 4,
  1000, 'sequential',
  null,
  0, 0, 'beginner',
  'both', '{}', true,
  '[{"exerciseSlug":"mob-march","workSec":45,"restSec":0},{"exerciseSlug":"mob-side-shuffle","workSec":30,"restSec":0},{"exerciseSlug":"mob-leg-swings-side","workSec":30,"restSec":0},{"exerciseSlug":"mob-arm-circles","workSec":25,"restSec":0},{"exerciseSlug":"mob-split-steps","workSec":30,"restSec":0},{"exerciseSlug":"mob-corner-walk","workSec":40,"restSec":0}]'::jsonb, 1, 'anywhere',
  '{}'
),
(
  'cooldown-stretch', 'Cool-Down and Stretch', 'cooldown', 'custom',
  'Five minutes of walking your breathing down and then holding the five stretches that badminton actually shortens. This is where static stretching belongs — afterwards, never before.',
  array[
      'Keep moving first. Stopping dead after hard work is what makes you feel faint.',
      'Hold each stretch still. Bouncing is not stretching.',
      'Breathe out as you settle into each one, and never stretch into pain.',
      'The hip flexors are the ones to keep if you only do one — every lunge shortened them.'
    ],
  array[
      'Sitting straight down when the drill timer stops.',
      'Bouncing to push deeper into a stretch.',
      'Rushing through so nothing is held long enough to matter.'
    ],
  45, 0, 1, 4,
  1000, 'sequential',
  null,
  0, 0, 'beginner',
  'both', '{}', true,
  '[{"exerciseSlug":"cool-walk","workSec":60,"restSec":0},{"exerciseSlug":"cool-calf-stretch","workSec":45,"restSec":0},{"exerciseSlug":"cool-quad-stretch","workSec":45,"restSec":0},{"exerciseSlug":"cool-hamstring-stretch","workSec":45,"restSec":0},{"exerciseSlug":"cool-hip-flexor-stretch","workSec":45,"restSec":0},{"exerciseSlug":"cool-shoulder-stretch","workSec":45,"restSec":0}]'::jsonb, 1, 'anywhere',
  '{}'
),
(
  'singles-rally-patterns', 'Singles Rally Patterns', 'footwork', 'shadow',
  'The caller says a point, not a corner. Singles sequences taken from how rallies are actually built — move them to the corners, take the reply early, finish at the net. The patterns you get open up as your level does.',
  array[
      'Play the shot you were told, not the shot the corner suggests. A drop and a clear from the same corner are different movements.',
      'Recover to the base the next shot needs, not to the middle by reflex.',
      'The rally is the unit. Finish the sequence before you start thinking about the next one.',
      'Shadow the full swing every time — this is a rally, not a running drill.'
    ],
  array[
      'Drifting into a rhythm and stopping listening once you recognise a pattern.',
      'Playing every shot at the same speed. A hold and a punch clear are not the same tempo.',
      'Recovering to the middle out of habit after a straight drop, which is exactly what gets you beaten cross-court.'
    ],
  45, 35, 6, 6,
  1600, 'pattern',
  null,
  90, 90, 'intermediate',
  'singles', '{}', true,
  null, 1, 'court',
  '{}'
),
(
  'doubles-rally-patterns', 'Doubles Patterns', 'footwork', 'shadow',
  'Doubles is a different sport on the same court: flat, fast, and decided in the front two thirds. These sequences drill the two shapes it is played in — front-and-back when you attack, level when you defend — and the rotation between them.',
  array[
      'Attacking is front-and-back. Smash and then get in behind it; the pair that rotates faster keeps the attack.',
      'The moment you lift, you are defending. Get level with your partner before the smash arrives, not after.',
      'Racket up and in front for every defensive shot. There is no time to lift it once the smash is on its way.',
      'Take the flat exchange earlier and higher than feels comfortable. Short backswing, no wind-up.'
    ],
  array[
      'Standing side-by-side while attacking, which hands the net straight back.',
      'Watching your own smash instead of following it in.',
      'Defending from too deep — the smash beats you before you have moved.'
    ],
  40, 30, 6, 6,
  1300, 'pattern',
  null,
  90, 90, 'intermediate',
  'doubles', '{}', true,
  null, 1, 'court',
  '{}'
),
(
  'defence-into-attack', 'Defence Into Attack', 'footwork', 'shadow',
  'The half of the game nobody trains alone. Survive the smash, then turn the rally around: block, follow it in, take the lift in the air. Champions are not the players who defend well, they are the players who stop defending soonest.',
  array[
      'Low base, wide feet, racket in front. Defence is a position before it is a shot.',
      'Block with the hand, not the arm. A swing at a smash goes out the back.',
      'The block is only half the shot — follow it forward, because the reply is coming short.',
      'If the lift comes, take it early and above the tape. Letting it drop is giving the rally back.'
    ],
  array[
      'Blocking and then standing still to admire it.',
      'Defending with the racket beside the hip, which is a foot too far to travel.',
      'Lifting every time under pressure instead of blocking short and stealing the net.'
    ],
  40, 40, 5, 6,
  1250, 'pattern',
  null,
  90, 60, 'intermediate',
  'both', array[
      's-defend-and-counter',
      'd-side-by-side',
      'd-defence-to-attack'
    ], true,
  null, 1, 'court',
  '{}'
),
(
  'hold-and-deceive', 'Hold and Deceive', 'rear-court', 'shadow',
  'Every shot from the same preparation. Get to the shuttle early enough to wait, show one thing and play another — the hold, the slice, the tumble, the flick. This is the layer above hitting it cleanly, and it is why a good smash gets blocked and a held drop does not.',
  array[
      'Arrive early. You cannot hold a shot you only just reached — the pause is bought with your feet.',
      'Same swing to the same point every time. The disguise is everything before contact, not after.',
      'Slice across the shuttle rather than through it: full arm speed, half the pace.',
      'On the flick, wrist and fingers only. A backswing announces it before the shuttle moves.'
    ],
  array[
      'Slowing the whole swing down instead of holding and then accelerating.',
      'Telegraphing with the body — the shoulders turn before the racket does.',
      'Using deception when you are late, which is the one moment it cannot work.'
    ],
  40, 45, 5, 6,
  1900, 'pattern',
  null,
  120, 90, 'advanced',
  'singles', array[
      's-hold-and-slice',
      's-six-corner-press'
    ], true,
  null, 1, 'court',
  '{}'
),
(
  'front-court-speed', 'Front Court Speed', 'net', 'ghosting',
  'Net corners only, called fast, with the shot named. Kills, tumbles, cross nets and flicks from a low, loaded base. In doubles the front player decides the rally, and the front player is whoever got there first.',
  array[
      'Racket head above the net tape before you arrive, not after.',
      'A kill is a punch from the forearm. A backswing at the net is a lost point.',
      'Lunge and push straight back out of it — never step through and turn around.',
      'Tumble and cross net are played with the fingers. Same arrival, different hand.'
    ],
  array[
      'Reaching with the racket instead of arriving with the feet.',
      'Standing up between reps and losing the loaded base.',
      'Killing everything, including the ones that were below the tape.'
    ],
  30, 40, 6, 6,
  1100, 'stroke',
  array[
      'net-left',
      'net-right'
    ],
  90, 60, 'intermediate',
  'doubles', '{}', true,
  null, 1, 'court',
  '{}'
)
on conflict (slug) do update set
  name                 = excluded.name,
  category             = excluded.category,
  mode                 = excluded.mode,
  description          = excluded.description,
  coaching_cues        = excluded.coaching_cues,
  common_faults        = excluded.common_faults,
  default_work_sec     = excluded.default_work_sec,
  default_rest_sec     = excluded.default_rest_sec,
  default_rounds       = excluded.default_rounds,
  corners              = excluded.corners,
  default_interval_ms  = excluded.default_interval_ms,
  default_call_mode    = excluded.default_call_mode,
  enabled_corners      = excluded.enabled_corners,
  default_warmup_sec   = excluded.default_warmup_sec,
  default_cooldown_sec = excluded.default_cooldown_sec,
  level                = excluded.level,
  discipline           = excluded.discipline,
  pattern_ids          = excluded.pattern_ids,
  is_public            = excluded.is_public,
  circuit              = excluded.circuit,
  circuit_rounds       = excluded.circuit_rounds,
  location             = excluded.location,
  equipment            = excluded.equipment;
-- <<< end generated drill seed

-- >>> generated program seed from src/lib/data/seed/programs.ts — do not edit
insert into public.programs (
  slug, name, description, total_weeks, level, location, sessions_per_week, is_public
) values
(
  'return-to-court', 'Return to Court',
  'Eight weeks for a player coming back after a long break. Three sessions a week, heavy on movement quality, with a deload built in before you feel like you need one. Assumes court access.',
  8, 'beginner', 'court',
  3, true
),
(
  'rebuild-the-engine', 'Rebuild the Engine',
  'Twelve weeks from base fitness to match fitness. Four sessions a week through Base, Build and Sharpen, ending with a taper. The full arc for a club player who wants their legs back by the new season.',
  12, 'intermediate', 'court',
  4, true
),
(
  'no-court-comeback', 'No-Court Comeback',
  'Ten weeks that need nothing but floor space. Shadow intervals, ladder work and bodyweight circuits, for anyone whose hall is shut or whose club night is once a fortnight.',
  10, 'intermediate', 'anywhere',
  4, true
),
(
  'sharpen-for-season', 'Sharpen for the Season',
  'Eight hard weeks for a player who already has a base. Five sessions a week, weighted towards speed, reaction and match play. Do not start this one out of shape.',
  8, 'advanced', 'court',
  5, true
)
on conflict (slug) do update set
  name              = excluded.name,
  description       = excluded.description,
  total_weeks       = excluded.total_weeks,
  level             = excluded.level,
  location          = excluded.location,
  sessions_per_week = excluded.sessions_per_week,
  is_public         = excluded.is_public;

insert into public.program_days (
  program_id, week_no, day_no, title, focus, drill_slugs, notes
) values
(
  (select id from public.programs where slug = 'return-to-court'),
  1, 1, 'Footwork — technique', 'footwork',
  array[
      'net-footwork'
    ], 'Quality over pace. Stop the block if the movement gets scrappy.'
),
(
  (select id from public.programs where slug = 'return-to-court'),
  1, 2, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'return-to-court'),
  1, 3, 'Easy conditioning', 'conditioning',
  array[
      'agility-ladder-circuit'
    ], 'Comfortably hard. You should be able to speak in the rest.'
),
(
  (select id from public.programs where slug = 'return-to-court'),
  1, 4, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'return-to-court'),
  1, 5, 'Footwork — volume', 'footwork',
  array[
      'net-footwork'
    ], 'Add a round rather than adding speed.'
),
(
  (select id from public.programs where slug = 'return-to-court'),
  1, 6, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'return-to-court'),
  1, 7, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'return-to-court'),
  2, 1, 'Circuit', 'conditioning',
  array[
      'agility-ladder-circuit'
    ], null
),
(
  (select id from public.programs where slug = 'return-to-court'),
  2, 2, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'return-to-court'),
  2, 3, 'Play', 'matchplay',
  '{}', 'Social games. Play, do not train — this is the fun one.'
),
(
  (select id from public.programs where slug = 'return-to-court'),
  2, 4, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'return-to-court'),
  2, 5, 'Footwork — technique', 'footwork',
  array[
      'four-corner-footwork'
    ], null
),
(
  (select id from public.programs where slug = 'return-to-court'),
  2, 6, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'return-to-court'),
  2, 7, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'return-to-court'),
  3, 1, 'Footwork under load', 'footwork',
  array[
      'rear-court-scissor'
    ], 'Hold your form into the last round. That is the whole session.'
),
(
  (select id from public.programs where slug = 'return-to-court'),
  3, 2, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'return-to-court'),
  3, 3, 'Intervals', 'conditioning',
  array[
      'match-rhythm-intervals'
    ], 'Take the full rest. Cutting it short trains the wrong thing.'
),
(
  (select id from public.programs where slug = 'return-to-court'),
  3, 4, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'return-to-court'),
  3, 5, 'Reaction work', 'footwork',
  array[
      'net-footwork'
    ], null
),
(
  (select id from public.programs where slug = 'return-to-court'),
  3, 6, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'return-to-court'),
  3, 7, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'return-to-court'),
  4, 1, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'return-to-court'),
  4, 2, 'Play for fun', 'matchplay',
  '{}', 'No score, no pressure.'
),
(
  (select id from public.programs where slug = 'return-to-court'),
  4, 3, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'return-to-court'),
  4, 4, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'return-to-court'),
  4, 5, 'Light circuit', 'conditioning',
  array[
      'match-rhythm-intervals'
    ], 'One round fewer than you think you need.'
),
(
  (select id from public.programs where slug = 'return-to-court'),
  4, 6, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'return-to-court'),
  4, 7, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'return-to-court'),
  5, 1, 'Footwork — volume', 'footwork',
  array[
      'net-footwork'
    ], null
),
(
  (select id from public.programs where slug = 'return-to-court'),
  5, 2, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'return-to-court'),
  5, 3, 'Footwork under load', 'footwork',
  array[
      'six-corner-shadow'
    ], 'Hold your form into the last round. That is the whole session.'
),
(
  (select id from public.programs where slug = 'return-to-court'),
  5, 4, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'return-to-court'),
  5, 5, 'Intervals', 'conditioning',
  array[
      'match-rhythm-intervals'
    ], 'Take the full rest. Cutting it short trains the wrong thing.'
),
(
  (select id from public.programs where slug = 'return-to-court'),
  5, 6, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'return-to-court'),
  5, 7, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'return-to-court'),
  6, 1, 'Match play', 'matchplay',
  '{}', 'Play as if it counts. This is what the last weeks were for.'
),
(
  (select id from public.programs where slug = 'return-to-court'),
  6, 2, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'return-to-court'),
  6, 3, 'Footwork — crisp', 'footwork',
  array[
      'rear-court-scissor'
    ], 'Cut the volume, keep the pace.'
),
(
  (select id from public.programs where slug = 'return-to-court'),
  6, 4, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'return-to-court'),
  6, 5, 'Power circuit', 'conditioning',
  array[
      'match-rhythm-intervals'
    ], null
),
(
  (select id from public.programs where slug = 'return-to-court'),
  6, 6, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'return-to-court'),
  6, 7, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'return-to-court'),
  7, 1, 'Reaction work', 'footwork',
  array[
      'rear-court-scissor'
    ], null
),
(
  (select id from public.programs where slug = 'return-to-court'),
  7, 2, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'return-to-court'),
  7, 3, 'Speed and reaction', 'footwork',
  array[
      'six-corner-shadow'
    ], 'Short and fast. Fully recovered before every block.'
),
(
  (select id from public.programs where slug = 'return-to-court'),
  7, 4, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'return-to-court'),
  7, 5, 'Sharp intervals', 'conditioning',
  array[
      'rear-court-scissor'
    ], 'Ten-second efforts. Empty the tank, then take the whole rest.'
),
(
  (select id from public.programs where slug = 'return-to-court'),
  7, 6, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'return-to-court'),
  7, 7, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'return-to-court'),
  8, 1, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'return-to-court'),
  8, 2, 'Easy footwork', 'footwork',
  array[
      'four-corner-footwork'
    ], 'Half the usual rounds. Move well, do not chase the clock.'
),
(
  (select id from public.programs where slug = 'return-to-court'),
  8, 3, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'return-to-court'),
  8, 4, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'return-to-court'),
  8, 5, 'Play for fun', 'matchplay',
  '{}', 'No score, no pressure.'
),
(
  (select id from public.programs where slug = 'return-to-court'),
  8, 6, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'return-to-court'),
  8, 7, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  1, 1, 'Footwork — technique', 'footwork',
  array[
      'net-footwork'
    ], 'Quality over pace. Stop the block if the movement gets scrappy.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  1, 2, 'Easy conditioning', 'conditioning',
  array[
      'agility-ladder-circuit'
    ], 'Comfortably hard. You should be able to speak in the rest.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  1, 3, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  1, 4, 'Footwork — volume', 'footwork',
  array[
      'net-footwork'
    ], 'Add a round rather than adding speed.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  1, 5, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  1, 6, 'Circuit', 'conditioning',
  array[
      'agility-ladder-circuit'
    ], null
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  1, 7, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  2, 1, 'Play', 'matchplay',
  '{}', 'Social games. Play, do not train — this is the fun one.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  2, 2, 'Footwork — technique', 'footwork',
  array[
      'net-footwork'
    ], null
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  2, 3, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  2, 4, 'Footwork — technique', 'footwork',
  array[
      'four-corner-footwork'
    ], 'Quality over pace. Stop the block if the movement gets scrappy.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  2, 5, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  2, 6, 'Easy conditioning', 'conditioning',
  array[
      'match-rhythm-intervals'
    ], 'Comfortably hard. You should be able to speak in the rest.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  2, 7, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  3, 1, 'Footwork — volume', 'footwork',
  array[
      'net-footwork'
    ], 'Add a round rather than adding speed.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  3, 2, 'Circuit', 'conditioning',
  array[
      'agility-ladder-circuit'
    ], null
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  3, 3, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  3, 4, 'Play', 'matchplay',
  '{}', 'Social games. Play, do not train — this is the fun one.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  3, 5, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  3, 6, 'Footwork — technique', 'footwork',
  array[
      'four-corner-footwork'
    ], null
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  3, 7, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  4, 1, 'Easy footwork', 'footwork',
  array[
      'four-corner-footwork'
    ], 'Half the usual rounds. Move well, do not chase the clock.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  4, 2, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  4, 3, 'Play for fun', 'matchplay',
  '{}', 'No score, no pressure.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  4, 4, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  4, 5, 'Light circuit', 'conditioning',
  array[
      'agility-ladder-circuit'
    ], 'One round fewer than you think you need.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  4, 6, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  4, 7, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  5, 1, 'Hard conditioning', 'conditioning',
  array[
      'rally-hiit'
    ], 'The one you will want to skip. Do it anyway.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  5, 2, 'Match play', 'matchplay',
  '{}', 'Competitive games. Notice where your movement breaks down first.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  5, 3, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  5, 4, 'Footwork — volume', 'footwork',
  array[
      'rear-court-scissor'
    ], null
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  5, 5, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  5, 6, 'Footwork under load', 'footwork',
  array[
      'four-corner-footwork'
    ], 'Hold your form into the last round. That is the whole session.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  5, 7, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  6, 1, 'Intervals', 'conditioning',
  array[
      'agility-ladder-circuit'
    ], 'Take the full rest. Cutting it short trains the wrong thing.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  6, 2, 'Reaction work', 'footwork',
  array[
      'deception-reaction'
    ], null
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  6, 3, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  6, 4, 'Hard conditioning', 'conditioning',
  array[
      'rally-hiit'
    ], 'The one you will want to skip. Do it anyway.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  6, 5, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  6, 6, 'Match play', 'matchplay',
  '{}', 'Competitive games. Notice where your movement breaks down first.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  6, 7, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  7, 1, 'Footwork — volume', 'footwork',
  array[
      'rear-court-scissor'
    ], null
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  7, 2, 'Footwork under load', 'footwork',
  array[
      'four-corner-footwork'
    ], 'Hold your form into the last round. That is the whole session.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  7, 3, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  7, 4, 'Intervals', 'conditioning',
  array[
      'agility-ladder-circuit'
    ], 'Take the full rest. Cutting it short trains the wrong thing.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  7, 5, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  7, 6, 'Reaction work', 'footwork',
  array[
      'deception-reaction'
    ], null
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  7, 7, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  8, 1, 'Easy footwork', 'footwork',
  array[
      'four-corner-footwork'
    ], null
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  8, 2, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  8, 3, 'Easy footwork', 'footwork',
  array[
      'net-footwork'
    ], 'Half the usual rounds. Move well, do not chase the clock.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  8, 4, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  8, 5, 'Play for fun', 'matchplay',
  '{}', 'No score, no pressure.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  8, 6, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  8, 7, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  9, 1, 'Speed and reaction', 'footwork',
  array[
      'tabata-shadow'
    ], 'Short and fast. Fully recovered before every block.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  9, 2, 'Sharp intervals', 'conditioning',
  array[
      'deception-reaction'
    ], 'Ten-second efforts. Empty the tank, then take the whole rest.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  9, 3, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  9, 4, 'Match play', 'matchplay',
  '{}', 'Play as if it counts. This is what the last weeks were for.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  9, 5, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  9, 6, 'Footwork — crisp', 'footwork',
  array[
      'six-corner-shadow'
    ], 'Cut the volume, keep the pace.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  9, 7, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  10, 1, 'Power circuit', 'conditioning',
  array[
      'match-rhythm-intervals'
    ], null
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  10, 2, 'Reaction work', 'footwork',
  array[
      'tabata-shadow'
    ], null
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  10, 3, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  10, 4, 'Speed and reaction', 'footwork',
  array[
      'deception-reaction'
    ], 'Short and fast. Fully recovered before every block.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  10, 5, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  10, 6, 'Sharp intervals', 'conditioning',
  array[
      'tabata-shadow'
    ], 'Ten-second efforts. Empty the tank, then take the whole rest.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  10, 7, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  11, 1, 'Match play', 'matchplay',
  '{}', 'Play as if it counts. This is what the last weeks were for.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  11, 2, 'Footwork — crisp', 'footwork',
  array[
      'six-corner-shadow'
    ], 'Cut the volume, keep the pace.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  11, 3, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  11, 4, 'Power circuit', 'conditioning',
  array[
      'rally-hiit'
    ], null
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  11, 5, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  11, 6, 'Reaction work', 'footwork',
  array[
      'deception-reaction'
    ], null
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  11, 7, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  12, 1, 'Light circuit', 'conditioning',
  array[
      'agility-ladder-circuit'
    ], 'One round fewer than you think you need.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  12, 2, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  12, 3, 'Easy footwork', 'footwork',
  array[
      'net-footwork'
    ], null
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  12, 4, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  12, 5, 'Easy footwork', 'footwork',
  array[
      'four-corner-footwork'
    ], 'Half the usual rounds. Move well, do not chase the clock.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  12, 6, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'rebuild-the-engine'),
  12, 7, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  1, 1, 'Footwork — technique', 'footwork',
  array[
      'match-rhythm-intervals'
    ], 'Quality over pace. Stop the block if the movement gets scrappy.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  1, 2, 'Easy conditioning', 'conditioning',
  array[
      'home-court-circuit'
    ], 'Comfortably hard. You should be able to speak in the rest.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  1, 3, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  1, 4, 'Footwork — volume', 'footwork',
  array[
      'match-rhythm-intervals'
    ], 'Add a round rather than adding speed.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  1, 5, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  1, 6, 'Circuit', 'conditioning',
  array[
      'home-court-circuit'
    ], null
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  1, 7, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  2, 1, 'Play', 'matchplay',
  '{}', 'Social games. Play, do not train — this is the fun one.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  2, 2, 'Footwork — technique', 'footwork',
  array[
      'match-rhythm-intervals'
    ], null
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  2, 3, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  2, 4, 'Footwork — technique', 'footwork',
  array[
      'match-rhythm-intervals'
    ], 'Quality over pace. Stop the block if the movement gets scrappy.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  2, 5, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  2, 6, 'Easy conditioning', 'conditioning',
  array[
      'agility-ladder-circuit'
    ], 'Comfortably hard. You should be able to speak in the rest.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  2, 7, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  3, 1, 'Footwork — volume', 'footwork',
  array[
      'match-rhythm-intervals'
    ], 'Add a round rather than adding speed.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  3, 2, 'Circuit', 'conditioning',
  array[
      'home-court-circuit'
    ], null
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  3, 3, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  3, 4, 'Play', 'matchplay',
  '{}', 'Social games. Play, do not train — this is the fun one.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  3, 5, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  3, 6, 'Footwork — technique', 'footwork',
  array[
      'match-rhythm-intervals'
    ], null
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  3, 7, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  4, 1, 'Easy footwork', 'footwork',
  array[
      'match-rhythm-intervals'
    ], 'Half the usual rounds. Move well, do not chase the clock.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  4, 2, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  4, 3, 'Play for fun', 'matchplay',
  '{}', 'No score, no pressure.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  4, 4, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  4, 5, 'Light circuit', 'conditioning',
  array[
      'home-court-circuit'
    ], 'One round fewer than you think you need.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  4, 6, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  4, 7, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  5, 1, 'Hard conditioning', 'conditioning',
  array[
      'plyometric-power-circuit'
    ], 'The one you will want to skip. Do it anyway.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  5, 2, 'Match play', 'matchplay',
  '{}', 'Competitive games. Notice where your movement breaks down first.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  5, 3, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  5, 4, 'Footwork — volume', 'footwork',
  array[
      'rally-hiit'
    ], null
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  5, 5, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  5, 6, 'Footwork under load', 'footwork',
  array[
      'match-rhythm-intervals'
    ], 'Hold your form into the last round. That is the whole session.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  5, 7, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  6, 1, 'Intervals', 'conditioning',
  array[
      'home-court-circuit'
    ], 'Take the full rest. Cutting it short trains the wrong thing.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  6, 2, 'Reaction work', 'footwork',
  array[
      'tabata-shadow'
    ], null
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  6, 3, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  6, 4, 'Hard conditioning', 'conditioning',
  array[
      'plyometric-power-circuit'
    ], 'The one you will want to skip. Do it anyway.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  6, 5, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  6, 6, 'Match play', 'matchplay',
  '{}', 'Competitive games. Notice where your movement breaks down first.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  6, 7, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  7, 1, 'Reaction work', 'footwork',
  array[
      'tabata-shadow'
    ], null
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  7, 2, 'Speed and reaction', 'footwork',
  array[
      'tabata-shadow'
    ], 'Short and fast. Fully recovered before every block.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  7, 3, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  7, 4, 'Sharp intervals', 'conditioning',
  array[
      'tabata-shadow'
    ], 'Ten-second efforts. Empty the tank, then take the whole rest.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  7, 5, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  7, 6, 'Match play', 'matchplay',
  '{}', 'Play as if it counts. This is what the last weeks were for.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  7, 7, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  8, 1, 'Easy footwork', 'footwork',
  array[
      'match-rhythm-intervals'
    ], null
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  8, 2, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  8, 3, 'Easy footwork', 'footwork',
  array[
      'match-rhythm-intervals'
    ], 'Half the usual rounds. Move well, do not chase the clock.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  8, 4, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  8, 5, 'Play for fun', 'matchplay',
  '{}', 'No score, no pressure.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  8, 6, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  8, 7, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  9, 1, 'Speed and reaction', 'footwork',
  array[
      'tabata-shadow'
    ], 'Short and fast. Fully recovered before every block.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  9, 2, 'Sharp intervals', 'conditioning',
  array[
      'tabata-shadow'
    ], 'Ten-second efforts. Empty the tank, then take the whole rest.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  9, 3, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  9, 4, 'Match play', 'matchplay',
  '{}', 'Play as if it counts. This is what the last weeks were for.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  9, 5, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  9, 6, 'Footwork — crisp', 'footwork',
  array[
      'rally-hiit'
    ], 'Cut the volume, keep the pace.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  9, 7, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  10, 1, 'Light circuit', 'conditioning',
  array[
      'home-court-circuit'
    ], 'One round fewer than you think you need.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  10, 2, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  10, 3, 'Easy footwork', 'footwork',
  array[
      'match-rhythm-intervals'
    ], null
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  10, 4, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  10, 5, 'Easy footwork', 'footwork',
  array[
      'match-rhythm-intervals'
    ], 'Half the usual rounds. Move well, do not chase the clock.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  10, 6, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'no-court-comeback'),
  10, 7, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'sharpen-for-season'),
  1, 1, 'Footwork — technique', 'footwork',
  array[
      'net-footwork'
    ], 'Quality over pace. Stop the block if the movement gets scrappy.'
),
(
  (select id from public.programs where slug = 'sharpen-for-season'),
  1, 2, 'Easy conditioning', 'conditioning',
  array[
      'agility-ladder-circuit'
    ], 'Comfortably hard. You should be able to speak in the rest.'
),
(
  (select id from public.programs where slug = 'sharpen-for-season'),
  1, 3, 'Footwork — volume', 'footwork',
  array[
      'net-footwork'
    ], 'Add a round rather than adding speed.'
),
(
  (select id from public.programs where slug = 'sharpen-for-season'),
  1, 4, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'sharpen-for-season'),
  1, 5, 'Circuit', 'conditioning',
  array[
      'agility-ladder-circuit'
    ], null
),
(
  (select id from public.programs where slug = 'sharpen-for-season'),
  1, 6, 'Play', 'matchplay',
  '{}', 'Social games. Play, do not train — this is the fun one.'
),
(
  (select id from public.programs where slug = 'sharpen-for-season'),
  1, 7, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'sharpen-for-season'),
  2, 1, 'Footwork — technique', 'footwork',
  array[
      'four-corner-footwork'
    ], null
),
(
  (select id from public.programs where slug = 'sharpen-for-season'),
  2, 2, 'Footwork — technique', 'footwork',
  array[
      'net-footwork'
    ], 'Quality over pace. Stop the block if the movement gets scrappy.'
),
(
  (select id from public.programs where slug = 'sharpen-for-season'),
  2, 3, 'Easy conditioning', 'conditioning',
  array[
      'agility-ladder-circuit'
    ], 'Comfortably hard. You should be able to speak in the rest.'
),
(
  (select id from public.programs where slug = 'sharpen-for-season'),
  2, 4, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'sharpen-for-season'),
  2, 5, 'Footwork — volume', 'footwork',
  array[
      'net-footwork'
    ], 'Add a round rather than adding speed.'
),
(
  (select id from public.programs where slug = 'sharpen-for-season'),
  2, 6, 'Circuit', 'conditioning',
  array[
      'agility-ladder-circuit'
    ], null
),
(
  (select id from public.programs where slug = 'sharpen-for-season'),
  2, 7, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'sharpen-for-season'),
  3, 1, 'Match play', 'matchplay',
  '{}', 'Competitive games. Notice where your movement breaks down first.'
),
(
  (select id from public.programs where slug = 'sharpen-for-season'),
  3, 2, 'Footwork — volume', 'footwork',
  array[
      'four-corner-footwork'
    ], null
),
(
  (select id from public.programs where slug = 'sharpen-for-season'),
  3, 3, 'Footwork under load', 'footwork',
  array[
      'net-footwork'
    ], 'Hold your form into the last round. That is the whole session.'
),
(
  (select id from public.programs where slug = 'sharpen-for-season'),
  3, 4, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'sharpen-for-season'),
  3, 5, 'Intervals', 'conditioning',
  array[
      'agility-ladder-circuit'
    ], 'Take the full rest. Cutting it short trains the wrong thing.'
),
(
  (select id from public.programs where slug = 'sharpen-for-season'),
  3, 6, 'Reaction work', 'footwork',
  array[
      'deception-reaction'
    ], null
),
(
  (select id from public.programs where slug = 'sharpen-for-season'),
  3, 7, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'sharpen-for-season'),
  4, 1, 'Easy footwork', 'footwork',
  array[
      'four-corner-footwork'
    ], null
),
(
  (select id from public.programs where slug = 'sharpen-for-season'),
  4, 2, 'Easy footwork', 'footwork',
  array[
      'net-footwork'
    ], 'Half the usual rounds. Move well, do not chase the clock.'
),
(
  (select id from public.programs where slug = 'sharpen-for-season'),
  4, 3, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'sharpen-for-season'),
  4, 4, 'Play for fun', 'matchplay',
  '{}', 'No score, no pressure.'
),
(
  (select id from public.programs where slug = 'sharpen-for-season'),
  4, 5, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'sharpen-for-season'),
  4, 6, 'Light circuit', 'conditioning',
  array[
      'match-rhythm-intervals'
    ], 'One round fewer than you think you need.'
),
(
  (select id from public.programs where slug = 'sharpen-for-season'),
  4, 7, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'sharpen-for-season'),
  5, 1, 'Intervals', 'conditioning',
  array[
      'rally-hiit'
    ], 'Take the full rest. Cutting it short trains the wrong thing.'
),
(
  (select id from public.programs where slug = 'sharpen-for-season'),
  5, 2, 'Reaction work', 'footwork',
  array[
      'multifeed-shadow'
    ], null
),
(
  (select id from public.programs where slug = 'sharpen-for-season'),
  5, 3, 'Hard conditioning', 'conditioning',
  array[
      'match-rhythm-intervals'
    ], 'The one you will want to skip. Do it anyway.'
),
(
  (select id from public.programs where slug = 'sharpen-for-season'),
  5, 4, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'sharpen-for-season'),
  5, 5, 'Match play', 'matchplay',
  '{}', 'Competitive games. Notice where your movement breaks down first.'
),
(
  (select id from public.programs where slug = 'sharpen-for-season'),
  5, 6, 'Footwork — volume', 'footwork',
  array[
      'net-footwork'
    ], null
),
(
  (select id from public.programs where slug = 'sharpen-for-season'),
  5, 7, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'sharpen-for-season'),
  6, 1, 'Speed and reaction', 'footwork',
  array[
      'deception-reaction'
    ], 'Short and fast. Fully recovered before every block.'
),
(
  (select id from public.programs where slug = 'sharpen-for-season'),
  6, 2, 'Sharp intervals', 'conditioning',
  array[
      'tabata-shadow'
    ], 'Ten-second efforts. Empty the tank, then take the whole rest.'
),
(
  (select id from public.programs where slug = 'sharpen-for-season'),
  6, 3, 'Match play', 'matchplay',
  '{}', 'Play as if it counts. This is what the last weeks were for.'
),
(
  (select id from public.programs where slug = 'sharpen-for-season'),
  6, 4, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'sharpen-for-season'),
  6, 5, 'Footwork — crisp', 'footwork',
  array[
      'rear-court-scissor'
    ], 'Cut the volume, keep the pace.'
),
(
  (select id from public.programs where slug = 'sharpen-for-season'),
  6, 6, 'Power circuit', 'conditioning',
  array[
      'match-rhythm-intervals'
    ], null
),
(
  (select id from public.programs where slug = 'sharpen-for-season'),
  6, 7, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'sharpen-for-season'),
  7, 1, 'Reaction work', 'footwork',
  array[
      'tabata-shadow'
    ], null
),
(
  (select id from public.programs where slug = 'sharpen-for-season'),
  7, 2, 'Speed and reaction', 'footwork',
  array[
      'deception-reaction'
    ], 'Short and fast. Fully recovered before every block.'
),
(
  (select id from public.programs where slug = 'sharpen-for-season'),
  7, 3, 'Sharp intervals', 'conditioning',
  array[
      'tabata-shadow'
    ], 'Ten-second efforts. Empty the tank, then take the whole rest.'
),
(
  (select id from public.programs where slug = 'sharpen-for-season'),
  7, 4, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'sharpen-for-season'),
  7, 5, 'Match play', 'matchplay',
  '{}', 'Play as if it counts. This is what the last weeks were for.'
),
(
  (select id from public.programs where slug = 'sharpen-for-season'),
  7, 6, 'Footwork — crisp', 'footwork',
  array[
      'rear-court-scissor'
    ], 'Cut the volume, keep the pace.'
),
(
  (select id from public.programs where slug = 'sharpen-for-season'),
  7, 7, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'sharpen-for-season'),
  8, 1, 'Light circuit', 'conditioning',
  array[
      'agility-ladder-circuit'
    ], 'One round fewer than you think you need.'
),
(
  (select id from public.programs where slug = 'sharpen-for-season'),
  8, 2, 'Easy footwork', 'footwork',
  array[
      'net-footwork'
    ], null
),
(
  (select id from public.programs where slug = 'sharpen-for-season'),
  8, 3, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'sharpen-for-season'),
  8, 4, 'Easy footwork', 'footwork',
  array[
      'four-corner-footwork'
    ], 'Half the usual rounds. Move well, do not chase the clock.'
),
(
  (select id from public.programs where slug = 'sharpen-for-season'),
  8, 5, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
),
(
  (select id from public.programs where slug = 'sharpen-for-season'),
  8, 6, 'Play for fun', 'matchplay',
  '{}', 'No score, no pressure.'
),
(
  (select id from public.programs where slug = 'sharpen-for-season'),
  8, 7, 'Rest', 'rest',
  '{}', 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.'
)
on conflict (program_id, week_no, day_no) do update set
  title       = excluded.title,
  focus       = excluded.focus,
  drill_slugs = excluded.drill_slugs,
  notes       = excluded.notes;
-- <<< end generated program seed

--  Mirrors src/lib/data/badges.ts. Tiers are segmented on purpose: a beginner
--  always has a bronze within reach and a returning competitor still has a
--  gold to chase.
insert into public.badges (slug, name, description, icon, tier) values
  ('getting-started', 'Getting Started',    'Set your level and discipline.',              'flag',           'bronze'),
  ('first-session',   'First Steps',        'Complete your first session.',                'footprints',     'bronze'),
  ('week-one',        'Week One Down',      'Train twice in a single week.',               'calendar-check', 'bronze'),
  ('benchmarked',     'Know Your Number',   'Take the fitness benchmark.',                 'gauge',          'silver'),
  ('streak-4',        'Four in a Row',      'Four consecutive weeks with a session.',      'flame',          'silver'),
  ('thousand-calls',  'A Thousand Corners', 'Answer 1,000 corner calls.',                  'target',         'silver'),
  ('streak-12',       'Season Builder',     'Twelve consecutive weeks with a session.',    'trophy',         'gold'),
  ('deception-pro',   'Never Wrong-Footed', 'Complete ten Deception sessions.',            'shuffle',        'gold'),
  ('ten-hours',       'Ten Hours In',       'Ten hours of logged training.',               'hourglass',      'gold')
on conflict (slug) do update set
  name        = excluded.name,
  description = excluded.description,
  icon        = excluded.icon,
  tier        = excluded.tier;
