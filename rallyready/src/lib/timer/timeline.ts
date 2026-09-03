import { cornerNumber, CORNERS } from './corners'
import { createRng } from './rng'
import { createSequencer, normalizeSequencerConfig, type CallPlan } from './sequencer'
import { pickStroke, type StrokeId } from './strokes'
import type { DrillBlock, DrillPlan, Timeline, TimelineEvent } from './types'

/** Warm-up calls come at a gentler cadence than the working interval. */
export const WARMUP_INTERVAL_FACTOR = 1.6

/** A feint must leave at least this long before the next scheduled slot. */
const MIN_SLOT_TAIL_MS = 150
const MIN_DECEPTION_GAP_MS = 200

/** Safety rails; the UI constrains the interval to a tighter 800–3000ms. */
const MIN_INTERVAL_MS = 300
const MAX_INTERVAL_MS = 10_000

const COUNTDOWN_FROM = 3

/**
 * Ordering for events that land on the same millisecond, so a timeline is
 * byte-for-byte reproducible from its seed.
 */
const KIND_PRIORITY: Record<TimelineEvent['kind'], number> = {
  'block-start': 0,
  countdown: 1,
  'split-step': 2,
  feint: 3,
  call: 4,
  complete: 5,
}

function clampInt(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min
  // Infinities clamp to the end they point at rather than collapsing to `min`.
  if (value === Number.POSITIVE_INFINITY) return max
  if (value === Number.NEGATIVE_INFINITY) return min
  return Math.min(max, Math.max(min, Math.round(value)))
}

/** Clamps a plan into a runnable shape. Never throws — the UI can be sloppy. */
export function sanitizePlan(plan: DrillPlan): DrillPlan {
  const intervalMs = clampInt(plan.intervalMs, MIN_INTERVAL_MS, MAX_INTERVAL_MS)
  return {
    ...plan,
    prepareSec: clampInt(plan.prepareSec, 0, 60),
    warmupSec: clampInt(plan.warmupSec, 0, 1800),
    rounds: clampInt(plan.rounds, 1, 100),
    workSec: clampInt(plan.workSec, 1, 1800),
    restSec: clampInt(plan.restSec, 0, 1800),
    intervalMs,
    cooldownSec: clampInt(plan.cooldownSec, 0, 1800),
    // A lead longer than the interval itself would tick before the previous call.
    splitStepLeadMs: clampInt(plan.splitStepLeadMs, 0, Math.max(0, intervalMs - 100)),
    ladder: plan.ladder?.length
      ? plan.ladder.map((step) => ({
          workSec: clampInt(step.workSec, 1, 1800),
          restSec: clampInt(step.restSec, 0, 1800),
          intervalMs: clampInt(step.intervalMs, MIN_INTERVAL_MS, MAX_INTERVAL_MS),
          ...(step.label !== undefined ? { label: step.label } : {}),
          // Must survive sanitising: dropping it silently turns a circuit back
          // into a corner-calling drill.
          ...(step.exerciseSlug !== undefined ? { exerciseSlug: step.exerciseSlug } : {}),
        }))
      : undefined,
    sprint: plan.sprint
      ? {
          rounds: clampInt(plan.sprint.rounds, 1, 100),
          workSec: clampInt(plan.sprint.workSec, 1, 1800),
          restSec: clampInt(plan.sprint.restSec, 0, 1800),
          intervalMs: clampInt(plan.sprint.intervalMs, MIN_INTERVAL_MS, MAX_INTERVAL_MS),
        }
      : undefined,
    sequencer: normalizeSequencerConfig(plan.sequencer),
  }
}

interface BlockDraft {
  phase: DrillBlock['phase']
  durationMs: number
  label: string
  emitsCalls: boolean
  intervalMs?: number
  round?: number
  roundsInSet?: number
  exerciseSlug?: string
}

/** Phases where the player is working, as opposed to recovering or waiting. */
function isActivePhase(phase: DrillBlock['phase']): boolean {
  return phase === 'work' || phase === 'sprint' || phase === 'warmup'
}

