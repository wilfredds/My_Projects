import { describe, expect, it } from 'vitest'

import { createCursor } from './cursor'
import { cornerIdsForLayout } from './corners'
import { buildTimeline } from './timeline'
import type { DrillPlan } from './types'

const plan: DrillPlan = {
  prepareSec: 5,
  warmupSec: 0,
  rounds: 2,
  workSec: 6,
  restSec: 12,
  intervalMs: 1200,
  cooldownSec: 0,
  splitStepLeadMs: 0,
  seed: 7,
  sequencer: {
    layout: 6,
    enabled: cornerIdsForLayout(6),
    selection: 'sequential',
    weights: {},
    avoidImmediateRepeat: true,
    deception: { enabled: false, probability: 0, gapMs: 600 },
    announce: 'position',
    strokes: null,
    patterns: [],
  },
}

describe('createCursor', () => {
  it('releases each event exactly once as time passes', () => {
    const timeline = buildTimeline(plan)
    const cursor = createCursor(timeline)

    const seen = []
    for (let t = 0; t <= timeline.totalMs; t += 100) seen.push(...cursor.advanceTo(t))

    expect(seen).toEqual(timeline.events)
    expect(cursor.remaining()).toBe(0)
  })

  it('returns nothing when time has not moved', () => {
    const cursor = createCursor(buildTimeline(plan))
    expect(cursor.advanceTo(0)).toHaveLength(1) // the opening block-start
    expect(cursor.advanceTo(0)).toEqual([])
    expect(cursor.advanceTo(0)).toEqual([])
  })

  it('catches up in one go after a long stall', () => {
    // A backgrounded tab can freeze rAF for seconds; nothing may be dropped.
    const timeline = buildTimeline(plan)
    const cursor = createCursor(timeline)
    const due = cursor.advanceTo(timeline.totalMs)
    expect(due).toEqual(timeline.events)
  })

  it('includes events landing exactly on the boundary', () => {
    const timeline = buildTimeline(plan)
    const cursor = createCursor(timeline)
    const firstWork = timeline.blocks.find((b) => b.phase === 'work')
    const due = cursor.advanceTo(firstWork?.startMs ?? 0)
    expect(due.some((e) => e.kind === 'call' && e.at === firstWork?.startMs)).toBe(true)
  })

  it('skips silently when seeking forward', () => {
    const timeline = buildTimeline(plan)
    const cursor = createCursor(timeline)
    const secondWork = timeline.blocks.filter((b) => b.phase === 'work')[1]

    cursor.seekTo(secondWork?.startMs ?? 0)
    const due = cursor.advanceTo(secondWork?.startMs ?? 0)
    expect(due).toEqual([])

    // Playback resumes correctly from the new position.
    const next = cursor.advanceTo((secondWork?.startMs ?? 0) + 1300)
    expect(next.every((event) => event.at > (secondWork?.startMs ?? 0))).toBe(true)
    expect(next.some((event) => event.kind === 'call')).toBe(true)
  })

  it('replays from the top after reset', () => {
    const timeline = buildTimeline(plan)
    const cursor = createCursor(timeline)
    cursor.advanceTo(timeline.totalMs)
    expect(cursor.remaining()).toBe(0)

    cursor.reset()
    expect(cursor.remaining()).toBe(timeline.events.length)
    expect(cursor.advanceTo(timeline.totalMs)).toEqual(timeline.events)
  })

  it('never re-emits when time goes backwards', () => {
    const timeline = buildTimeline(plan)
    const cursor = createCursor(timeline)
    cursor.advanceTo(10_000)
    expect(cursor.advanceTo(0)).toEqual([])
  })
})
