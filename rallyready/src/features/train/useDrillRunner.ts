import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { playCue, type CuePreferences } from '@/lib/audio/cues'
import { stopVibration } from '@/lib/audio/haptics'
import { cancelSpeech, primeSpeech } from '@/lib/audio/speech'
import { setToneVolume, unlockAudio } from '@/lib/audio/tones'
import { WakeLockManager } from '@/lib/audio/wakeLock'
import { findExercise } from '@/lib/data/seed/exercises'
import { DrillClock } from '@/lib/timer/clock'
import type { CornerId } from '@/lib/timer/corners'
import { createCursor } from '@/lib/timer/cursor'
import { buildTimeline } from '@/lib/timer/timeline'
import type { DrillBlock, DrillPlan, Timeline } from '@/lib/timer/types'

export type RunnerStatus = 'idle' | 'running' | 'paused' | 'finished'

export interface RunnerSummary {
  durationSec: number
  roundsCompleted: number
  callsAnswered: number
  avgShotIntervalMs: number | null
  /** False when the user stopped early. */
  completed: boolean
}

interface RunnerMetrics {
  elapsedMs: number
  blockIndex: number
  block: DrillBlock | null
  nextBlock: DrillBlock | null
  blockRemainingMs: number
  blockProgress: number
  overallProgress: number
  activeCorner: CornerId | null
  activeNumber: number
  callProgress: number
  callsAnswered: number
  roundsCompleted: number
}

export interface RunnerState extends RunnerMetrics {
  status: RunnerStatus
}

/**
 * An event arriving this far behind schedule is stale — the tab was
 * backgrounded or the main thread stalled. State still catches up, but firing
 * the audio would dump a burst of callouts for moments that have passed.
 */
const STALE_CUE_MS = 900

/** ~30fps for React state. The digits tick in seconds; the pip cannot tell. */
const FRAME_BUDGET_MS = 33

const IDLE_METRICS: RunnerMetrics = {
  elapsedMs: 0,
  blockIndex: 0,
  block: null,
  nextBlock: null,
  blockRemainingMs: 0,
  blockProgress: 0,
  overallProgress: 0,
  activeCorner: null,
  activeNumber: 0,
  callProgress: 1,
  callsAnswered: 0,
  roundsCompleted: 0,
}

interface UseDrillRunnerOptions {
  plan: DrillPlan
  preferences: CuePreferences
  onComplete: (summary: RunnerSummary, timeline: Timeline) => void
}

