import { describe, expect, it } from 'vitest'

import { cornerIdsForLayout, CORNERS } from './corners'
import { strokesForRow } from './strokes'
import { blockIndexAt, buildTimeline, sanitizePlan, WARMUP_INTERVAL_FACTOR } from './timeline'
import type { DrillPlan, SequencerConfig, TimelineEvent } from './types'

function sequencer(overrides: Partial<SequencerConfig> = {}): SequencerConfig {
  return {
    layout: 6,
    enabled: cornerIdsForLayout(6),
    selection: 'sequential',
    weights: {},
    avoidImmediateRepeat: true,
    deception: { enabled: false, probability: 0.35, gapMs: 600 },
    announce: 'position',
    ...overrides,
  }
}

function plan(overrides: Partial<DrillPlan> = {}): DrillPlan {
  return {
    prepareSec: 5,
    warmupSec: 0,
    rounds: 3,
    workSec: 6,
    restSec: 12,
    intervalMs: 1200,
    cooldownSec: 0,
    splitStepLeadMs: 0,
    seed: 2024,
    sequencer: sequencer(),
    ...overrides,
  }
}

const kinds = (events: TimelineEvent[], kind: TimelineEvent['kind']) =>
  events.filter((event) => event.kind === kind)

describe('block structure', () => {
  it('lays out prepare → work/rest pairs and drops the trailing rest', () => {
    const { blocks } = buildTimeline(plan())
    expect(blocks.map((block) => block.phase)).toEqual([
      'prepare',
      'work',
      'rest',
      'work',
      'rest',
      'work',
    ])
  })

  it('keeps blocks contiguous and consistent with the total', () => {
    const timeline = buildTimeline(plan({ warmupSec: 30, cooldownSec: 60 }))
    let cursor = 0
    for (const block of timeline.blocks) {
      expect(block.startMs).toBe(cursor)
      expect(block.endMs - block.startMs).toBe(block.durationMs)
      cursor = block.endMs
    }
    expect(timeline.totalMs).toBe(cursor)
  })

  it('includes warm-up and cool-down only when they have a duration', () => {
    const without = buildTimeline(plan({ warmupSec: 0, cooldownSec: 0 }))
    expect(without.blocks.some((b) => b.phase === 'warmup')).toBe(false)
    expect(without.blocks.some((b) => b.phase === 'cooldown')).toBe(false)

    const withBoth = buildTimeline(plan({ warmupSec: 45, cooldownSec: 90 }))
    expect(withBoth.blocks[1]?.phase).toBe('warmup')
    expect(withBoth.blocks[1]?.durationMs).toBe(45_000)
    expect(withBoth.blocks.at(-1)?.phase).toBe('cooldown')
    expect(withBoth.blocks.at(-1)?.durationMs).toBe(90_000)
  })

  it('keeps a rest between the last main round and the sprint set', () => {
    const { blocks } = buildTimeline(
      plan({
        rounds: 2,
        sprint: { rounds: 2, workSec: 10, restSec: 20, intervalMs: 900 },
      }),
    )
    expect(blocks.map((b) => b.phase)).toEqual([
      'prepare',
      'work',
      'rest',
      'work',
      'rest',
      'sprint',
      'rest',
      'sprint',
    ])
  })

  it('numbers rounds within their own set', () => {
    const { blocks } = buildTimeline(
      plan({ rounds: 2, sprint: { rounds: 2, workSec: 10, restSec: 20, intervalMs: 900 } }),
    )
    const work = blocks.filter((b) => b.phase === 'work')
    const sprint = blocks.filter((b) => b.phase === 'sprint')
    expect(work.map((b) => b.round)).toEqual([1, 2])
    expect(work.map((b) => b.label)).toEqual(['Round 1 of 2', 'Round 2 of 2'])
    expect(sprint.map((b) => b.round)).toEqual([1, 2])
    expect(sprint.map((b) => b.label)).toEqual(['Sprint 1 of 2', 'Sprint 2 of 2'])
  })

  it('omits rest blocks entirely when rest is zero', () => {
    const { blocks } = buildTimeline(plan({ restSec: 0 }))
    expect(blocks.some((b) => b.phase === 'rest')).toBe(false)
  })
})

