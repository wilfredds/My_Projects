import type { CircuitStep, Drill } from '@/lib/data/types'
import {
  patternsForProfile,
  scaleVolume,
  vocabularyFor,
  weightsFor,
  type TrainingProfile,
} from '@/lib/training/profile'

import { cornerIdsForLayout, type CornerId, type CourtLayout } from './corners'
import { applyMode } from './sequencer'
import type { StrokeId } from './strokes'
import type { DrillMode, DrillPlan, LadderStep, SprintSet } from './types'

/**
 * The editable shape of a drill as the user configures it, and the bridge from
 * there to a `DrillPlan` the timeline builder understands.
 */

export interface DrillConfig {
  layout: CourtLayout
  enabledCorners: CornerId[]
  mode: DrillMode
  weights: Partial<Record<CornerId, number>>
  intervalMs: number
  workSec: number
  restSec: number
  rounds: number
  warmupSec: number
  cooldownSec: number
  prepareSec: number
  sprint: SprintSet | null
  avoidImmediateRepeat: boolean
  deceptionProbability: number
  deceptionGapMs: number
  /** Non-null runs this as a conditioning circuit instead of a call drill. */
  circuit: CircuitStep[] | null
  circuitRounds: number
  /** Rally patterns to run, by id. Only used by `pattern` mode. */
  patterns: string[]
  /** The shots the caller may ask for. `null` leaves the whole vocabulary. */
  strokes: StrokeId[] | null
}

export function isCircuit(config: DrillConfig): boolean {
  return config.circuit !== null && config.circuit.length > 0
}

/**
 * Flattens a circuit into ladder steps: every exercise in every round becomes
 * its own timed block, labelled so the runner can say where you are.
 */
export function circuitToLadder(steps: CircuitStep[], rounds: number): LadderStep[] {
  const ladder: LadderStep[] = []
  for (let round = 1; round <= rounds; round++) {
    steps.forEach((step, index) => {
      ladder.push({
        workSec: step.workSec,
        restSec: step.restSec,
        intervalMs: MIN_INTERVAL_MS,
        exerciseSlug: step.exerciseSlug,
        label:
          rounds > 1
            ? `Round ${round} · ${index + 1} of ${steps.length}`
            : `${index + 1} of ${steps.length}`,
      })
    })
  }
  return ladder
}

/** §4: shot interval adjustable from 0.8s to 3s — up to ~60 calls a minute. */
export const MIN_INTERVAL_MS = 800
export const MAX_INTERVAL_MS = 3000
export const INTERVAL_STEP_MS = 50

export const MIN_SPLIT_STEP_LEAD_MS = 200
export const MAX_SPLIT_STEP_LEAD_MS = 700

export const DEFAULT_PREPARE_SEC = 5

/**
 * The drill as written, then fitted to the player.
 *
 * Without a profile this is exactly the drill's own defaults, which is what the
 * library listings and the challenge screen want — a challenge has to be the
 * same session for both people, so it must not quietly rescale itself to
 * whoever opened it.
 *
 * With one, three things move: the volume (rounds, work, rest and how fast the
 * calls come), the shot vocabulary, and which zones come up most. The interval
 * moves here where auto-regulation leaves it alone, because level is not a
 * dial on effort — a beginner needs longer to arrive, and arriving properly is
 * the thing being trained.
 */
export function configFromDrill(drill: Drill, profile?: TrainingProfile): DrillConfig {
  const volume = profile
    ? scaleVolume(
        {
          rounds: drill.defaultRounds,
          workSec: drill.defaultWorkSec,
          restSec: drill.defaultRestSec,
          intervalMs: drill.defaultIntervalMs,
        },
        profile.level,
      )
    : {
        rounds: drill.defaultRounds,
        workSec: drill.defaultWorkSec,
        restSec: drill.defaultRestSec,
        intervalMs: drill.defaultIntervalMs,
      }

  return {
    layout: drill.corners,
    enabledCorners: drill.enabledCorners ?? cornerIdsForLayout(drill.corners),
    mode: drill.defaultCallMode,
    // A drill that is for one game keeps its own shape whoever runs it; one
    // that suits either takes the shape of the game the player actually plays.
    weights: profile
      ? weightsFor(drill.discipline === 'both' ? profile.discipline : drill.discipline)
      : {},
    intervalMs: volume.intervalMs,
    workSec: volume.workSec,
    restSec: volume.restSec,
    rounds: volume.rounds,
    warmupSec: drill.defaultWarmupSec,
    cooldownSec: drill.defaultCooldownSec,
    prepareSec: DEFAULT_PREPARE_SEC,
    sprint: null,
    avoidImmediateRepeat: true,
    deceptionProbability: 0.35,
    deceptionGapMs: 600,
    circuit: drill.circuit,
    circuitRounds: drill.circuitRounds,
    patterns: patternsForDrill(drill, profile),
    strokes: profile ? vocabularyFor(profile.level) : null,
  }
}

