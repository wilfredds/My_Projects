import type { RallyReadyClient } from '@/lib/supabase/client'
import type { CourtLayout } from '@/lib/timer/corners'

import type {
  BadgeRepository,
  BenchmarkRepository,
  DrillRepository,
  ProfileRepository,
  ReadinessRepository,
  Repositories,
  SessionRepository,
  StreakRepository,
} from '../ports'
import { computeStreak, localDateKey } from '../streaks'
import { createSupabasePrograms } from './programs'
import type {
  Benchmark,
  Drill,
  NewBenchmark,
  NewSession,
  NewSessionMetric,
  Profile,
  ReadinessCheck,
  Session,
  SessionMetric,
} from '../types'
import type {
  BenchmarkRow,
  DrillRow,
  ProfileRow,
  ReadinessCheckRow,
  SessionMetricRow,
  SessionRow,
} from './database.types'

/**
 * The signed-in backend. Row-Level Security (see `supabase/schema.sql`) is what
 * actually scopes these queries to the current user; the `user_id` filters here
 * are belt-and-braces and keep the intent readable.
 */

function toDrill(row: DrillRow): Drill {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    style: row.mode,
    description: row.description,
    coachingCues: row.coaching_cues ?? [],
    commonFaults: row.common_faults ?? [],
    defaultWorkSec: row.default_work_sec,
    defaultRestSec: row.default_rest_sec,
    defaultRounds: row.default_rounds,
    corners: row.corners as CourtLayout,
    videoUrl: row.video_url,
    isPublic: row.is_public,
    createdBy: row.created_by,
    defaultIntervalMs: row.default_interval_ms,
    defaultCallMode: row.default_call_mode,
    enabledCorners: row.enabled_corners,
    defaultWarmupSec: row.default_warmup_sec,
    defaultCooldownSec: row.default_cooldown_sec,
    level: row.level,
    discipline: row.discipline ?? 'both',
    patternIds: row.pattern_ids ?? [],
    circuit: row.circuit?.length ? row.circuit : null,
    circuitRounds: row.circuit_rounds,
    location: row.location,
    equipment: row.equipment ?? [],
  }
}

function toSession(row: SessionRow): Session {
  return {
    id: row.id,
    userId: row.user_id,
    drillId: row.drill_id,
    drillName: row.drill_name,
    startedAt: row.started_at,
    durationSec: row.duration_sec,
    roundsCompleted: row.rounds_completed,
    avgShotIntervalMs: row.avg_shot_interval_ms,
    notes: row.notes,
    source: row.source,
  }
}

function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    skillLevel: row.skill_level,
    primaryDiscipline: row.primary_discipline,
    goal: row.goal,
    courtAccess: row.court_access,
    createdAt: row.created_at,
  }
}

function toMetric(row: SessionMetricRow): SessionMetric {
  return {
    id: row.id,
    sessionId: row.session_id,
    metricKey: row.metric_key,
    metricValue: row.metric_value,
  }
}

function toReadiness(row: ReadinessCheckRow): ReadinessCheck {
  return {
    id: row.id,
    userId: row.user_id,
    date: row.date,
    createdAt: row.created_at,
    sleep: row.sleep,
    soreness: row.soreness,
    energy: row.energy,
  }
}

function toBenchmark(row: BenchmarkRow): Benchmark {
  return {
    id: row.id,
    userId: row.user_id,
    testType: row.test_type,
    takenAt: row.taken_at,
    score: Number(row.score),
    levelReached: row.level_reached,
    raw: row.raw ?? {},
  }
}

function fail(context: string, error: { message: string } | null): void {
  if (error) throw new Error(`${context}: ${error.message}`)
}

