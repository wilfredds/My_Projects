import type {
  Benchmark,
  NewBenchmark,
  NewReadinessCheck,
  NewSession,
  NewSessionMetric,
  Profile,
  ReadinessCheck,
  Session,
  SessionMetric,
} from './types'

import { localDateKey } from './streaks'

/**
 * Getting your training out of the app, and back in again.
 *
 * Without an account everything lives in one browser's local storage, which is
 * scoped to a single origin — change the domain, clear your browsing data, or
 * lose the phone and months of sessions are simply gone. This is the way out,
 * and it needs no backend to work.
 *
 * Pure functions over plain data: no storage, no DOM, no repositories, so the
 * merge rules are unit-tested rather than trusted.
 */

/**
 * 2 added the daily readiness check-ins. Older files still import — the parser
 * only refuses a file from a *newer* build than the one reading it.
 */
export const BACKUP_VERSION = 2

export interface BackupSession {
  session: Session
  metrics: SessionMetric[]
}

export interface BackupFile {
  /** Stamped so a stray JSON file cannot be mistaken for a backup. */
  app: 'rallyready'
  version: number
  exportedAt: string
  profile: Profile | null
  sessions: BackupSession[]
  benchmarks: Benchmark[]
  readiness: ReadinessCheck[]
}

export function buildBackup(input: {
  profile: Profile | null
  sessions: Session[]
  metrics: SessionMetric[]
  benchmarks: Benchmark[]
  readiness?: ReadinessCheck[]
  now?: Date
}): BackupFile {
  const bySession = new Map<string, SessionMetric[]>()
  for (const metric of input.metrics) {
    const list = bySession.get(metric.sessionId)
    if (list) list.push(metric)
    else bySession.set(metric.sessionId, [metric])
  }

  return {
    app: 'rallyready',
    version: BACKUP_VERSION,
    exportedAt: (input.now ?? new Date()).toISOString(),
    profile: input.profile,
    sessions: input.sessions.map((session) => ({
      session,
      metrics: bySession.get(session.id) ?? [],
    })),
    benchmarks: input.benchmarks,
    readiness: input.readiness ?? [],
  }
}

export type ParseResult = { ok: true; file: BackupFile } | { ok: false; error: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Deliberately forgiving about extra fields and strict about the ones that
 * decide whether this is a RallyReady backup at all. Restoring the wrong file
 * over someone's training history is not a recoverable mistake.
 */
export function parseBackup(text: string): ParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: 'That is not a valid JSON file.' }
  }

  if (!isRecord(raw)) return { ok: false, error: 'That file does not contain a backup.' }
  if (raw.app !== 'rallyready') {
    return { ok: false, error: 'That backup was not exported from RallyReady.' }
  }
  if (typeof raw.version !== 'number' || raw.version > BACKUP_VERSION) {
    return {
      ok: false,
      error: 'That backup came from a newer version of RallyReady than this one.',
    }
  }
  if (!Array.isArray(raw.sessions)) {
    return { ok: false, error: 'That backup is missing its sessions.' }
  }

  const sessions: BackupSession[] = []
  for (const entry of raw.sessions) {
    if (!isRecord(entry) || !isRecord(entry.session)) continue
    const session = entry.session as unknown as Session
    // A session with no start time cannot be de-duplicated or charted.
    if (typeof session.startedAt !== 'string') continue
    if (typeof session.durationSec !== 'number') continue
    sessions.push({
      session,
      metrics: Array.isArray(entry.metrics) ? (entry.metrics as SessionMetric[]) : [],
    })
  }

  return {
    ok: true,
    file: {
      app: 'rallyready',
      version: raw.version,
      exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
      profile: isRecord(raw.profile) ? (raw.profile as unknown as Profile) : null,
      sessions,
      benchmarks: Array.isArray(raw.benchmarks) ? (raw.benchmarks as Benchmark[]) : [],
      readiness: Array.isArray(raw.readiness)
        ? raw.readiness.filter(
            (entry): entry is ReadinessCheck => isRecord(entry) && typeof entry.date === 'string',
          )
        : [],
    },
  }
}

