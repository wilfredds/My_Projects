import { describe, expect, it } from 'vitest'

import {
  backupFilename,
  BACKUP_VERSION,
  buildBackup,
  parseBackup,
  planRestore,
  type BackupFile,
} from './backup'
import type { Benchmark, ReadinessCheck, Session, SessionMetric } from './types'

const session = (overrides: Partial<Session> = {}): Session => ({
  id: 's1',
  userId: null,
  drillId: 'six-corner-shadow',
  drillName: 'Six-Corner Shadow',
  startedAt: '2026-08-01T10:00:00.000Z',
  durationSec: 480,
  roundsCompleted: 6,
  avgShotIntervalMs: 1350,
  notes: null,
  source: 'timer',
  ...overrides,
})

const metric = (overrides: Partial<SessionMetric> = {}): SessionMetric => ({
  id: 'm1',
  sessionId: 's1',
  metricKey: 'calls_answered',
  metricValue: 166,
  ...overrides,
})

const benchmark = (overrides: Partial<Benchmark> = {}): Benchmark => ({
  id: 'b1',
  userId: null,
  testType: 'b_endurance_style',
  takenAt: '2026-08-02T10:00:00.000Z',
  score: 142,
  levelReached: 7,
  raw: {},
  ...overrides,
})

describe('buildBackup', () => {
  it('stamps the file so a stray JSON cannot be mistaken for a backup', () => {
    const file = buildBackup({ profile: null, sessions: [], metrics: [], benchmarks: [] })
    expect(file.app).toBe('rallyready')
    expect(file.version).toBe(BACKUP_VERSION)
    expect(file.exportedAt).toMatch(/^\d{4}-\d\d-\d\dT/)
  })

  it('attaches each metric to the session it belongs to', () => {
    const file = buildBackup({
      profile: null,
      sessions: [session(), session({ id: 's2', startedAt: '2026-08-03T10:00:00.000Z' })],
      metrics: [metric(), metric({ id: 'm2', sessionId: 's2', metricValue: 90 })],
      benchmarks: [],
    })
    expect(file.sessions[0]?.metrics.map((m) => m.metricValue)).toEqual([166])
    expect(file.sessions[1]?.metrics.map((m) => m.metricValue)).toEqual([90])
  })

  it('keeps sessions that have no metrics rather than dropping them', () => {
    const file = buildBackup({
      profile: null,
      sessions: [session()],
      metrics: [],
      benchmarks: [],
    })
    expect(file.sessions).toHaveLength(1)
    expect(file.sessions[0]?.metrics).toEqual([])
  })
})

describe('parseBackup', () => {
  const round = (file: BackupFile) => parseBackup(JSON.stringify(file))

  it('accepts a file it just wrote', () => {
    const file = buildBackup({
      profile: null,
      sessions: [session()],
      metrics: [metric()],
      benchmarks: [benchmark()],
    })
    const result = round(file)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.file.sessions).toHaveLength(1)
      expect(result.file.benchmarks).toHaveLength(1)
    }
  })

  it('rejects things that are not JSON', () => {
    const result = parseBackup('not json at all')
    expect(result).toEqual({ ok: false, error: 'That is not a valid JSON file.' })
  })

  it('rejects JSON from some other app', () => {
    const result = parseBackup(JSON.stringify({ app: 'someone-elses-tracker', sessions: [] }))
    expect(result.ok).toBe(false)
  })

  it('refuses a backup from a newer version than it understands', () => {
    const result = parseBackup(
      JSON.stringify({ app: 'rallyready', version: BACKUP_VERSION + 1, sessions: [] }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/newer version/)
  })

  it('drops individual sessions that are too broken to chart', () => {
    const result = parseBackup(
      JSON.stringify({
        app: 'rallyready',
        version: 1,
        sessions: [
          { session: session() },
          { session: { ...session(), startedAt: undefined } },
          { session: { ...session({ id: 's3' }), durationSec: 'ages' } },
          'nonsense',
        ],
      }),
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.file.sessions).toHaveLength(1)
  })
})