describe('ladder sets', () => {
  const steps = [
    { workSec: 18, restSec: 10, intervalMs: 1400 },
    { workSec: 22, restSec: 10, intervalMs: 1400 },
    { workSec: 30, restSec: 10, intervalMs: 1200 },
  ]

  it('replaces the uniform main set with the explicit steps', () => {
    const { blocks } = buildTimeline(plan({ rounds: 6, workSec: 99, ladder: steps }))
    const work = blocks.filter((b) => b.phase === 'work')
    expect(work).toHaveLength(3)
    expect(work.map((b) => b.durationMs)).toEqual([18_000, 22_000, 30_000])
  })

  it('gives each step its own interval', () => {
    const timeline = buildTimeline(plan({ ladder: steps, prepareSec: 0 }))
    const third = timeline.blocks.filter((b) => b.phase === 'work')[2]
    const calls = kinds(timeline.events, 'call').filter(
      (c) => c.at >= (third?.startMs ?? 0) && c.at < (third?.endMs ?? 0),
    )
    const gaps = calls.slice(1).map((c, i) => c.at - (calls[i]?.at ?? 0))
    expect(new Set(gaps)).toEqual(new Set([1200]))
  })

  it('labels steps as levels and numbers them', () => {
    const { blocks } = buildTimeline(plan({ ladder: steps }))
    const work = blocks.filter((b) => b.phase === 'work')
    expect(work.map((b) => b.label)).toEqual(['Level 1 of 3', 'Level 2 of 3', 'Level 3 of 3'])
    expect(work.map((b) => b.round)).toEqual([1, 2, 3])
    expect(work.every((b) => b.roundsInSet === 3)).toBe(true)
  })

  it('honours a custom step label', () => {
    const { blocks } = buildTimeline(plan({ ladder: [{ ...steps[0]!, label: 'Opening effort' }] }))
    expect(blocks.find((b) => b.phase === 'work')?.label).toBe('Opening effort')
  })

  it('rests between steps but not after the last one', () => {
    const { blocks } = buildTimeline(plan({ ladder: steps, cooldownSec: 0 }))
    expect(blocks.map((b) => b.phase)).toEqual(['prepare', 'work', 'rest', 'work', 'rest', 'work'])
  })

  it('counts every step as working time', () => {
    const timeline = buildTimeline(plan({ ladder: steps }))
    expect(timeline.workMs).toBe((18 + 22 + 30) * 1000)
  })

  it('still runs a sprint set after the ladder', () => {
    const { blocks } = buildTimeline(
      plan({ ladder: steps, sprint: { rounds: 1, workSec: 10, restSec: 0, intervalMs: 800 } }),
    )
    expect(blocks.at(-1)?.phase).toBe('sprint')
  })

  it('falls back to the uniform set when the ladder is empty', () => {
    const { blocks } = buildTimeline(plan({ rounds: 2, ladder: [] }))
    expect(blocks.filter((b) => b.phase === 'work')).toHaveLength(2)
  })

  it('clamps nonsense inside a step', () => {
    const sanitized = sanitizePlan(plan({ ladder: [{ workSec: 0, restSec: -4, intervalMs: 10 }] }))
    expect(sanitized.ladder?.[0]).toMatchObject({ workSec: 1, restSec: 0, intervalMs: 300 })
  })
})