function draftBlocks(plan: DrillPlan): BlockDraft[] {
  const drafts: BlockDraft[] = []

  if (plan.prepareSec > 0) {
    drafts.push({
      phase: 'prepare',
      durationMs: plan.prepareSec * 1000,
      label: 'Get ready',
      emitsCalls: false,
    })
  }

  if (plan.warmupSec > 0) {
    drafts.push({
      phase: 'warmup',
      durationMs: plan.warmupSec * 1000,
      label: 'Warm-up',
      emitsCalls: true,
      intervalMs: Math.round(plan.intervalMs * WARMUP_INTERVAL_FACTOR),
    })
  }

  // A ladder replaces the uniform main set: every step sets its own load.
  interface MainStep {
    workSec: number
    restSec: number
    intervalMs: number
    label: string
    exerciseSlug?: string
  }

  const mainSet: MainStep[] = plan.ladder?.length
    ? plan.ladder.map((step, index) => ({
        workSec: step.workSec,
        restSec: step.restSec,
        intervalMs: step.intervalMs,
        label: step.label ?? `Level ${index + 1} of ${plan.ladder?.length ?? 0}`,
        ...(step.exerciseSlug !== undefined ? { exerciseSlug: step.exerciseSlug } : {}),
      }))
    : Array.from({ length: plan.rounds }, (_, index) => ({
        workSec: plan.workSec,
        restSec: plan.restSec,
        intervalMs: plan.intervalMs,
        label: `Round ${index + 1} of ${plan.rounds}`,
      }))

  mainSet.forEach((step, index) => {
    drafts.push({
      phase: 'work',
      durationMs: step.workSec * 1000,
      label: step.label,
      // A step with an exercise is a circuit block: the player is doing tuck
      // jumps, not chasing a corner, so there is nothing to call.
      emitsCalls: step.exerciseSlug === undefined,
      intervalMs: step.intervalMs,
      round: index + 1,
      roundsInSet: mainSet.length,
      ...(step.exerciseSlug !== undefined ? { exerciseSlug: step.exerciseSlug } : {}),
    })
    if (step.restSec > 0) {
      drafts.push({
        phase: 'rest',
        durationMs: step.restSec * 1000,
        label: 'Rest',
        emitsCalls: false,
      })
    }
  })

  if (plan.sprint) {
    const sprint = plan.sprint
    for (let round = 1; round <= sprint.rounds; round++) {
      drafts.push({
        phase: 'sprint',
        durationMs: sprint.workSec * 1000,
        label: `Sprint ${round} of ${sprint.rounds}`,
        emitsCalls: true,
        intervalMs: sprint.intervalMs,
        round,
        roundsInSet: sprint.rounds,
      })
      if (sprint.restSec > 0) {
        drafts.push({
          phase: 'rest',
          durationMs: sprint.restSec * 1000,
          label: 'Rest',
          emitsCalls: false,
        })
      }
    }
  }

  // You do not rest at the end of a session.
  while (drafts.length > 0 && drafts[drafts.length - 1]?.phase === 'rest') drafts.pop()

  if (plan.cooldownSec > 0) {
    drafts.push({
      phase: 'cooldown',
      durationMs: plan.cooldownSec * 1000,
      label: 'Cool-down',
      emitsCalls: false,
    })
  }

  return drafts
}

/**
 * Expands a plan into a fully-resolved event timeline.
 *
 * Everything is precomputed against absolute timestamps rather than accumulated
 * tick-by-tick, so playback cannot drift, the session can be previewed before
 * it starts, and the whole thing is trivially assertable in tests.
 */