/**
 * Identity for de-duplication. Two sessions that started at the same instant on
 * the same drill are the same session — importing the same file twice, or a
 * file that overlaps what you already have, must not double your history.
 */
function sessionKey(session: Pick<Session, 'startedAt' | 'drillId'>): string {
  return `${session.startedAt}|${session.drillId ?? ''}`
}

export interface RestorePlan {
  sessions: { input: NewSession; metrics: NewSessionMetric[] }[]
  benchmarks: NewBenchmark[]
  readiness: NewReadinessCheck[]
  profile: Profile | null
  skippedSessions: number
  skippedBenchmarks: number
  skippedReadiness: number
}

/**
 * Works out what a restore would actually add, given what is already stored.
 * Merges rather than replaces: an import should never delete training you did
 * on this device but not on the one the backup came from.
 */
export function planRestore(
  file: BackupFile,
  existing: { sessions: Session[]; benchmarks: Benchmark[]; readiness?: ReadinessCheck[] },
): RestorePlan {
  const haveSessions = new Set(existing.sessions.map(sessionKey))
  const haveBenchmarks = new Set(
    existing.benchmarks.map((benchmark) => `${benchmark.takenAt}|${benchmark.testType}`),
  )

  const sessions: RestorePlan['sessions'] = []
  let skippedSessions = 0
  for (const { session, metrics } of file.sessions) {
    if (haveSessions.has(sessionKey(session))) {
      skippedSessions += 1
      continue
    }
    haveSessions.add(sessionKey(session))
    sessions.push({
      input: {
        drillId: session.drillId ?? null,
        drillName: session.drillName ?? null,
        startedAt: new Date(session.startedAt),
        durationSec: session.durationSec,
        roundsCompleted: session.roundsCompleted ?? 0,
        avgShotIntervalMs: session.avgShotIntervalMs ?? null,
        notes: session.notes ?? null,
        source: session.source ?? 'timer',
      },
      metrics: metrics.map((metric) => ({
        metricKey: metric.metricKey,
        metricValue: metric.metricValue,
      })),
    })
  }

  const benchmarks: NewBenchmark[] = []
  let skippedBenchmarks = 0
  for (const benchmark of file.benchmarks) {
    const key = `${benchmark.takenAt}|${benchmark.testType}`
    if (haveBenchmarks.has(key)) {
      skippedBenchmarks += 1
      continue
    }
    haveBenchmarks.add(key)
    benchmarks.push({
      testType: benchmark.testType,
      takenAt: new Date(benchmark.takenAt),
      score: benchmark.score,
      levelReached: benchmark.levelReached ?? null,
      raw: benchmark.raw ?? {},
    })
  }

  // A check-in already recorded for a day is the one that was actually given
  // that morning; a backup restored over it would be a stale second opinion.
  const haveDates = new Set((existing.readiness ?? []).map((check) => check.date))
  const readiness: NewReadinessCheck[] = []
  let skippedReadiness = 0
  for (const check of file.readiness) {
    if (haveDates.has(check.date)) {
      skippedReadiness += 1
      continue
    }
    haveDates.add(check.date)
    readiness.push({
      date: check.date,
      sleep: check.sleep,
      soreness: check.soreness,
      energy: check.energy,
    })
  }

  return {
    sessions,
    benchmarks,
    readiness,
    // Only offered when there is nothing to overwrite.
    profile: file.profile,
    skippedSessions,
    skippedBenchmarks,
    skippedReadiness,
  }
}

/**
 * A filename someone can find again in six months, dated the day they made
 * it — the local day, not UTC's, which in Manila is still yesterday until 8am.
 */
export function backupFilename(now = new Date()): string {
  return `rallyready-backup-${localDateKey(now)}.json`
}
