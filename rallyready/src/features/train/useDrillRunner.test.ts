import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_CUE_PREFERENCES } from '@/lib/audio/cues'
import type * as Cues from '@/lib/audio/cues'
import { SEED_DRILLS } from '@/lib/data/seed/drills'
import { configFromDrill, planFromConfig } from '@/lib/timer/plan'
import { buildTimeline } from '@/lib/timer/timeline'
import type { DrillPlan, TimelineEvent } from '@/lib/timer/types'

import { useDrillRunner } from './useDrillRunner'

// The cue layer is what a player hears. Capture what it is asked to say, and
// leave speech, tones, haptics and the wake lock out of a jsdom run.
const heard: TimelineEvent[] = []
vi.mock('@/lib/audio/cues', async (actual) => ({
  ...(await actual<typeof Cues>()),
  playCue: (event: TimelineEvent) => heard.push(event),
}))
vi.mock('@/lib/audio/speech', () => ({ primeSpeech: () => {}, cancelSpeech: () => {} }))
vi.mock('@/lib/audio/tones', () => ({
  setToneVolume: () => {},
  unlockAudio: () => Promise.resolve(),
}))
vi.mock('@/lib/audio/haptics', () => ({ stopVibration: () => {} }))
vi.mock('@/lib/audio/wakeLock', () => ({
  WakeLockManager: class {
    acquire() {
      return Promise.resolve()
    }
    release() {
      return Promise.resolve()
    }
  },
}))

const drill = SEED_DRILLS.find((d) => d.slug === 'six-corner-shadow')!

/** The same drill at two paces, as a beginner and as the player really is. */
function planAt(intervalMs: number): DrillPlan {
  const config = { ...configFromDrill(drill), intervalMs, warmupSec: 0 }
  return planFromConfig(config, { splitStepLeadMs: 0, seed: 7 })
}

const callTimes = (events: TimelineEvent[]) =>
  events.filter((event) => event.kind === 'call').map((event) => event.at)

describe('the session a drill runs is the one on screen when Start is pressed', () => {
  beforeEach(() => {
    heard.length = 0
    vi.useFakeTimers({
      toFake: [
        'requestAnimationFrame',
        'cancelAnimationFrame',
        'performance',
        'setTimeout',
        'Date',
      ],
    })
  })
  afterEach(() => vi.useRealTimers())

  it('follows the settings that arrived after the screen opened', async () => {
    // A drill opened straight from a link renders before the player's level
    // has loaded, so its first plan is the beginner one.
    const beginner = planAt(2000)
    const theirs = planAt(1350)
    const { result, rerender } = renderHook(
      ({ plan }) =>
        useDrillRunner({ plan, preferences: DEFAULT_CUE_PREFERENCES, onComplete: () => {} }),
      { initialProps: { plan: beginner } },
    )

    // Then the level arrives, and the screen shows their numbers.
    rerender({ plan: theirs })
    expect(result.current.timeline.avgIntervalMs).toBe(buildTimeline(theirs).avgIntervalMs)

    await act(async () => {
      await result.current.start()
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000)
    })

    const expected = callTimes(buildTimeline(theirs).events).filter((at) => at <= 19_000)
    expect(expected.length).toBeGreaterThan(5)
    // The calls heard are the ones the screen advertised, not the beginner's.
    expect(callTimes(heard).slice(0, expected.length)).toEqual(expected)
  })

  it('does not change under the player once the drill is running', async () => {
    const started = planAt(1350)
    const { result, rerender } = renderHook(
      ({ plan }) =>
        useDrillRunner({ plan, preferences: DEFAULT_CUE_PREFERENCES, onComplete: () => {} }),
      { initialProps: { plan: started } },
    )
    await act(async () => {
      await result.current.start()
    })

    // Something upstream changes mid-drill. The session already under way must
    // not jump to a different one, and the screen must keep describing it.
    rerender({ plan: planAt(2000) })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000)
    })

    const expected = callTimes(buildTimeline(started).events).filter((at) => at <= 19_000)
    expect(callTimes(heard).slice(0, expected.length)).toEqual(expected)
    expect(result.current.timeline.avgIntervalMs).toBe(buildTimeline(started).avgIntervalMs)
  })

  it('can report the session so far without ending it', async () => {
    // What is kept in case the phone closes the app: read mid-drill, it must
    // describe the drill so far and leave it running.
    const { result } = renderHook(() =>
      useDrillRunner({
        plan: planAt(1350),
        preferences: DEFAULT_CUE_PREFERENCES,
        onComplete: () => {},
      }),
    )
    await act(async () => {
      await result.current.start()
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(12_000)
    })

    const sofar = result.current.snapshot()
    expect(sofar.completed).toBe(false)
    expect(sofar.durationSec).toBe(12)
    expect(sofar.callsAnswered).toBeGreaterThan(0)
    expect(result.current.state.status).toBe('running')
  })
})