export function createSupabaseRepositories(client: RallyReadyClient, userId: string): Repositories {
  const drills: DrillRepository = {
    async list() {
      // RLS already limits this to public drills plus the user's own.
      const { data, error } = await client.from('drills').select('*').order('name')
      fail('Could not load drills', error)
      return (data ?? []).map(toDrill)
    },
    async getBySlug(slug) {
      const { data, error } = await client.from('drills').select('*').eq('slug', slug).maybeSingle()
      fail('Could not load drill', error)
      return data ? toDrill(data) : null
    },
    async getById(id) {
      const { data, error } = await client.from('drills').select('*').eq('id', id).maybeSingle()
      fail('Could not load drill', error)
      return data ? toDrill(data) : null
    },
  }

  const sessions: SessionRepository = {
    async create(input: NewSession, metrics: NewSessionMetric[] = []) {
      const { data, error } = await client
        .from('sessions')
        .insert({
          user_id: userId,
          drill_id: input.drillId,
          drill_name: input.drillName,
          started_at: input.startedAt.toISOString(),
          duration_sec: input.durationSec,
          rounds_completed: input.roundsCompleted,
          avg_shot_interval_ms: input.avgShotIntervalMs,
          notes: input.notes ?? null,
          source: input.source,
        })
        .select('*')
        .single()
      fail('Could not save session', error)
      if (!data) throw new Error('Could not save session: no row returned')

      if (metrics.length > 0) {
        const { error: metricError } = await client.from('session_metrics').insert(
          metrics.map((metric) => ({
            session_id: data.id,
            metric_key: metric.metricKey,
            metric_value: metric.metricValue,
          })),
        )
        fail('Could not save session metrics', metricError)
      }

      return toSession(data)
    },

    async setMetric(sessionId, metricKey, metricValue) {
      // Upsert on (session_id, metric_key) — see the unique index in
      // schema.sql. Rating a session twice corrects it rather than duplicating.
      const { error } = await client
        .from('session_metrics')
        .upsert(
          { session_id: sessionId, metric_key: metricKey, metric_value: metricValue },
          { onConflict: 'session_id,metric_key' },
        )
      fail('Could not save session metric', error)
    },

    async getById(id) {
      const { data, error } = await client.from('sessions').select('*').eq('id', id).maybeSingle()
      fail('Could not load session', error)
      return data ? toSession(data) : null
    },

    async listRecent(limit = 20) {
      const { data, error } = await client
        .from('sessions')
        .select('*')
        .eq('user_id', userId)
        .order('started_at', { ascending: false })
        .limit(limit)
      fail('Could not load sessions', error)
      return (data ?? []).map(toSession)
    },

    async listMetrics(sessionId) {
      const { data, error } = await client
        .from('session_metrics')
        .select('*')
        .eq('session_id', sessionId)
      fail('Could not load session metrics', error)
      return (data ?? []).map(toMetric)
    },

    async listAllMetrics() {
      // RLS scopes session_metrics through its parent session, so this is
      // already limited to rows this user owns.
      const { data, error } = await client.from('session_metrics').select('*')
      fail('Could not load session metrics', error)
      return (data ?? []).map(toMetric)
    },

    async listSessionDates() {
      const { data, error } = await client
        .from('sessions')
        .select('started_at')
        .eq('user_id', userId)
        .order('started_at', { ascending: true })
      fail('Could not load session history', error)
      return (data ?? []).map((row) => localDateKey(new Date(row.started_at)))
    },
  }

  const benchmarks: BenchmarkRepository = {
    async create(input: NewBenchmark) {
      const { data, error } = await client
        .from('benchmarks')
        .insert({
          user_id: userId,
          test_type: input.testType,
          taken_at: input.takenAt.toISOString(),
          score: input.score,
          level_reached: input.levelReached,
          raw: input.raw ?? {},
        })
        .select('*')
        .single()
      fail('Could not save benchmark', error)
      if (!data) throw new Error('Could not save benchmark: no row returned')
      return toBenchmark(data)
    },

    async list(testType) {
      let query = client
        .from('benchmarks')
        .select('*')
        .eq('user_id', userId)
        .order('taken_at', { ascending: false })
      if (testType) query = query.eq('test_type', testType)
      const { data, error } = await query
      fail('Could not load benchmarks', error)
      return (data ?? []).map(toBenchmark)
    },

    async getById(id) {
      const { data, error } = await client.from('benchmarks').select('*').eq('id', id).maybeSingle()
      fail('Could not load benchmark', error)
      return data ? toBenchmark(data) : null
    },
  }

  const badges: BadgeRepository = {
    async listEarned() {
      const { data, error } = await client
        .from('user_badges')
        .select('badge_id, badges(slug)')
        .eq('user_id', userId)
      fail('Could not load badges', error)
      // The embedded row comes back as an object (or null for a broken fk).
      return (data ?? [])
        .map((row) => (row as { badges?: { slug?: string } | null }).badges?.slug)
        .filter((slug): slug is string => typeof slug === 'string')
    },

    async award(slugs) {
      if (slugs.length === 0) return
      const { data: definitions, error: lookupError } = await client
        .from('badges')
        .select('id, slug')
        .in('slug', slugs)
      fail('Could not look up badges', lookupError)
      if (!definitions || definitions.length === 0) return

      const { error } = await client.from('user_badges').upsert(
        definitions.map((definition) => ({ user_id: userId, badge_id: definition.id })),
        { onConflict: 'user_id,badge_id', ignoreDuplicates: true },
      )
      fail('Could not award badges', error)
    },
  }

  const streaks: StreakRepository = {
    async get() {
      // Derived from the session history for the same reason as the local
      // backend: a counter can drift, a projection cannot. The `streaks` row is
      // then refreshed so the value is queryable server-side too.
      const streak = computeStreak(await sessions.listSessionDates())
      await client.from('streaks').upsert(
        {
          user_id: userId,
          current_streak: streak.currentStreak,
          longest_streak: streak.longestStreak,
          last_active_date: streak.lastActiveDate,
          weekly_sessions_count: streak.weeklySessionsCount,
        },
        { onConflict: 'user_id' },
      )
      return streak
    },
  }

  const readiness: ReadinessRepository = {
    async today(date) {
      const { data, error } = await client
        .from('readiness_checks')
        .select('*')
        .eq('user_id', userId)
        .eq('date', date)
        .maybeSingle()
      fail('Could not load your check-in', error)
      return data ? toReadiness(data) : null
    },

    async save(input) {
      const { data, error } = await client
        .from('readiness_checks')
        .upsert(
          {
            user_id: userId,
            date: input.date,
            sleep: input.sleep,
            soreness: input.soreness,
            energy: input.energy,
          },
          { onConflict: 'user_id,date' },
        )
        .select('*')
        .single()
      fail('Could not save your check-in', error)
      if (!data) throw new Error('Could not save your check-in: no row returned')
      return toReadiness(data)
    },

    async listRecent(limit = 30) {
      const { data, error } = await client
        .from('readiness_checks')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(limit)
      fail('Could not load your check-ins', error)
      return (data ?? []).map(toReadiness)
    },
  }

  const profiles: ProfileRepository = {
    async get() {
      const { data, error } = await client
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()
      fail('Could not load profile', error)
      return data ? toProfile(data) : null
    },
    async save(patch) {
      // The signup trigger already created the row, so merge rather than
      // clobber: an update that only changes the goal must keep the name.
      const existing = await this.get()
      const { data, error } = await client
        .from('profiles')
        .upsert({
          id: userId,
          display_name: patch.displayName ?? existing?.displayName ?? 'Player',
          avatar_url: patch.avatarUrl ?? existing?.avatarUrl ?? null,
          skill_level: patch.skillLevel ?? existing?.skillLevel ?? 'intermediate',
          primary_discipline: patch.primaryDiscipline ?? existing?.primaryDiscipline ?? 'both',
          goal: patch.goal ?? existing?.goal ?? 'footwork',
          court_access: patch.courtAccess ?? existing?.courtAccess ?? 'court',
        })
        .select('*')
        .single()
      fail('Could not save profile', error)
      if (!data) throw new Error('Could not save profile: no row returned')
      return toProfile(data)
    },
  }

  return {
    drills,
    sessions,
    streaks,
    profiles,
    benchmarks,
    badges,
    programs: createSupabasePrograms(client, userId),
    readiness,
    backend: 'supabase',
  }
}
