import { rpeBySession, sessionLoad } from './load'
import { localDateKey, weekIndex, weekIndexFromKey, weekLabel, weekStartKey } from './streaks'
import type { Session, SessionMetric, SkillLevel } from './types'

/**
 * Every derived number the Progress dashboard and the badge engine need,
 * computed in one pure pass over the raw rows.
 *
 * Deriving rather than storing means the dashboard can never disagree with the
 * session list that produced it, and the whole thing is testable without a
 * database.
 */

export const METRIC_CALLS = 'calls_answered'
export const METRIC_COMPLETED = 'completed'
export const METRIC_DECEPTION = 'deception'
export const METRIC_BENCHMARK_LEVEL = 'benchmark_level'

/**
 * Enough to replay a session exactly, for challenges. The engine is
 * seed-deterministic, so these numbers reproduce the identical corner order on
 * somebody else's phone.
 *
 * The level is here because it is not a preference, it is part of the session:
 * it decides which shots the caller may ask for and which rally patterns run,
 * so the same seed at a different level is a different drill. Recorded rather
 * than read back from the profile, because the profile can change between
 * finishing a session and sharing it.
 */
export const METRIC_SEED = 'seed'
export const METRIC_ROUNDS = 'cfg_rounds'
export const METRIC_WORK_SEC = 'cfg_work'
export const METRIC_REST_SEC = 'cfg_rest'
export const METRIC_INTERVAL_MS = 'cfg_interval'
/** Stored as an index into `LEVEL_ORDER`, because a metric is a number. */
export const METRIC_LEVEL = 'cfg_level'

/** The one place the level-to-number mapping lives; a challenge code uses it too. */
export const LEVEL_ORDER: SkillLevel[] = ['beginner', 'intermediate', 'advanced']

export function levelIndex(level: SkillLevel): number {
  return Math.max(0, LEVEL_ORDER.indexOf(level))
}

export function levelFromIndex(index: number | null | undefined): SkillLevel {
  // Intermediate is the level every drill's defaults are written at, so it is
  // what an unknown or missing index means rather than a failure.
  return (index === null || index === undefined ? undefined : LEVEL_ORDER[index]) ?? 'intermediate'
}

export interface WeeklyBucket {
  weekIndex: number
  /** Monday of the week, `YYYY-MM-DD`. */
  weekStart: string
  label: string
  sessions: number
  minutes: number
  calls: number
  /** Effort × minutes, summed. See `load.ts` for why minutes are not enough. */
  load: number
}

export interface DrillStats {
  drillId: string
  drillName: string
  sessions: number
  /** Most calls answered in a single session. */
  bestCalls: number
  /** Fastest sustained shot interval achieved, in ms. */
  bestIntervalMs: number | null
  totalSec: number
  lastTrainedAt: string
}

export interface IntervalPoint {
  at: number
  date: string
  intervalMs: number
}

export interface TrainingStats {
  sessionCount: number
  totalTrainingSec: number
  totalCalls: number
  totalRounds: number
  /** Sessions run in Deception mode. */
  deceptionSessions: number
  /** Most sessions logged in any single week, ever. */
  bestWeeklySessions: number
  weekly: WeeklyBucket[]
  perDrill: DrillStats[]
  /** Fastest average interval per session, oldest first — the pace trend. */
  intervalTrend: IntervalPoint[]
}

export const EMPTY_STATS: TrainingStats = {
  sessionCount: 0,
  totalTrainingSec: 0,
  totalCalls: 0,
  totalRounds: 0,
  deceptionSessions: 0,
  bestWeeklySessions: 0,
  weekly: [],
  perDrill: [],
  intervalTrend: [],
}

function metricsBySession(metrics: SessionMetric[]): Map<string, Map<string, number>> {
  const map = new Map<string, Map<string, number>>()
  for (const metric of metrics) {
    let entry = map.get(metric.sessionId)
    if (!entry) {
      entry = new Map()
      map.set(metric.sessionId, entry)
    }
    entry.set(metric.metricKey, metric.metricValue)
  }
  return map
}

/**
 * @param weeksBack how many weekly buckets to emit, ending with the current
 *                  week. Empty weeks are included so the chart shows the gaps.
 */