/**
 * Which rallies a drill runs.
 *
 * A drill naming its own patterns runs those and only those — "Hold and
 * Deceive" is that pair of rallies, not a level-appropriate selection. A drill
 * naming none is asking for whatever suits the player, which is how the same
 * pattern drill grows with them instead of needing a beginner and an advanced
 * copy of itself.
 */
export function patternsForDrill(drill: Drill, profile?: TrainingProfile): string[] {
  if (drill.patternIds.length > 0) return [...drill.patternIds]
  if (!profile) return []
  const discipline = drill.discipline === 'both' ? profile.discipline : drill.discipline
  return patternsForProfile({ discipline, level: profile.level }).map((pattern) => pattern.id)
}

/** Never trim a work block below something worth starting the timer for. */
const MIN_SCALED_WORK_SEC = 10
const MAX_SCALED_WORK_SEC = 600

/**
 * The same drill, dialled up or down — how auto-regulation actually changes a
 * session rather than merely commenting on it.
 *
 * Rounds move first, because a round is the unit a player thinks in: "four
 * instead of six" is a decision you can hold in your head mid-drill, where
 * "42 seconds instead of 60" is just an odd number on a clock. Only when the
 * round count cannot express the change — a single-round drill, or a scale too
 * small to move it — does the work time take the difference instead, so that
 * asking for a lighter session always produces one.
 *
 * The shot interval is deliberately left alone. Interval is a technique
 * setting: slowing it down changes what the drill teaches, not how much of it
 * you do.
 */
export function scaleConfig(config: DrillConfig, scale: number): DrillConfig {
  if (!Number.isFinite(scale) || scale === 1 || scale <= 0) return config

  const scaleWork = (seconds: number) =>
    Math.min(MAX_SCALED_WORK_SEC, Math.max(MIN_SCALED_WORK_SEC, Math.round(seconds * scale)))

  if (isCircuit(config) && config.circuit) {
    const circuitRounds = Math.max(1, Math.round(config.circuitRounds * scale))
    if (circuitRounds !== config.circuitRounds) return { ...config, circuitRounds }
    return {
      ...config,
      circuit: config.circuit.map((step) => ({ ...step, workSec: scaleWork(step.workSec) })),
    }
  }

  const rounds = Math.max(1, Math.round(config.rounds * scale))
  if (rounds !== config.rounds) return { ...config, rounds }
  return { ...config, workSec: scaleWork(config.workSec) }
}

export function planFromConfig(
  config: DrillConfig,
  options: { splitStepLeadMs: number; seed: number },
): DrillPlan {
  const sequencer = applyMode(
    {
      layout: config.layout,
      enabled: config.enabledCorners,
      selection: 'random',
      weights: config.weights,
      avoidImmediateRepeat: config.avoidImmediateRepeat,
      deception: {
        enabled: false,
        probability: config.deceptionProbability,
        gapMs: config.deceptionGapMs,
      },
      announce: 'position',
      strokes: config.strokes,
      patterns: config.patterns,
    },
    config.mode,
  )

  const circuit = isCircuit(config)

  return {
    prepareSec: config.prepareSec,
    // A circuit's warm-up cannot be corner calls — there is no court model in
    // play — so it is dropped and the cool-down kept.
    warmupSec: circuit ? 0 : config.warmupSec,
    rounds: config.rounds,
    workSec: config.workSec,
    restSec: config.restSec,
    intervalMs: config.intervalMs,
    cooldownSec: config.cooldownSec,
    splitStepLeadMs: circuit ? 0 : options.splitStepLeadMs,
    ...(circuit && config.circuit
      ? { ladder: circuitToLadder(config.circuit, config.circuitRounds) }
      : {}),
    sprint: circuit ? undefined : (config.sprint ?? undefined),
    seed: options.seed,
    sequencer,
  }
}

