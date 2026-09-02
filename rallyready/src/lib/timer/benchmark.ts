import { cornerIdsForLayout } from './corners'
import type { DrillPlan, LadderStep } from './types'

/**
 * The in-app fitness test, modelled on the B-ENDURANCE protocol (§4 Phase 2):
 * badminton-specific movements to the four corners, in work periods that step
 * up from 18s to 30s with a fixed 10s recovery between them.
 *
 * The load rises because the work grows while the rest does not — the
 * work:rest ratio goes from 1.8:1 to 3:1 across the test. The shot interval
 * stays fixed at 1.4s on purpose: this measures endurance, not reaction time,
 * and a moving interval would confound the two.
 *
 * You stop when you can no longer hold the pace. The number that matters is
 * how far you got.
 */

export const BENCHMARK_TEST_TYPE = 'b_endurance_style' as const

/** Work seconds per level: 18 → 30 across twelve levels. */
export const BENCHMARK_WORK_SECONDS = [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 30]

export const BENCHMARK_REST_SEC = 10
export const BENCHMARK_INTERVAL_MS = 1400
export const BENCHMARK_PREPARE_SEC = 10
export const BENCHMARK_LEVELS = BENCHMARK_WORK_SECONDS.length

export function benchmarkLadder(): LadderStep[] {
  return BENCHMARK_WORK_SECONDS.map((workSec, index) => ({
    workSec,
    restSec: BENCHMARK_REST_SEC,
    intervalMs: BENCHMARK_INTERVAL_MS,
    label: `Level ${index + 1} of ${BENCHMARK_LEVELS}`,
  }))
}

/**
 * No warm-up block and no cool-down: the test assumes you have already warmed
 * up, and folding one in would change the score depending on how tired the
 * warm-up left you.
 */
export function benchmarkPlan(seed: number): DrillPlan {
  return {
    prepareSec: BENCHMARK_PREPARE_SEC,
    warmupSec: 0,
    rounds: BENCHMARK_LEVELS,
    workSec: BENCHMARK_WORK_SECONDS[0] ?? 18,
    restSec: BENCHMARK_REST_SEC,
    intervalMs: BENCHMARK_INTERVAL_MS,
    ladder: benchmarkLadder(),
    cooldownSec: 0,
    // No split-step tick: the metronome would pace you through the test.
    splitStepLeadMs: 0,
    seed,
    sequencer: {
      layout: 4,
      enabled: cornerIdsForLayout(4),
      selection: 'random',
      weights: {},
      avoidImmediateRepeat: true,
      deception: { enabled: false, probability: 0, gapMs: 600 },
      announce: 'position',
      strokes: null,
      patterns: [],
    },
  }
}

/** Wall-clock length of the full test, including the lead-in. */
export function benchmarkDurationSec(): number {
  const work = BENCHMARK_WORK_SECONDS.reduce((total, seconds) => total + seconds, 0)
  const rest = (BENCHMARK_LEVELS - 1) * BENCHMARK_REST_SEC
  return BENCHMARK_PREPARE_SEC + work + rest
}

/** Total corner touches available if every level is completed. */
export function benchmarkMaxScore(): number {
  return BENCHMARK_WORK_SECONDS.reduce(
    (total, workSec) => total + Math.ceil((workSec * 1000) / BENCHMARK_INTERVAL_MS),
    0,
  )
}

/**
 * Corner touches completed. Finer-grained than the level alone — two players
 * who both fail in level 7 are still separated by how far into it they got.
 */
export function benchmarkScore(callsAnswered: number): number {
  return Math.max(0, Math.round(callsAnswered))
}

export interface BenchmarkGrade {
  label: string
  description: string
}

/**
 * A plain-language read on the level reached. Bands are deliberately broad:
 * this is a personal number to beat, not a ranking against other people.
 */
export function gradeBenchmark(levelReached: number): BenchmarkGrade {
  if (levelReached <= 0) {
    return { label: 'Not recorded', description: 'Complete at least one level to score.' }
  }
  if (levelReached <= 3) {
    return {
      label: 'Building',
      description: 'A base to work from. Consistency will move this fastest.',
    }
  }
  if (levelReached <= 6) {
    return {
      label: 'Club fit',
      description: 'Enough to hold a social match. Longer rallies will still hurt.',
    }
  }
  if (levelReached <= 9) {
    return {
      label: 'Match fit',
      description: 'You can go three games without your movement falling apart.',
    }
  }
  return {
    label: 'Competition fit',
    description: 'Deep reserves. Sharpen rather than rebuild from here.',
  }
}