describe('call scheduling', () => {
  it('spaces calls by the shot interval from the start of each work block', () => {
    const timeline = buildTimeline(plan({ rounds: 1, workSec: 6, intervalMs: 1200 }))
    const work = timeline.blocks.find((b) => b.phase === 'work')
    const calls = kinds(timeline.events, 'call')
    expect(calls.map((c) => c.at - (work?.startMs ?? 0))).toEqual([0, 1200, 2400, 3600, 4800])
  })

  it('never lets a call spill past the end of its block', () => {
    const timeline = buildTimeline(plan({ rounds: 2, workSec: 5, intervalMs: 800 }))
    for (const call of kinds(timeline.events, 'call')) {
      const block = timeline.blocks[call.kind === 'call' ? call.blockIndex : 0]
      expect(call.at).toBeGreaterThanOrEqual(block?.startMs ?? 0)
      expect(call.at).toBeLessThan(block?.endMs ?? 0)
    }
  })

  it('issues ceil(work / interval) calls per round', () => {
    const timeline = buildTimeline(plan({ rounds: 3, workSec: 6, intervalMs: 1200 }))
    expect(timeline.totalCalls).toBe(3 * Math.ceil(6000 / 1200))
  })

  it('emits no calls during rest, prepare or cool-down', () => {
    const timeline = buildTimeline(plan({ cooldownSec: 30 }))
    const calls = kinds(timeline.events, 'call')
    expect(calls.length).toBeGreaterThan(0)

    for (const call of calls) {
      const block = timeline.blocks.find((b) => call.at >= b.startMs && call.at < b.endMs)
      expect(block?.emitsCalls).toBe(true)
    }
  })

  it('calls more slowly during the warm-up', () => {
    const timeline = buildTimeline(plan({ warmupSec: 20, rounds: 1, workSec: 6, intervalMs: 1000 }))
    const warmup = timeline.blocks.find((b) => b.phase === 'warmup')
    expect(warmup?.intervalMs).toBe(1000 * WARMUP_INTERVAL_FACTOR)

    const warmupCalls = kinds(timeline.events, 'call').filter(
      (c) => c.at >= (warmup?.startMs ?? 0) && c.at < (warmup?.endMs ?? 0),
    )
    const gaps = warmupCalls.slice(1).map((c, i) => c.at - (warmupCalls[i]?.at ?? 0))
    expect(new Set(gaps)).toEqual(new Set([1600]))
  })

  it('uses the sprint set’s own interval', () => {
    const timeline = buildTimeline(
      plan({
        rounds: 1,
        workSec: 6,
        intervalMs: 1200,
        sprint: { rounds: 1, workSec: 8, restSec: 0, intervalMs: 800 },
      }),
    )
    const sprintBlock = timeline.blocks.find((b) => b.phase === 'sprint')
    const sprintCalls = kinds(timeline.events, 'call').filter(
      (c) => c.at >= (sprintBlock?.startMs ?? 0),
    )
    const gaps = sprintCalls.slice(1).map((c, i) => c.at - (sprintCalls[i]?.at ?? 0))
    expect(new Set(gaps)).toEqual(new Set([800]))
  })

  it('tags every call with the zone number for its layout', () => {
    const timeline = buildTimeline(
      plan({ rounds: 1, workSec: 8, sequencer: sequencer({ selection: 'sequential' }) }),
    )
    const calls = kinds(timeline.events, 'call')
    for (const call of calls) {
      if (call.kind !== 'call') continue
      expect(call.number).toBe(cornerIdsForLayout(6).indexOf(call.corner) + 1)
    }
  })
})

describe('split-step cue', () => {
  it('ticks exactly the configured lead before every call', () => {
    const timeline = buildTimeline(plan({ rounds: 1, workSec: 6, splitStepLeadMs: 400 }))
    const calls = kinds(timeline.events, 'call')
    const splits = kinds(timeline.events, 'split-step')
    expect(splits).toHaveLength(calls.length)
    for (const call of calls) {
      if (call.kind !== 'call') continue
      const match = splits.find((s) => s.kind === 'split-step' && s.callIndex === call.callIndex)
      expect(match?.at).toBe(call.at - 400)
    }
  })

  it('emits nothing when the lead is zero', () => {
    const timeline = buildTimeline(plan({ splitStepLeadMs: 0 }))
    expect(kinds(timeline.events, 'split-step')).toHaveLength(0)
  })

  it('never schedules a tick before the session starts', () => {
    const timeline = buildTimeline(plan({ prepareSec: 0, splitStepLeadMs: 500 }))
    for (const event of timeline.events) expect(event.at).toBeGreaterThanOrEqual(0)
  })

  it('is clamped so it can never precede the previous call', () => {
    const sanitized = sanitizePlan(plan({ intervalMs: 800, splitStepLeadMs: 5000 }))
    expect(sanitized.splitStepLeadMs).toBe(700)
  })
})