export function useDrillRunner({ plan, preferences, onComplete }: UseDrillRunnerOptions) {
  const timeline = useMemo(() => buildTimeline(plan), [plan])

  const [status, setStatus] = useState<RunnerStatus>('idle')
  const [metrics, setMetrics] = useState<RunnerMetrics>(IDLE_METRICS)

  const clockRef = useRef(new DrillClock())
  const cursorRef = useRef(createCursor(timeline))
  const wakeLockRef = useRef(new WakeLockManager())
  const finishedRef = useRef(false)

  // Live call state, tracked outside React so the frame loop allocates nothing.
  const activeRef = useRef<{ corner: CornerId | null; number: number; at: number; span: number }>({
    corner: null,
    number: 0,
    at: 0,
    span: plan.intervalMs,
  })
  /** Every call the user actually heard, with the block it belonged to. */
  const answeredRef = useRef<{ at: number; blockIndex: number }[]>([])
  /**
   * Work blocks the user skipped out of. Elapsed time will march past them and
   * make them look finished, so they are subtracted back out.
   */
  const skippedRoundsRef = useRef(0)

  // Latest callbacks/settings, so the loop never closes over a stale render.
  // Written in effects rather than during render — a ref write mid-render is
  // not safe under concurrent rendering.
  const preferencesRef = useRef(preferences)
  const onCompleteRef = useRef(onComplete)

  useEffect(() => {
    preferencesRef.current = preferences
  }, [preferences])

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  const buildSummary = useCallback(
    (completed: boolean): RunnerSummary => {
      const elapsed = clockRef.current.elapsed(performance.now())
      const answered = answeredRef.current

      // Only gaps between consecutive calls *inside the same block* describe
      // the shot interval. Spanning a rest — or a skip — would report the
      // length of the break rather than the pace of the drill.
      let gapTotal = 0
      let gapCount = 0
      for (let i = 1; i < answered.length; i++) {
        const previous = answered[i - 1]
        const current = answered[i]
        if (!previous || !current || previous.blockIndex !== current.blockIndex) continue
        gapTotal += current.at - previous.at
        gapCount += 1
      }

      return {
        durationSec: Math.round(Math.min(elapsed, timeline.totalMs) / 1000),
        roundsCompleted: Math.max(
          0,
          timeline.blocks.filter(
            (block) =>
              (block.phase === 'work' || block.phase === 'sprint') && block.endMs <= elapsed,
          ).length - skippedRoundsRef.current,
        ),
        callsAnswered: answered.length,
        avgShotIntervalMs: gapCount > 0 ? Math.round(gapTotal / gapCount) : null,
        completed,
      }
    },
    [timeline],
  )

  const finish = useCallback(
    (completed: boolean) => {
      if (finishedRef.current) return
      finishedRef.current = true
      const summary = buildSummary(completed)
      clockRef.current.pause(performance.now())
      cancelSpeech()
      stopVibration()
      void wakeLockRef.current.release()
      setStatus('finished')
      onCompleteRef.current(summary, timeline)
    },
    [buildSummary, timeline],
  )

  /**
   * The frame loop. Lives in an effect keyed on `status` so pausing genuinely
   * stops the work instead of spinning on frozen values.
   */
  useEffect(() => {
    if (status !== 'running') return

    let frame = 0
    let lastPush = 0

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop)
      const elapsed = clockRef.current.elapsed(now)

      for (const event of cursorRef.current.advanceTo(elapsed)) {
        const stale = elapsed - event.at > STALE_CUE_MS

        if (event.kind === 'call' || event.kind === 'feint') {
          activeRef.current = {
            corner: event.corner,
            number: event.number,
            at: event.at,
            span:
              (event.kind === 'call' ? timeline.blocks[event.blockIndex]?.intervalMs : undefined) ??
              plan.intervalMs,
          }
          if (event.kind === 'call') {
            answeredRef.current.push({ at: event.at, blockIndex: event.blockIndex })
          }
        }

        if (event.kind === 'block-start') {
          const phase = timeline.blocks[event.blockIndex]?.phase
          if (phase && phase !== 'work' && phase !== 'sprint' && phase !== 'warmup') {
            activeRef.current = { corner: null, number: 0, at: event.at, span: plan.intervalMs }
          }
        }

        if (!stale) {
          playCue(event, {
            preferences: preferencesRef.current,
            phaseOf: (index) => timeline.blocks[index]?.phase,
            exerciseNameOf: (index) => {
              const slug = timeline.blocks[index]?.exerciseSlug
              return slug ? findExercise(slug)?.name : undefined
            },
          })
        }

        if (event.kind === 'complete') {
          finish(true)
          return
        }
      }

      if (now - lastPush < FRAME_BUDGET_MS) return
      lastPush = now

      const blocks = timeline.blocks
      let index = blocks.length - 1
      for (const block of blocks) {
        if (elapsed < block.endMs) {
          index = block.index
          break
        }
      }
      const block = blocks[index] ?? null
      const active = activeRef.current
      const callAge = elapsed - active.at

      setMetrics({
        elapsedMs: elapsed,
        blockIndex: index,
        block,
        nextBlock: blocks[index + 1] ?? null,
        blockRemainingMs: block ? Math.max(0, block.endMs - elapsed) : 0,
        blockProgress:
          block && block.durationMs > 0 ? (elapsed - block.startMs) / block.durationMs : 0,
        overallProgress: timeline.totalMs > 0 ? Math.min(1, elapsed / timeline.totalMs) : 0,
        activeCorner: active.corner,
        activeNumber: active.number,
        callProgress: active.span > 0 ? Math.min(1, Math.max(0, callAge / active.span)) : 1,
        callsAnswered: answeredRef.current.length,
        roundsCompleted: Math.max(
          0,
          blocks.filter((b) => (b.phase === 'work' || b.phase === 'sprint') && b.endMs <= elapsed)
            .length - skippedRoundsRef.current,
        ),
      })
    }

    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [status, timeline, plan.intervalMs, finish])

  const start = useCallback(async () => {
    if (clockRef.current.isStarted) return
    // Both of these must happen inside the user gesture that called start().
    primeSpeech()
    await unlockAudio()
    setToneVolume(preferencesRef.current.toneVolume)
    if (preferencesRef.current.wakeLockEnabled) void wakeLockRef.current.acquire()

    finishedRef.current = false
    answeredRef.current = []
    skippedRoundsRef.current = 0
    cursorRef.current.reset()
    clockRef.current.start(performance.now())
    setStatus('running')
  }, [])

  const pause = useCallback(() => {
    if (!clockRef.current.isStarted || clockRef.current.isPaused) return
    clockRef.current.pause(performance.now())
    cancelSpeech()
    void wakeLockRef.current.release()
    setStatus('paused')
  }, [])

  const resume = useCallback(() => {
    if (!clockRef.current.isPaused) return
    clockRef.current.resume(performance.now())
    if (preferencesRef.current.wakeLockEnabled) void wakeLockRef.current.acquire()
    setStatus('running')
  }, [])

  /*
   * A phone call, a notification tap, or switching apps mid-drill.
   *
   * `requestAnimationFrame` stops in a hidden tab but `performance.now()` does
   * not, so the first frame after coming back hands the cursor every event
   * from the whole absence at once. Two things follow from that, and both are
   * worse than they sound: every skipped corner is counted as answered, and if
   * the session's `complete` event is anywhere in that batch, a drill
   * abandoned at round two logs itself as finished. The stale-cue guard keeps
   * the speech quiet but does nothing about the bookkeeping.
   *
   * So the clock stops when the page goes away. That is also simply the honest
   * reading — you were not training — and this app's entire claim is that
   * everything on the Progress screen is something you actually did.
   *
   * Deliberately no auto-resume: coming back to a drill already shouting
   * corners while the phone is still in your hand is worse than pressing one
   * button. The paused screen has that button.
   */
  useEffect(() => {
    if (status !== 'running') return
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') pause()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [status, pause])

  const togglePause = useCallback(() => {
    if (clockRef.current.isPaused) resume()
    else pause()
  }, [pause, resume])

  /** Jump to the start of the next block — skip a rest, bail out of a round. */
  const skipBlock = useCallback(() => {
    const now = performance.now()
    const elapsed = clockRef.current.elapsed(now)
    const current = timeline.blocks.find(
      (block) => elapsed >= block.startMs && elapsed < block.endMs,
    )
    // Bailing out of a round means it was not completed, however far it ran.
    if (current && (current.phase === 'work' || current.phase === 'sprint')) {
      skippedRoundsRef.current += 1
    }

    const next = timeline.blocks.find((block) => block.startMs > elapsed)
    if (!next) {
      finish(false)
      return
    }
    cancelSpeech()
    cursorRef.current.seekTo(next.startMs - 1)
    clockRef.current.seek(next.startMs, now)
    activeRef.current = { corner: null, number: 0, at: next.startMs, span: plan.intervalMs }
  }, [finish, plan.intervalMs, timeline])

  const stop = useCallback(() => finish(false), [finish])

  useEffect(() => {
    setToneVolume(preferences.toneVolume)
  }, [preferences.toneVolume])

  // Tearing down mid-drill (navigating away, closing the tab) must not leave a
  // wake lock held or a queued utterance talking to an empty room.
  useEffect(() => {
    const wakeLock = wakeLockRef.current
    return () => {
      cancelSpeech()
      stopVibration()
      void wakeLock.release()
    }
  }, [])

  const state = useMemo<RunnerState>(() => ({ status, ...metrics }), [status, metrics])

  return { timeline, state, start, pause, resume, togglePause, skipBlock, stop }
}
