import { describe, expect, it } from 'vitest'

import { computeStats, METRIC_CALLS, METRIC_DECEPTION } from './stats'
import type { Session, SessionMetric } from './types'

const TODAY = new Date(2026, 7, 9, 12, 0, 0) // Sunday 9 Aug 2026

let counter = 0
function session(overrides: Partial<Session> & { startedAt: string }): Session {
  counter += 1
  return {
    id: `s${counter}`,
    userId: null,
    drillId: 'six-corner-shadow',
    drillName: 'Six-Corner Shadow',
    durationSec: 600,
    roundsCompleted: 6,
    avgShotIntervalMs: 1400,
    notes: null,
    source: 'timer',
    ...overrides,
  }
}

const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 10).toISOString()

function metric(sessionId: string, key: string, value: number): SessionMetric {
  return { id: `${sessionId}-${key}`, sessionId, metricKey: key, metricValue: value }
}

describe('computeStats', () => {
  it('returns empty totals but still fills the week axis for a new user', () => {
    const stats = computeStats([], [], TODAY, 12)
    expect(stats.sessionCount).toBe(0)
    expect(stats.weekly).toHaveLength(12)
    expect(stats.weekly.every((week) => week.sessions === 0)).toBe(true)
  })

  it('totals time, rounds and calls', () => {
    const a = session({ startedAt: at(2026, 8, 4), durationSec: 400, roundsCompleted: 4 })
    const b = session({ startedAt: at(2026, 8, 6), durationSec: 800, roundsCompleted: 8 })
    const stats = computeStats(
      [a, b],
      [metric(a.id, METRIC_CALLS, 90), metric(b.id, METRIC_CALLS, 150)],
      TODAY,
    )
    expect(stats.sessionCount).toBe(2)
    expect(stats.totalTrainingSec).toBe(1200)
    expect(stats.totalRounds).toBe(12)
    expect(stats.totalCalls).toBe(240)
  })

  it('treats a session with no recorded calls as zero rather than dropping it', () => {
    const a = session({ startedAt: at(2026, 8, 4) })
    const stats = computeStats([a], [], TODAY)
    expect(stats.sessionCount).toBe(1)
    expect(stats.totalCalls).toBe(0)
  })

  it('buckets sessions into the right weeks and keeps empty weeks', () => {
    const stats = computeStats(
      [session({ startedAt: at(2026, 8, 4) }), session({ startedAt: at(2026, 7, 21) })],
      [],
      TODAY,
      4,
    )
    expect(stats.weekly).toHaveLength(4)
    expect(stats.weekly.at(-1)?.sessions).toBe(1) // week of 3 Aug
    expect(stats.weekly.at(-3)?.sessions).toBe(1) // week of 20 Jul
    expect(stats.weekly.at(-2)?.sessions).toBe(0)
  })

  it('weighs each week by effort, not just by minutes', () => {
    // Same duration, opposite efforts — minutes cannot tell these two weeks
    // apart and load has to.
    const brutal = session({ startedAt: at(2026, 8, 4), durationSec: 600 })
    const gentle = session({ startedAt: at(2026, 7, 21), durationSec: 600 })
    const stats = computeStats(
      [brutal, gentle],
      [metric(brutal.id, 'rpe', 9), metric(gentle.id, 'rpe', 2)],
      TODAY,
      4,
    )
    expect(stats.weekly.at(-1)?.minutes).toBe(stats.weekly.at(-3)?.minutes)
    expect(stats.weekly.at(-1)?.load).toBe(90)
    expect(stats.weekly.at(-3)?.load).toBe(20)
  })

  it('assumes a moderate effort for a week of unrated sessions', () => {
    const stats = computeStats(
      [session({ startedAt: at(2026, 8, 4), durationSec: 600 })],
      [],
      TODAY,
      2,
    )
    expect(stats.weekly.at(-1)?.load).toBe(50)
  })

  it('labels each bucket with the Monday that opens it', () => {
    const stats = computeStats([session({ startedAt: at(2026, 8, 4) })], [], TODAY, 2)
    expect(stats.weekly.at(-1)?.weekStart).toBe('2026-08-03')
  })

  it('reports the busiest week ever, not just the current one', () => {
    const stats = computeStats(
      [
        session({ startedAt: at(2026, 6, 1) }),
        session({ startedAt: at(2026, 6, 2) }),
        session({ startedAt: at(2026, 6, 4) }),
        session({ startedAt: at(2026, 8, 4) }),
      ],
      [],
      TODAY,
    )
    expect(stats.bestWeeklySessions).toBe(3)
  })

  it('counts deception sessions from their metric', () => {
    const a = session({ startedAt: at(2026, 8, 4) })
    const b = session({ startedAt: at(2026, 8, 5) })
    const stats = computeStats(
      [a, b],
      [metric(a.id, METRIC_DECEPTION, 1), metric(b.id, METRIC_DECEPTION, 0)],
      TODAY,
    )
    expect(stats.deceptionSessions).toBe(1)
  })

  it('groups per drill and keeps the best figures', () => {
    const stats = computeStats(
      [
        session({ startedAt: at(2026, 8, 4), avgShotIntervalMs: 1500, durationSec: 300 }),
        session({ startedAt: at(2026, 8, 6), avgShotIntervalMs: 1100, durationSec: 400 }),
        session({
          startedAt: at(2026, 8, 7),
          drillId: 'tabata-shadow',
          drillName: 'Tabata Shadow',
        }),
      ],
      [],
      TODAY,
    )
    const six = stats.perDrill.find((d) => d.drillId === 'six-corner-shadow')
    expect(six?.sessions).toBe(2)
    expect(six?.totalSec).toBe(700)
    // "Best" interval is the fastest, so the smallest number.
    expect(six?.bestIntervalMs).toBe(1100)
    expect(six?.lastTrainedAt).toBe(at(2026, 8, 6))
    expect(stats.perDrill).toHaveLength(2)
  })

  it('sorts drills by how often they were trained', () => {
    const stats = computeStats(
      [
        session({ startedAt: at(2026, 8, 1), drillId: 'a', drillName: 'A' }),
        session({ startedAt: at(2026, 8, 2), drillId: 'b', drillName: 'B' }),
        session({ startedAt: at(2026, 8, 3), drillId: 'b', drillName: 'B' }),
      ],
      [],
      TODAY,
    )
    expect(stats.perDrill.map((d) => d.drillId)).toEqual(['b', 'a'])
  })

  it('files a session with no drill under Custom drill', () => {
    const stats = computeStats(
      [session({ startedAt: at(2026, 8, 4), drillId: null, drillName: null })],
      [],
      TODAY,
    )
    expect(stats.perDrill[0]?.drillName).toBe('Custom drill')
  })

  it('builds the pace trend oldest first and skips sessions with no interval', () => {
    const stats = computeStats(
      [
        session({ startedAt: at(2026, 8, 6), avgShotIntervalMs: 1200 }),
        session({ startedAt: at(2026, 8, 1), avgShotIntervalMs: 1500 }),
        session({ startedAt: at(2026, 8, 3), avgShotIntervalMs: null }),
      ],
      [],
      TODAY,
    )
    expect(stats.intervalTrend.map((p) => p.intervalMs)).toEqual([1500, 1200])
  })
})