export function buildTimeline(rawPlan: DrillPlan): Timeline {
  const plan = sanitizePlan(rawPlan)
  const rng = createRng(plan.seed)
  const sequencer = createSequencer(plan.sequencer, rng)
  /*
   * The warm-up calls corners, and only corners.
   *
   * Deception during a warm-up defeats the point of warming up, and so does
   * everything else the caller can do: a rally pattern is a full-intensity
   * sequence, and naming the shot in Strokes mode has you playing hold-drops
   * and jump smashes before your shoulder is warm. The first ninety seconds of
   * a session are for the movement. It ran rallies here until somebody watched
   * the screen say "hold, drop" over the word WARM-UP.
   */
  const warmupSequencer = createSequencer(
    {
      ...plan.sequencer,
      selection: plan.sequencer.selection === 'pattern' ? 'random' : plan.sequencer.selection,
      announce: plan.sequencer.announce === 'stroke' ? 'position' : plan.sequencer.announce,
      patterns: [],
      deception: { ...plan.sequencer.deception, enabled: false },
    },
    rng,
  )

  /*
   * Stroke mode picks the shot here, at build time, from the same generator
   * the corners came from. Doing it in the cue layer instead would make the
   * shots un-replayable — a challenge would send the same corners and
   * different shots, which is not the same session.
   *
   * A pattern call arrives with its shot already decided, because in a rally
   * the shot is the reason for the corner rather than a decoration on it.
   */
  const strokeFor = (
    call: CallPlan,
    namesShots: boolean,
  ): {
    stroke?: StrokeId
    patternId?: string
    shotIndex?: number
    shotsInPattern?: number
  } => {
    if (call.stroke !== undefined) {
      return {
        stroke: call.stroke,
        ...(call.pattern
          ? {
              patternId: call.pattern.id,
              shotIndex: call.pattern.shotIndex,
              shotsInPattern: call.pattern.shots,
            }
          : {}),
      }
    }
    return namesShots
      ? { stroke: pickStroke(CORNERS[call.corner].row, rng, plan.sequencer.strokes) }
      : {}
  }

  const drafts = draftBlocks(plan)
  const blocks: DrillBlock[] = []
  let cursorMs = 0
  drafts.forEach((draft, index) => {
    blocks.push({
      index,
      phase: draft.phase,
      startMs: cursorMs,
      endMs: cursorMs + draft.durationMs,
      durationMs: draft.durationMs,
      label: draft.label,
      emitsCalls: draft.emitsCalls,
      ...(draft.intervalMs !== undefined ? { intervalMs: draft.intervalMs } : {}),
      ...(draft.round !== undefined ? { round: draft.round } : {}),
      ...(draft.roundsInSet !== undefined ? { roundsInSet: draft.roundsInSet } : {}),
      ...(draft.exerciseSlug !== undefined ? { exerciseSlug: draft.exerciseSlug } : {}),
    })
    cursorMs += draft.durationMs
  })

  const totalMs = cursorMs
  const events: TimelineEvent[] = []
  const { layout } = plan.sequencer
  const lead = plan.splitStepLeadMs

  const addSplitStep = (at: number, callIndex: number) => {
    if (lead > 0 && at >= 0) events.push({ at, kind: 'split-step', callIndex })
  }

  let callIndex = 0

  for (const block of blocks) {
    events.push({ at: block.startMs, kind: 'block-start', blockIndex: block.index })

    if (!block.emitsCalls || block.intervalMs === undefined) continue
    const interval = block.intervalMs
    const warmingUp = block.phase === 'warmup'
    const source = warmingUp ? warmupSequencer : sequencer
    // The warm-up is corners only, so it never names a shot either.
    const namesShots = !warmingUp && plan.sequencer.announce === 'stroke'

    for (let slot = block.startMs; slot < block.endMs; slot += interval) {
      const plannedCall = source.next()
      const maxGap = interval - MIN_SLOT_TAIL_MS
      const gap = Math.min(
        Math.max(plan.sequencer.deception.gapMs, MIN_DECEPTION_GAP_MS),
        Math.max(maxGap, MIN_DECEPTION_GAP_MS),
      )
      const realAt = slot + gap

      // A feint is only worth issuing if its real call still lands in this block.
      const useFeint = plannedCall.feint !== undefined && gap <= maxGap && realAt < block.endMs

      if (useFeint && plannedCall.feint) {
        addSplitStep(slot - lead, callIndex)
        events.push({
          at: slot,
          kind: 'feint',
          callIndex,
          corner: plannedCall.feint,
          number: cornerNumber(layout, plannedCall.feint),
        })
        // The second split-step is the whole point of deception training.
        addSplitStep(Math.max(realAt - lead, slot + 1), callIndex)
        events.push({
          at: realAt,
          kind: 'call',
          callIndex,
          corner: plannedCall.corner,
          number: cornerNumber(layout, plannedCall.corner),
          blockIndex: block.index,
          feintedFrom: plannedCall.feint,
          ...strokeFor(plannedCall, namesShots),
        })
      } else {
        addSplitStep(slot - lead, callIndex)
        events.push({
          at: slot,
          kind: 'call',
          callIndex,
          corner: plannedCall.corner,
          number: cornerNumber(layout, plannedCall.corner),
          blockIndex: block.index,
          ...strokeFor(plannedCall, namesShots),
        })
      }
      callIndex += 1
    }
  }

  // "3, 2, 1" into every work block that follows a pause. Keyed on the phase
  // rather than on whether calls are issued, so a circuit block — which never
  // calls a corner — still gets counted in.
  blocks.forEach((block, index) => {
    if (!isActivePhase(block.phase) || index === 0) return
    const previous = blocks[index - 1]
    if (!previous || isActivePhase(previous.phase)) return
    for (let secondsLeft = COUNTDOWN_FROM; secondsLeft >= 1; secondsLeft--) {
      const at = block.startMs - secondsLeft * 1000
      if (at >= previous.startMs) events.push({ at, kind: 'countdown', secondsLeft })
    }
  })

  events.push({ at: totalMs, kind: 'complete' })
  events.sort((a, b) => a.at - b.at || KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind])

  const callTimes = events.filter((event) => event.kind === 'call').map((event) => event.at)
  let gapTotal = 0
  for (let i = 1; i < callTimes.length; i++) {
    gapTotal += (callTimes[i] as number) - (callTimes[i - 1] as number)
  }

  return {
    events,
    blocks,
    totalMs,
    totalCalls: callTimes.length,
    avgIntervalMs: callTimes.length > 1 ? Math.round(gapTotal / (callTimes.length - 1)) : 0,
    workMs: blocks
      .filter((block) => block.phase === 'work' || block.phase === 'sprint')
      .reduce((sum, block) => sum + block.durationMs, 0),
  }
}

/** Index of the block containing `elapsedMs`, clamped to the timeline. */
export function blockIndexAt(timeline: Timeline, elapsedMs: number): number {
  const { blocks } = timeline
  if (blocks.length === 0) return -1
  for (const block of blocks) {
    if (elapsedMs < block.endMs) return block.index
  }
  return blocks.length - 1
}