describe('planRestore', () => {
  const file = buildBackup({
    profile: null,
    sessions: [session(), session({ id: 's2', startedAt: '2026-08-05T10:00:00.000Z' })],
    metrics: [metric()],
    benchmarks: [benchmark()],
  })

  it('adds everything when nothing is stored yet', () => {
    const plan = planRestore(file, { sessions: [], benchmarks: [] })
    expect(plan.sessions).toHaveLength(2)
    expect(plan.benchmarks).toHaveLength(1)
    expect(plan.skippedSessions).toBe(0)
  })

  it('is idempotent — importing the same file twice adds nothing the second time', () => {
    const already = [session(), session({ id: 'other', startedAt: '2026-08-05T10:00:00.000Z' })]
    const plan = planRestore(file, { sessions: already, benchmarks: [benchmark()] })
    expect(plan.sessions).toHaveLength(0)
    expect(plan.benchmarks).toHaveLength(0)
    expect(plan.skippedSessions).toBe(2)
    expect(plan.skippedBenchmarks).toBe(1)
  })

  it('de-duplicates on when it happened, not on the id', () => {
    // Ids are assigned by whichever device stored the row, so they never match
    // across a backup. The start time and the drill are what identify a session.
    const already = [session({ id: 'a-completely-different-id' })]
    const plan = planRestore(file, { sessions: already, benchmarks: [] })
    expect(plan.sessions).toHaveLength(1)
    expect(plan.sessions[0]?.input.startedAt.toISOString()).toBe('2026-08-05T10:00:00.000Z')
  })

  it('merges rather than replaces, keeping training done only on this device', () => {
    const localOnly = session({ id: 'local', startedAt: '2026-09-09T10:00:00.000Z' })
    const plan = planRestore(file, { sessions: [localOnly], benchmarks: [] })
    // Nothing in the plan removes the local session; it only ever adds.
    expect(plan.sessions).toHaveLength(2)
  })

  it('does not duplicate within a single file either', () => {
    const doubled = buildBackup({
      profile: null,
      sessions: [session(), session({ id: 'dupe' })],
      metrics: [],
      benchmarks: [],
    })
    const plan = planRestore(doubled, { sessions: [], benchmarks: [] })
    expect(plan.sessions).toHaveLength(1)
    expect(plan.skippedSessions).toBe(1)
  })

  it('carries the metrics across with their session', () => {
    const plan = planRestore(file, { sessions: [], benchmarks: [] })
    expect(plan.sessions[0]?.metrics).toEqual([{ metricKey: 'calls_answered', metricValue: 166 }])
  })

  it('converts stored timestamps back into dates the repositories accept', () => {
    const plan = planRestore(file, { sessions: [], benchmarks: [] })
    expect(plan.sessions[0]?.input.startedAt).toBeInstanceOf(Date)
    expect(plan.benchmarks[0]?.takenAt).toBeInstanceOf(Date)
  })
})

describe('readiness in a backup', () => {
  const check = (date: string): ReadinessCheck => ({
    id: `r-${date}`,
    userId: null,
    date,
    createdAt: `${date}T07:00:00.000Z`,
    sleep: 4,
    soreness: 3,
    energy: 4,
  })

  it('carries check-ins out and back', () => {
    const built = buildBackup({
      profile: null,
      sessions: [],
      metrics: [],
      benchmarks: [],
      readiness: [check('2026-08-01')],
    })
    const parsed = parseBackup(JSON.stringify(built))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.file.readiness).toHaveLength(1)
    expect(planRestore(parsed.file, { sessions: [], benchmarks: [] }).readiness).toEqual([
      { date: '2026-08-01', sleep: 4, soreness: 3, energy: 4 },
    ])
  })

  it('keeps the check-in already recorded for a day rather than overwriting it', () => {
    const built = buildBackup({
      profile: null,
      sessions: [],
      metrics: [],
      benchmarks: [],
      readiness: [check('2026-08-01'), check('2026-08-02')],
    })
    const plan = planRestore(built, {
      sessions: [],
      benchmarks: [],
      readiness: [check('2026-08-01')],
    })
    expect(plan.readiness).toHaveLength(1)
    expect(plan.readiness[0]?.date).toBe('2026-08-02')
    expect(plan.skippedReadiness).toBe(1)
  })

  it('reads a version-1 file that predates check-ins', () => {
    const old = JSON.stringify({
      app: 'rallyready',
      version: 1,
      exportedAt: '2026-08-01T00:00:00.000Z',
      profile: null,
      sessions: [],
      benchmarks: [],
    })
    const parsed = parseBackup(old)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.file.readiness).toEqual([])
  })
})

describe('backupFilename', () => {
  it('is dated so a folder of them can be told apart', () => {
    expect(backupFilename(new Date('2026-08-11T09:00:00Z'))).toBe(
      'rallyready-backup-2026-08-11.json',
    )
  })

  it("is dated by the player's own day, not UTC's", () => {
    // 07:00 on Monday in Manila, where the suite runs (vitest.config.ts), is
    // still 23:00 on Sunday in UTC. A backup made before training is that
    // morning's backup.
    expect(backupFilename(new Date('2026-11-08T23:00:00Z'))).toBe(
      'rallyready-backup-2026-11-09.json',
    )
  })
})
