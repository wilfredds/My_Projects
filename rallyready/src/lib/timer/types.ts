import type { CornerId, CourtLayout } from './corners'
import type { StrokeId } from './strokes'

/** Which zone the caller picks next. */
export type SelectionMode = 'sequential' | 'random' | 'weighted'

/** How a call is spoken. */
export type AnnounceStyle = 'position' | 'number' | 'stroke'

/**
 * The five modes offered in the UI (§4 Phase 1). They are presented as one
 * choice but decompose into orthogonal knobs internally.
 */
export type DrillMode = 'sequential' | 'random' | 'deception' | 'number' | 'weighted' | 'stroke'

export interface DeceptionConfig {
  enabled: boolean
  /** 0..1 — how often a call slot becomes a feint. */
  probability: number
  /** Delay between the fake call and the real one. */
  gapMs: number
}

export interface SequencerConfig {
  layout: CourtLayout
  /** Zones currently switched on. Must be non-empty. */
  enabled: CornerId[]
  selection: SelectionMode
  /** Relative frequency per zone (1 = normal). Only used by `weighted`. */
  weights: Partial<Record<CornerId, number>>
  /** Prevents the same zone being called twice in a row (ignored if 1 zone). */
  avoidImmediateRepeat: boolean
  deception: DeceptionConfig
  announce: AnnounceStyle
}

export type BlockPhase = 'prepare' | 'warmup' | 'work' | 'rest' | 'sprint' | 'cooldown'

export interface DrillBlock {
  index: number
  phase: BlockPhase
  /** Absolute start on the session timeline. */
  startMs: number
  endMs: number
  durationMs: number
  /** Human label shown on the board, e.g. "Round 3 of 6". */
  label: string
  /** Whether this block issues corner calls. */
  emitsCalls: boolean
  /** Shot interval while calling; undefined when `emitsCalls` is false. */
  intervalMs?: number
  /** 1-based round number within its set (work/sprint blocks only). */
  round?: number
  /** Total rounds in this block's set. */
  roundsInSet?: number
  /** The exercise to perform, for circuit blocks. */
  exerciseSlug?: string
}

export type TimelineEvent =
  | { at: number; kind: 'block-start'; blockIndex: number }
  | { at: number; kind: 'split-step'; callIndex: number }
  | { at: number; kind: 'feint'; callIndex: number; corner: CornerId; number: number }
  | {
      at: number
      kind: 'call'
      callIndex: number
      corner: CornerId
      number: number
      blockIndex: number
      /** Present when this call was preceded by a feint. */
      feintedFrom?: CornerId
      /**
       * The shot to play from that corner, in stroke mode. Chosen when the
       * timeline is built rather than when the cue fires, so a seed replays
       * the same shots as well as the same corners.
       */
      stroke?: StrokeId
    }
  | { at: number; kind: 'countdown'; secondsLeft: number }
  | { at: number; kind: 'complete' }

export interface SprintSet {
  rounds: number
  workSec: number
  restSec: number
  intervalMs: number
}

/**
 * One explicitly-specified step of a progressive set, where every step differs.
 * The benchmark test uses these to step work periods from 18s up to 30s;
 * pyramid and ladder conditioning will use them too.
 */
export interface LadderStep {
  workSec: number
  restSec: number
  intervalMs: number
  /** Overrides the default "Level n of m" block label. */
  label?: string
  /**
   * An exercise to perform instead of chasing corner calls. Set for
   * conditioning circuits; a step carrying one issues no calls at all.
   */
  exerciseSlug?: string
}

/** Everything needed to generate a session. Fully serialisable. */
export interface DrillPlan {
  /** Silent lead-in before the first work block. */
  prepareSec: number
  /** Guided but gentle; calls come at a slower interval. 0 disables. */
  warmupSec: number
  rounds: number
  workSec: number
  restSec: number
  intervalMs: number
  /**
   * Replaces the uniform `rounds × (work, rest)` main set with explicit steps.
   * When present, `rounds`/`workSec`/`restSec` are ignored.
   */
  ladder?: LadderStep[]
  sprint?: SprintSet
  cooldownSec: number
  /** Metronome tick this far before each call. 0 disables. */
  splitStepLeadMs: number
  sequencer: SequencerConfig
  seed: number
}

export interface Timeline {
  events: TimelineEvent[]
  blocks: DrillBlock[]
  totalMs: number
  /** Number of real (non-feint) calls in the session. */
  totalCalls: number
  /** Mean gap between consecutive real calls, or 0 when there are under two. */
  avgIntervalMs: number
  /** Combined duration of work + sprint blocks. */
  workMs: number
}
