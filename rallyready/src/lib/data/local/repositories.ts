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
import { SEED_DRILLS, findSeedDrill } from '../seed/drills'
import { computeStreak, localDateKey } from '../streaks'
import type {
  Benchmark,
  NewBenchmark,
  NewSession,
  NewSessionMetric,
  Profile,
  ReadinessCheck,
  Session,
  SessionMetric,
  Streak,
} from '../types'
import { localPrograms } from './programs'
import { newId, readJson, STORAGE_KEYS, writeJson } from './storage'

/**
 * The offline / signed-out backend.
 *
 * This is the active repository set for Phase 1 and the permanent fallback
 * afterwards: RallyReady has to work on a dead connection in a garage, and
 * nothing about training solo requires an account.
 */

const drills: DrillRepository = {
  async list() {
    return SEED_DRILLS
  },
  async getBySlug(slug) {
    return findSeedDrill(slug) ?? null
  },
  async getById(id) {
    // Locally a drill's id is its slug — there is no server to allocate uuids.
    return findSeedDrill(id) ?? null
  },
}

function loadSessions(): Session[] {
  return readJson<Session[]>(STORAGE_KEYS.sessions, [])
}

function loadMetrics(): Record<string, SessionMetric[]> {
  return readJson<Record<string, SessionMetric[]>>(STORAGE_KEYS.metrics, {})
}

function loadReadiness(): ReadinessCheck[] {
  return readJson<ReadinessCheck[]>(STORAGE_KEYS.readiness, [])
}

const sessions: SessionRepository = {
  async create(input: NewSession, metrics: NewSessionMetric[] = []) {
    const session: Session = {
      id: newId(),
      userId: null,
      drillId: input.drillId,
      drillName: input.drillName,
      startedAt: input.startedAt.toISOString(),
      durationSec: input.durationSec,
      roundsCompleted: input.roundsCompleted,
      avgShotIntervalMs: input.avgShotIntervalMs,
      notes: input.notes ?? null,
      source: input.source,
    }

    /*
     * Newest first: every read path wants recent sessions.
     *
     * A refused write has to be an error rather than a shrug. Returning the
     * session anyway sent the runner to `/session/<id>` for a session that was
     * never stored, so somebody who had just finished a full drill in private
     * browsing was shown "Session not found" — the worst possible answer to
     * forty minutes of work. The caller catches this and goes somewhere that
     * explains itself instead.
     */
    if (!writeJson(STORAGE_KEYS.sessions, [session, ...loadSessions()])) {
      throw new Error('This browser would not let RallyReady save the session.')
    }

    if (metrics.length > 0) {
      const store = loadMetrics()
      store[session.id] = metrics.map((metric) => ({
        id: newId(),
        sessionId: session.id,
        metricKey: metric.metricKey,
        metricValue: metric.metricValue,
      }))
      writeJson(STORAGE_KEYS.metrics, store)
    }

    return session
  },

  async setMetric(sessionId, metricKey, metricValue) {
    const store = loadMetrics()
    const existing = store[sessionId] ?? []
    const index = existing.findIndex((metric) => metric.metricKey === metricKey)
    const row: SessionMetric = {
      id: existing[index]?.id ?? newId(),
      sessionId,
      metricKey,
      metricValue,
    }
    // Replace in place so re-rating a session corrects it rather than logging
    // a second opinion that the reader would have to pick between.
    store[sessionId] =
      index === -1
        ? [...existing, row]
        : existing.map((metric, at) => (at === index ? row : metric))
    writeJson(STORAGE_KEYS.metrics, store)
  },

  async getById(id) {
    return loadSessions().find((session) => session.id === id) ?? null
  },

  async listRecent(limit = 20) {
    return loadSessions().slice(0, limit)
  },

  async listMetrics(sessionId) {
    return loadMetrics()[sessionId] ?? []
  },

  async listAllMetrics() {
    return Object.values(loadMetrics()).flat()
  },

  async listSessionDates() {
    return loadSessions()
      .map((session) => localDateKey(new Date(session.startedAt)))
      .sort()
  },
}

const benchmarks: BenchmarkRepository = {
  async create(input: NewBenchmark) {
    const benchmark: Benchmark = {
      id: newId(),
      userId: null,
      testType: input.testType,
      takenAt: input.takenAt.toISOString(),
      score: input.score,
      levelReached: input.levelReached,
      raw: input.raw ?? {},
    }
    writeJson(STORAGE_KEYS.benchmarks, [
      benchmark,
      ...readJson<Benchmark[]>(STORAGE_KEYS.benchmarks, []),
    ])
    return benchmark
  },

  async list(testType) {
    const all = readJson<Benchmark[]>(STORAGE_KEYS.benchmarks, [])
    return testType ? all.filter((entry) => entry.testType === testType) : all
  },

  async getById(id) {
    return readJson<Benchmark[]>(STORAGE_KEYS.benchmarks, []).find((b) => b.id === id) ?? null
  },
}

const badges: BadgeRepository = {
  async listEarned() {
    return readJson<string[]>(STORAGE_KEYS.badges, [])
  },
  async award(slugs) {
    if (slugs.length === 0) return
    const existing = readJson<string[]>(STORAGE_KEYS.badges, [])
    writeJson(STORAGE_KEYS.badges, [...new Set([...existing, ...slugs])])
  },
}

const streaks: StreakRepository = {
  async get(): Promise<Streak> {
    return computeStreak(await sessions.listSessionDates())
  },
}

const readiness: ReadinessRepository = {
  async today(date) {
    return loadReadiness().find((check) => check.date === date) ?? null
  },

  async save(input) {
    const check: ReadinessCheck = {
      id: newId(),
      userId: null,
      date: input.date,
      createdAt: new Date().toISOString(),
      sleep: input.sleep,
      soreness: input.soreness,
      energy: input.energy,
    }
    // One check per day: answering again is changing your mind, not adding a
    // second data point, and two rows for one morning would skew the trend.
    const rest = loadReadiness().filter((existing) => existing.date !== input.date)
    writeJson(STORAGE_KEYS.readiness, [check, ...rest])
    return check
  },

  async listRecent(limit = 30) {
    return loadReadiness()
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, limit)
  },
}

const profiles: ProfileRepository = {
  async get() {
    return readJson<Profile | null>(STORAGE_KEYS.profile, null)
  },
  async save(patch) {
    const existing = readJson<Profile | null>(STORAGE_KEYS.profile, null)
    const profile: Profile = {
      id: existing?.id ?? newId(),
      displayName: patch.displayName ?? existing?.displayName ?? 'Player',
      avatarUrl: patch.avatarUrl ?? existing?.avatarUrl ?? null,
      skillLevel: patch.skillLevel ?? existing?.skillLevel ?? 'intermediate',
      primaryDiscipline: patch.primaryDiscipline ?? existing?.primaryDiscipline ?? 'both',
      goal: patch.goal ?? existing?.goal ?? 'footwork',
      courtAccess: patch.courtAccess ?? existing?.courtAccess ?? 'court',
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    }
    writeJson(STORAGE_KEYS.profile, profile)
    return profile
  },
}

export function createLocalRepositories(): Repositories {
  return {
    drills,
    sessions,
    streaks,
    profiles,
    benchmarks,
    badges,
    programs: localPrograms,
    readiness,
    backend: 'local',
  }
}