describe('deception', () => {
  const deceptivePlan = plan({
    rounds: 1,
    workSec: 20,
    intervalMs: 1200,
    sequencer: sequencer({
      selection: 'random',
      deception: { enabled: true, probability: 1, gapMs: 600 },
    }),
  })

  it('calls a fake first and the real corner one gap later', () => {
    const timeline = buildTimeline(deceptivePlan)
    const feints = kinds(timeline.events, 'feint')
    expect(feints.length).toBeGreaterThan(0)

    for (const feint of feints) {
      if (feint.kind !== 'feint') continue
      const real = kinds(timeline.events, 'call').find(
        (c) => c.kind === 'call' && c.callIndex === feint.callIndex,
      )
      expect(real).toBeDefined()
      expect(real?.at).toBe(feint.at + 600)
      if (real?.kind === 'call') {
        expect(real.feintedFrom).toBe(feint.corner)
        expect(real.corner).not.toBe(feint.corner)
      }
    }
  })

  it('forces a second split-step between the fake and the real call', () => {
    const timeline = buildTimeline({ ...deceptivePlan, splitStepLeadMs: 400 })
    const feints = kinds(timeline.events, 'feint')
    const splits = kinds(timeline.events, 'split-step')
    // One tick before the feint, one before the real call.
    expect(splits.length).toBe(feints.length * 2)

    for (const feint of feints) {
      if (feint.kind !== 'feint') continue
      const own = splits.filter((s) => s.kind === 'split-step' && s.callIndex === feint.callIndex)
      expect(own).toHaveLength(2)
      expect(own[0]?.at).toBe(feint.at - 400)
      expect(own[1]?.at).toBe(feint.at + 600 - 400)
    }
  })

  it('drops the feint when the interval is too short to fit one', () => {
    const timeline = buildTimeline({
      ...deceptivePlan,
      intervalMs: 300,
      sequencer: sequencer({
        selection: 'random',
        deception: { enabled: true, probability: 1, gapMs: 600 },
      }),
    })
    expect(kinds(timeline.events, 'feint')).toHaveLength(0)
    expect(timeline.totalCalls).toBeGreaterThan(0)
  })

  it('keeps the real call inside the block, even for the last slot', () => {
    const timeline = buildTimeline(deceptivePlan)
    const work = timeline.blocks.find((b) => b.phase === 'work')
    for (const call of kinds(timeline.events, 'call')) {
      expect(call.at).toBeLessThan(work?.endMs ?? 0)
    }
  })

  it('emits no feints when deception is off', () => {
    expect(kinds(buildTimeline(plan()).events, 'feint')).toHaveLength(0)
  })
})

describe('countdown', () => {
  it('counts 3-2-1 into each work block that follows a pause', () => {
    const timeline = buildTimeline(plan({ prepareSec: 5, rounds: 2, restSec: 12 }))
    const countdowns = kinds(timeline.events, 'countdown')
    // Two work blocks, each preceded by a non-calling block.
    expect(countdowns).toHaveLength(6)

    const workStarts = timeline.blocks.filter((b) => b.phase === 'work').map((b) => b.startMs)
    for (const start of workStarts) {
      for (const secondsLeft of [3, 2, 1]) {
        expect(
          countdowns.some(
            (c) =>
              c.kind === 'countdown' &&
              c.at === start - secondsLeft * 1000 &&
              c.secondsLeft === secondsLeft,
          ),
        ).toBe(true)
      }
    }
  })

  it('does not count into a block that is already mid-flow', () => {
    // No rest → work blocks run back to back, so only the first gets a countdown.
    const timeline = buildTimeline(plan({ rounds: 3, restSec: 0, prepareSec: 5 }))
    expect(kinds(timeline.events, 'countdown')).toHaveLength(3)
  })

  it('never counts down from before the preceding block began', () => {
    const timeline = buildTimeline(plan({ prepareSec: 2, rounds: 1 }))
    const countdowns = kinds(timeline.events, 'countdown')
    expect(countdowns.map((c) => (c.kind === 'countdown' ? c.secondsLeft : 0))).toEqual([2, 1])
  })
})