/* --------------------------------------------------------------- presets */

export interface DifficultyPreset {
  id: string
  label: string
  description: string
  intervalMs: number
  avoidImmediateRepeat: boolean
  deceptionProbability: number
}

/** §4: Beginner → Pro, adjusting pace and how unpredictable the caller is. */
export const DIFFICULTY_PRESETS: DifficultyPreset[] = [
  {
    id: 'beginner',
    label: 'Beginner',
    description: 'Two seconds a call. Time to reach the corner and recover properly.',
    intervalMs: 2000,
    avoidImmediateRepeat: true,
    deceptionProbability: 0.2,
  },
  {
    id: 'improver',
    label: 'Improver',
    description: 'Quicker, but still room for a full movement to every corner.',
    intervalMs: 1650,
    avoidImmediateRepeat: true,
    deceptionProbability: 0.25,
  },
  {
    id: 'intermediate',
    label: 'Intermediate',
    description: 'Club pace. You will have to cut the recovery short to keep up.',
    intervalMs: 1350,
    avoidImmediateRepeat: true,
    deceptionProbability: 0.3,
  },
  {
    id: 'advanced',
    label: 'Advanced',
    description: 'Rally speed. Footwork has to be efficient or you fall behind.',
    intervalMs: 1100,
    avoidImmediateRepeat: true,
    deceptionProbability: 0.35,
  },
  {
    id: 'pro',
    label: 'Pro',
    description: 'Relentless, and zones can repeat — no pattern to lean on.',
    intervalMs: 880,
    avoidImmediateRepeat: false,
    deceptionProbability: 0.45,
  },
]

export interface StructurePreset {
  id: string
  label: string
  description: string
  workSec: number
  restSec: number
  rounds: number
}

/**
 * Work/rest shapes. The default mirrors measured singles match data —
 * ~5.5s rallies against ~11.4s between them, so roughly 1:2.
 */
export const STRUCTURE_PRESETS: StructurePreset[] = [
  {
    id: 'match-rhythm',
    label: 'Match rhythm',
    description: '6s on / 12s off × 12 — the real 1:2 rally-to-rest ratio.',
    workSec: 6,
    restSec: 12,
    rounds: 12,
  },
  {
    id: 'long-rally',
    label: 'Long rally',
    description: '10s on / 15s off × 10 — for the rallies that do not end.',
    workSec: 10,
    restSec: 15,
    rounds: 10,
  },
  {
    id: 'classic-shadow',
    label: 'Classic shadow',
    description: '30s on / 30s off × 6 — the traditional shadow set.',
    workSec: 30,
    restSec: 30,
    rounds: 6,
  },
  {
    id: 'tabata',
    label: 'Tabata',
    description: '20s on / 10s off × 8 — four brutal minutes.',
    workSec: 20,
    restSec: 10,
    rounds: 8,
  },
]

export function matchDifficulty(config: DrillConfig): DifficultyPreset | undefined {
  return DIFFICULTY_PRESETS.find(
    (preset) =>
      preset.intervalMs === config.intervalMs &&
      preset.avoidImmediateRepeat === config.avoidImmediateRepeat,
  )
}

export function matchStructure(config: DrillConfig): StructurePreset | undefined {
  return STRUCTURE_PRESETS.find(
    (preset) =>
      preset.workSec === config.workSec &&
      preset.restSec === config.restSec &&
      preset.rounds === config.rounds,
  )
}

/** Total wall-clock length of a configured drill, in seconds. */
export function estimateDurationSec(config: DrillConfig): number {
  if (isCircuit(config) && config.circuit) {
    const perRound = config.circuit.reduce((total, step) => total + step.workSec + step.restSec, 0)
    // The very last rest is dropped by the timeline builder.
    const lastRest = config.circuit.at(-1)?.restSec ?? 0
    return config.prepareSec + perRound * config.circuitRounds - lastRest + config.cooldownSec
  }

  const main = config.rounds * config.workSec + Math.max(0, config.rounds - 1) * config.restSec
  const sprint = config.sprint
    ? config.sprint.rounds * config.sprint.workSec + config.sprint.rounds * config.sprint.restSec
    : 0
  return config.prepareSec + config.warmupSec + main + sprint + config.cooldownSec
}