describe('a session dated in the future', () => {
  const today = new Date('2026-09-09T12:00:00')
  const tomorrow = new Date('2026-09-10T19:00:00').toISOString()
  const yesterday = new Date('2026-09-08T19:00:00').toISOString()

  it('is not counted into a week', () => {
    /*
     * A wrong device clock, or a flight across the date line. `computeStreak`
     * already refuses to count one into "this week", and without the same
     * guard here the heatmap disagreed with the streak tile on the same
     * screen — one said one session this week, the other said two.
     */
    const stats = computeStats(
      [session({ startedAt: yesterday }), session({ startedAt: tomorrow })],
      [],
      today,
    )
    expect(stats.weekly.at(-1)?.sessions).toBe(1)
  })

  it('still counts towards the totals, because the training happened', () => {
    // It is the date that is wrong, not the session.
    const stats = computeStats(
      [session({ startedAt: yesterday }), session({ startedAt: tomorrow })],
      [],
      today,
    )
    expect(stats.totalTrainingSec).toBe(1200)
  })

  it('leaves an ordinary history alone', () => {
    const stats = computeStats(
      [session({ startedAt: yesterday }), session({ startedAt: yesterday })],
      [],
      today,
    )
    expect(stats.weekly.at(-1)?.sessions).toBe(2)
    expect(stats.totalTrainingSec).toBe(1200)
  })
})