describe('summary figures', () => {
  it('reports the mean gap between consecutive calls', () => {
    const timeline = buildTimeline(plan({ rounds: 1, workSec: 6, intervalMs: 1200 }))
    expect(timeline.avgIntervalMs).toBe(1200)
  })

  it('reports zero average when there are fewer than two calls', () => {
    const timeline = buildTimeline(plan({ rounds: 1, workSec: 1, intervalMs: 3000 }))
    expect(timeline.totalCalls).toBe(1)
    expect(timeline.avgIntervalMs).toBe(0)
  })

  it('counts only work and sprint time as working time', () => {
    const timeline = buildTimeline(
      plan({
        prepareSec: 5,
        warmupSec: 30,
        rounds: 3,
        workSec: 6,
        restSec: 12,
        cooldownSec: 60,
        sprint: { rounds: 2, workSec: 10, restSec: 15, intervalMs: 800 },
      }),
    )
    expect(timeline.workMs).toBe(3 * 6000 + 2 * 10_000)
  })
})

describe('timeline invariants', () => {
  it('emits events in ascending time order', () => {
    const timeline = buildTimeline(
      plan({
        warmupSec: 20,
        rounds: 3,
        cooldownSec: 30,
        splitStepLeadMs: 400,
        sequencer: sequencer({
          selection: 'random',
          deception: { enabled: true, probability: 0.5, gapMs: 600 },
        }),
      }),
    )
    for (let i = 1; i < timeline.events.length; i++) {
      expect(timeline.events[i]?.at).toBeGreaterThanOrEqual(timeline.events[i - 1]?.at ?? 0)
    }
  })

  it('finishes with exactly one complete event at the very end', () => {
    const timeline = buildTimeline(plan({ cooldownSec: 30 }))
    const completions = kinds(timeline.events, 'complete')
    expect(completions).toHaveLength(1)
    expect(completions[0]?.at).toBe(timeline.totalMs)
    expect(timeline.events.at(-1)?.kind).toBe('complete')
  })

  it('opens every block with a block-start event', () => {
    const timeline = buildTimeline(plan({ warmupSec: 20, cooldownSec: 20 }))
    const starts = kinds(timeline.events, 'block-start')
    expect(starts).toHaveLength(timeline.blocks.length)
    starts.forEach((event, i) => {
      expect(event.at).toBe(timeline.blocks[i]?.startMs)
    })
  })

  it('is byte-for-byte reproducible from its seed', () => {
    const config = plan({
      sequencer: sequencer({
        selection: 'weighted',
        weights: { 'rear-left': 4 },
        deception: { enabled: true, probability: 0.4, gapMs: 550 },
      }),
      splitStepLeadMs: 350,
      warmupSec: 20,
    })
    expect(buildTimeline(config).events).toEqual(buildTimeline(config).events)
  })

  it('produces a different session for a different seed', () => {
    const a = buildTimeline(plan({ seed: 1, sequencer: sequencer({ selection: 'random' }) }))
    const b = buildTimeline(plan({ seed: 2, sequencer: sequencer({ selection: 'random' }) }))
    expect(a.events).not.toEqual(b.events)
  })
})

