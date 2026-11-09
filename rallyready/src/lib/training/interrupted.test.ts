import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearCheckpoint,
  keepCheckpoint,
  MIN_WORTH_KEEPING_SEC,
  OFFER_FOR_MS,
  readCheckpoint,
  sessionFrom,
  type InterruptedRun,
} from './interrupted'

const NOW = Date.parse('2026-11-09T07:30:00+08:00')

function run(overrides: Partial<InterruptedRun> = {}, durationSec = 860): InterruptedRun {
  return {
    drillSlug: 'six-corner-shadow',
    savedAt: NOW - 60_000,
    input: {
      drillId: 'six-corner-shadow',
      drillName: 'Six-Corner Shadow',
      startedAt: '2026-11-08T23:00:00.000Z',
      durationSec,
      roundsCompleted: 3,
      avgShotIntervalMs: 1350,
      source: 'timer',
    },
    metrics: [
      { metricKey: 'calls_answered', metricValue: 92 },
      { metricKey: 'completed', metricValue: 0 },
    ],
    ...overrides,
  }
}

beforeEach(() => localStorage.clear())

describe('a drill the phone cut short', () => {
  it('comes back exactly as it was kept', () => {
    keepCheckpoint(run())
    expect(readCheckpoint(NOW)).toEqual(run())
  })

  it('turns back into the record End and save would have written', () => {
    const { input, metrics } = sessionFrom(run())
    expect(input.startedAt).toBeInstanceOf(Date)
    expect(input.startedAt.toISOString()).toBe('2026-11-08T23:00:00.000Z')
    expect(input.durationSec).toBe(860)
    expect(metrics).toContainEqual({ metricKey: 'completed', metricValue: 0 })
  })

  it('is gone once the drill has ended', () => {
    keepCheckpoint(run())
    clearCheckpoint()
    expect(readCheckpoint(NOW)).toBeNull()
  })

  it('is not worth asking about under half a minute', () => {
    keepCheckpoint(run({}, MIN_WORTH_KEEPING_SEC - 1))
    expect(readCheckpoint(NOW)).toBeNull()
    keepCheckpoint(run({}, MIN_WORTH_KEEPING_SEC))
    expect(readCheckpoint(NOW)).not.toBeNull()
  })

  it('stops being offered after a day', () => {
    keepCheckpoint(run({ savedAt: NOW - OFFER_FOR_MS - 1 }))
    expect(readCheckpoint(NOW)).toBeNull()
    keepCheckpoint(run({ savedAt: NOW - OFFER_FOR_MS + 1 }))
    expect(readCheckpoint(NOW)).not.toBeNull()
  })

  it('ignores a copy from the future, where a wrong clock put it', () => {
    keepCheckpoint(run({ savedAt: NOW + 60 * 60_000 }))
    expect(readCheckpoint(NOW)).toBeNull()
  })

  it('ignores anything that is not a kept run', () => {
    localStorage.setItem('rallyready.interrupted-run', '{"drillSlug": 4}')
    expect(readCheckpoint(NOW)).toBeNull()
    localStorage.setItem('rallyready.interrupted-run', 'not json')
    expect(readCheckpoint(NOW)).toBeNull()
  })

  it('does not throw at a drill when storage is refused', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError')
    })
    expect(() => keepCheckpoint(run())).not.toThrow()
    expect(() => clearCheckpoint()).not.toThrow()
    setItem.mockRestore()
  })
})