export function computeStats(
  sessions: Session[],
  metrics: SessionMetric[],
  today: Date = new Date(),
  weeksBack = 12,
): TrainingStats {
  if (sessions.length === 0) {
    return { ...EMPTY_STATS, weekly: emptyWeeks(today, weeksBack) }
  }

  const byId = metricsBySession(metrics)
  const currentWeek = weekIndex(today)

  const rpes = rpeBySession(metrics)
  const weekCounts = new Map<
    number,
    { sessions: number; seconds: number; calls: number; load: number }
  >()
  const drills = new Map<string, DrillStats>()
  const intervalTrend: IntervalPoint[] = []

  let totalTrainingSec = 0
  let totalCalls = 0
  let totalRounds = 0
  let deceptionSessions = 0

  for (const session of sessions) {
    const own = byId.get(session.id)
    const calls = own?.get(METRIC_CALLS) ?? 0
    const startedAt = new Date(session.startedAt)
    const dateKey = localDateKey(startedAt)
    const week = weekIndexFromKey(dateKey)

    totalTrainingSec += session.durationSec
    totalCalls += calls
    totalRounds += session.roundsCompleted
    if (own?.get(METRIC_DECEPTION) === 1) deceptionSessions += 1

    const bucket = weekCounts.get(week) ?? { sessions: 0, seconds: 0, calls: 0, load: 0 }
    bucket.sessions += 1
    bucket.seconds += session.durationSec
    bucket.calls += calls
    bucket.load += sessionLoad(session.durationSec, rpes.get(session.id) ?? null)
    weekCounts.set(week, bucket)

    if (session.avgShotIntervalMs && session.avgShotIntervalMs > 0) {
      intervalTrend.push({
        at: startedAt.getTime(),
        date: dateKey,
        intervalMs: session.avgShotIntervalMs,
      })
    }

    const key = session.drillId ?? session.drillName ?? 'custom'
    const existing = drills.get(key)
    if (!existing) {
      drills.set(key, {
        drillId: key,
        drillName: session.drillName ?? 'Custom drill',
        sessions: 1,
        bestCalls: calls,
        bestIntervalMs: session.avgShotIntervalMs ?? null,
        totalSec: session.durationSec,
        lastTrainedAt: session.startedAt,
      })
    } else {
      existing.sessions += 1
      existing.bestCalls = Math.max(existing.bestCalls, calls)
      existing.totalSec += session.durationSec
      if (session.avgShotIntervalMs && session.avgShotIntervalMs > 0) {
        existing.bestIntervalMs =
          existing.bestIntervalMs === null
            ? session.avgShotIntervalMs
            : Math.min(existing.bestIntervalMs, session.avgShotIntervalMs)
      }
      if (session.startedAt > existing.lastTrainedAt) existing.lastTrainedAt = session.startedAt
    }
  }

  const weekly: WeeklyBucket[] = []
  for (let i = weeksBack - 1; i >= 0; i--) {
    const index = currentWeek - i
    const bucket = weekCounts.get(index)
    weekly.push({
      weekIndex: index,
      weekStart: weekStartKey(index),
      label: weekLabel(index),
      sessions: bucket?.sessions ?? 0,
      minutes: Math.round((bucket?.seconds ?? 0) / 60),
      calls: bucket?.calls ?? 0,
      load: bucket?.load ?? 0,
    })
  }

  return {
    sessionCount: sessions.length,
    totalTrainingSec,
    totalCalls,
    totalRounds,
    deceptionSessions,
    bestWeeklySessions: Math.max(0, ...[...weekCounts.values()].map((b) => b.sessions)),
    weekly,
    perDrill: [...drills.values()].sort((a, b) => b.sessions - a.sessions),
    intervalTrend: intervalTrend.sort((a, b) => a.at - b.at),
  }
}

function emptyWeeks(today: Date, weeksBack: number): WeeklyBucket[] {
  const currentWeek = weekIndex(today)
  return Array.from({ length: weeksBack }, (_, i) => {
    const index = currentWeek - (weeksBack - 1 - i)
    return {
      weekIndex: index,
      weekStart: weekStartKey(index),
      label: weekLabel(index),
      sessions: 0,
      minutes: 0,
      calls: 0,
      load: 0,
    }
  })
}