describe('sanitizePlan', () => {
  it('clamps a nonsensical plan into something runnable', () => {
    const result = sanitizePlan(
      plan({ rounds: 0, workSec: 0, restSec: -5, intervalMs: 50, prepareSec: -1 }),
    )
    expect(result.rounds).toBe(1)
    expect(result.workSec).toBe(1)
    expect(result.restSec).toBe(0)
    expect(result.intervalMs).toBe(300)
    expect(result.prepareSec).toBe(0)
  })

  it('survives non-finite input', () => {
    const result = sanitizePlan(plan({ intervalMs: Number.NaN, rounds: Number.POSITIVE_INFINITY }))
    expect(Number.isFinite(result.intervalMs)).toBe(true)
    expect(result.rounds).toBe(100)
  })

  it('normalises the sequencer alongside the plan', () => {
    const result = sanitizePlan(
      plan({ sequencer: sequencer({ layout: 4, enabled: ['mid-left'] }) }),
    )
    expect(result.sequencer.enabled).toEqual(cornerIdsForLayout(4))
  })
})

describe('blockIndexAt', () => {
  it('maps an elapsed time onto the block containing it', () => {
    const timeline = buildTimeline(plan({ prepareSec: 5, rounds: 2, workSec: 6, restSec: 12 }))
    expect(blockIndexAt(timeline, 0)).toBe(0)
    expect(blockIndexAt(timeline, 4999)).toBe(0)
    expect(blockIndexAt(timeline, 5000)).toBe(1)
    expect(blockIndexAt(timeline, 11_000)).toBe(2)
  })

  it('clamps past the end to the final block', () => {
    const timeline = buildTimeline(plan())
    expect(blockIndexAt(timeline, timeline.totalMs + 60_000)).toBe(timeline.blocks.length - 1)
  })
})

describe('stroke mode', () => {
  const strokePlan = (overrides: Partial<DrillPlan> = {}) =>
    plan({ sequencer: sequencer({ announce: 'stroke', selection: 'random' }), ...overrides })

  it('attaches a stroke to every call', () => {
    const { events } = buildTimeline(strokePlan())
    const calls = kinds(events, 'call')
    expect(calls.length).toBeGreaterThan(4)
    for (const call of calls) {
      if (call.kind !== 'call') continue
      expect(call.stroke, `call at ${call.at}`).toBeDefined()
    }
  })

  it('attaches nothing in any other mode', () => {
    // A stray stroke would make the voice say "net left, drop" during a
    // plain footwork drill.
    for (const announce of ['position', 'number'] as const) {
      const { events } = buildTimeline(plan({ sequencer: sequencer({ announce }) }))
      for (const call of kinds(events, 'call')) {
        if (call.kind !== 'call') continue
        expect(call.stroke, announce).toBeUndefined()
      }
    }
  })

  it('only ever asks for a shot playable from the corner it called', () => {
    const { events } = buildTimeline(
      strokePlan({
        sequencer: sequencer({ announce: 'stroke', layout: 8, enabled: cornerIdsForLayout(8) }),
      }),
    )
    for (const call of kinds(events, 'call')) {
      if (call.kind !== 'call' || !call.stroke) continue
      const row = CORNERS[call.corner].row
      expect(strokesForRow(row), `${call.corner}`).toContain(call.stroke)
    }
  })

  it('replays the identical shots for the same seed', () => {
    const shots = () =>
      kinds(buildTimeline(strokePlan({ seed: 4242 })).events, 'call').map((call) =>
        call.kind === 'call' ? `${call.corner}:${call.stroke}` : '',
      )
    expect(shots()).toEqual(shots())
    expect(shots().length).toBeGreaterThan(4)
  })

  it('leaves feints silent about the shot', () => {
    // A fake that named a stroke would give itself away every time.
    const { events } = buildTimeline(
      strokePlan({
        sequencer: sequencer({
          announce: 'stroke',
          selection: 'random',
          deception: { enabled: true, probability: 1, gapMs: 400 },
        }),
      }),
    )
    const feints = kinds(events, 'feint')
    expect(feints.length).toBeGreaterThan(0)
    for (const feint of feints) expect('stroke' in feint).toBe(false)
  })
})
