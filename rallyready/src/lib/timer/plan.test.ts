import { describe, expect, it } from 'vitest'

import { ADJUSTMENT_SCALE } from '@/lib/data/readiness'

import { cornerIdsForLayout } from './corners'
import { estimateDurationSec, scaleConfig, type DrillConfig } from './plan'

const base: DrillConfig = {
  layout: 6,
  enabledCorners: cornerIdsForLayout(6),
  mode: 'random',
  weights: {},
  intervalMs: 1400,
  workSec: 45,
  restSec: 30,
  rounds: 6,
  warmupSec: 0,
  cooldownSec: 0,
  prepareSec: 5,
  sprint: null,
  avoidImmediateRepeat: true,
  deceptionProbability: 0.35,
  deceptionGapMs: 600,
  circuit: null,
  circuitRounds: 1,
  patterns: [],
  strokes: null,
}

const circuit: DrillConfig = {
  ...base,
  circuit: [
    { exerciseSlug: 'jump-squat', workSec: 40, restSec: 20 },
    { exerciseSlug: 'shadow-lunge', workSec: 40, restSec: 20 },
  ],
  circuitRounds: 3,
}

describe('scaleConfig', () => {
  it('leaves a session alone at full scale', () => {
    expect(scaleConfig(base, 1)).toBe(base)
  })

  it('ignores a nonsensical scale rather than producing an empty drill', () => {
    expect(scaleConfig(base, 0)).toBe(base)
    expect(scaleConfig(base, -1)).toBe(base)
    expect(scaleConfig(base, Number.NaN)).toBe(base)
  })

  it('takes rounds off first, because that is the unit a player counts in', () => {
    const lighter = scaleConfig(base, ADJUSTMENT_SCALE.lighter)
    expect(lighter.rounds).toBe(4)
    expect(lighter.workSec).toBe(base.workSec)
  })

  it('adds a round when told to push', () => {
    expect(scaleConfig(base, ADJUSTMENT_SCALE.harder).rounds).toBe(7)
  })

  it('falls back to work time when the round count cannot express the change', () => {
    const single = { ...base, rounds: 1 }
    const lighter = scaleConfig(single, ADJUSTMENT_SCALE.lighter)
    expect(lighter.rounds).toBe(1)
    expect(lighter.workSec).toBe(31)
  })

  it('never trims a work block below something worth timing', () => {
    const tiny = { ...base, rounds: 1, workSec: 12 }
    expect(scaleConfig(tiny, 0.2).workSec).toBe(10)
  })

  it('never drops below a single round', () => {
    expect(scaleConfig({ ...base, rounds: 2 }, 0.1).rounds).toBe(1)
  })

  it('scales a circuit by its rounds', () => {
    const lighter = scaleConfig(circuit, ADJUSTMENT_SCALE.lighter)
    expect(lighter.circuitRounds).toBe(2)
    expect(lighter.circuit?.[0]?.workSec).toBe(40)
  })

  it('shortens each exercise when a circuit is down to one round', () => {
    const single = { ...circuit, circuitRounds: 1 }
    const lighter = scaleConfig(single, ADJUSTMENT_SCALE.lighter)
    expect(lighter.circuitRounds).toBe(1)
    expect(lighter.circuit?.map((step) => step.workSec)).toEqual([28, 28])
  })

  it('actually shortens the session it is applied to', () => {
    expect(estimateDurationSec(scaleConfig(base, ADJUSTMENT_SCALE.lighter))).toBeLessThan(
      estimateDurationSec(base),
    )
    expect(estimateDurationSec(scaleConfig(circuit, ADJUSTMENT_SCALE.lighter))).toBeLessThan(
      estimateDurationSec(circuit),
    )
  })

  it('leaves the shot interval alone — that is technique, not workload', () => {
    expect(scaleConfig(base, ADJUSTMENT_SCALE.lighter).intervalMs).toBe(base.intervalMs)
    expect(scaleConfig(base, ADJUSTMENT_SCALE.harder).intervalMs).toBe(base.intervalMs)
  })
})
