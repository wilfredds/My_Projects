import { describe, expect, it } from 'vitest'

import { SEED_DRILLS } from '@/lib/data/seed/drills'
import { EXERCISES, findExercise } from '@/lib/data/seed/exercises'
import type { CircuitStep, Drill } from '@/lib/data/types'

import {
  circuitToLadder,
  configFromDrill,
  estimateDurationSec,
  isCircuit,
  planFromConfig,
  type DrillConfig,
} from './plan'
import { buildTimeline } from './timeline'

const STEPS: CircuitStep[] = [
  { exerciseSlug: 'ladder-in-out', workSec: 30, restSec: 20 },
  { exerciseSlug: 'plyo-jump-squat', workSec: 25, restSec: 20 },
  { exerciseSlug: 'core-plank-reach', workSec: 40, restSec: 30 },
]

function circuitDrill(overrides: Partial<Drill> = {}): Drill {
  return {
    id: 'test-circuit',
    slug: 'test-circuit',
    name: 'Test Circuit',
    category: 'agility',
    style: 'ladder',
    description: '',
    coachingCues: [],
    commonFaults: [],
    defaultWorkSec: 30,
    defaultRestSec: 20,
    defaultRounds: 3,
    corners: 6,
    videoUrl: null,
    isPublic: true,
    createdBy: null,
    defaultIntervalMs: 1400,
    defaultCallMode: 'random',
    enabledCorners: null,
    defaultWarmupSec: 60,
    defaultCooldownSec: 60,
    level: 'intermediate',
    circuit: STEPS,
    circuitRounds: 2,
    location: 'anywhere',
    equipment: ['agility ladder'],
    ...overrides,
  }
}

const config = (overrides: Partial<DrillConfig> = {}): DrillConfig => ({
  ...configFromDrill(circuitDrill()),
  ...overrides,
})

describe('circuitToLadder', () => {
  it('repeats every exercise once per round, in order', () => {
    const ladder = circuitToLadder(STEPS, 2)
    expect(ladder).toHaveLength(6)
    expect(ladder.map((step) => step.exerciseSlug)).toEqual([
      'ladder-in-out',
      'plyo-jump-squat',
      'core-plank-reach',
      'ladder-in-out',
      'plyo-jump-squat',
      'core-plank-reach',
    ])
  })

  it('carries each step’s own work and rest through', () => {
    const ladder = circuitToLadder(STEPS, 1)
    expect(ladder.map((step) => [step.workSec, step.restSec])).toEqual([
      [30, 20],
      [25, 20],
      [40, 30],
    ])
  })

  it('labels steps with the round when there is more than one', () => {
    expect(circuitToLadder(STEPS, 2)[3]?.label).toBe('Round 2 · 1 of 3')
    expect(circuitToLadder(STEPS, 1)[0]?.label).toBe('1 of 3')
  })
})

describe('isCircuit', () => {
  it('is false for a corner-call drill', () => {
    expect(isCircuit(config({ circuit: null }))).toBe(false)
  })

  it('is false for an empty circuit rather than producing a silent workout', () => {
    expect(isCircuit(config({ circuit: [] }))).toBe(false)
  })

  it('is true once there are steps', () => {
    expect(isCircuit(config())).toBe(true)
  })
})

describe('a circuit plan', () => {
  const plan = planFromConfig(config(), { splitStepLeadMs: 400, seed: 1 })

  it('turns the circuit into the plan’s ladder', () => {
    expect(plan.ladder).toHaveLength(6)
  })

  it('drops the corner-call warm-up, which makes no sense off court', () => {
    expect(plan.warmupSec).toBe(0)
  })

  it('drops the split-step tick — there are no calls to anticipate', () => {
    expect(plan.splitStepLeadMs).toBe(0)
  })

  it('keeps the cool-down', () => {
    expect(plan.cooldownSec).toBe(60)
  })

  it('ignores a sprint set, which belongs to court drills', () => {
    const withSprint = planFromConfig(
      config({ sprint: { rounds: 2, workSec: 10, restSec: 10, intervalMs: 900 } }),
      { splitStepLeadMs: 0, seed: 1 },
    )
    expect(withSprint.sprint).toBeUndefined()
  })
})

describe('a circuit timeline', () => {
  const timeline = buildTimeline(planFromConfig(config(), { splitStepLeadMs: 400, seed: 1 }))

  it('issues no corner calls at all', () => {
    expect(timeline.events.filter((event) => event.kind === 'call')).toHaveLength(0)
    expect(timeline.totalCalls).toBe(0)
  })

  it('issues no split-step ticks', () => {
    expect(timeline.events.filter((event) => event.kind === 'split-step')).toHaveLength(0)
  })

  it('tags each work block with the exercise to perform', () => {
    const work = timeline.blocks.filter((block) => block.phase === 'work')
    expect(work).toHaveLength(6)
    expect(work.map((block) => block.exerciseSlug)).toEqual([
      'ladder-in-out',
      'plyo-jump-squat',
      'core-plank-reach',
      'ladder-in-out',
      'plyo-jump-squat',
      'core-plank-reach',
    ])
  })

  it('still counts the player in before each exercise', () => {
    // Every work block here follows a rest or the prepare block, so all six
    // get a 3-2-1 even though none of them calls a corner.
    const countdowns = timeline.events.filter((event) => event.kind === 'countdown')
    expect(countdowns).toHaveLength(6 * 3)
  })

  it('counts every exercise block as working time', () => {
    expect(timeline.workMs).toBe((30 + 25 + 40) * 2 * 1000)
  })

  it('drops the trailing rest so the circuit ends on work or cool-down', () => {
    const beforeCooldown = timeline.blocks.at(-2)
    expect(timeline.blocks.at(-1)?.phase).toBe('cooldown')
    expect(beforeCooldown?.phase).toBe('work')
  })
})

describe('estimateDurationSec for a circuit', () => {
  it('matches what the timeline actually builds', () => {
    for (const rounds of [1, 2, 3]) {
      const built = config({ circuitRounds: rounds })
      const timeline = buildTimeline(planFromConfig(built, { splitStepLeadMs: 0, seed: 1 }))
      expect(estimateDurationSec(built)).toBe(timeline.totalMs / 1000)
    }
  })
})

describe('the exercise catalogue', () => {
  it('has no duplicate slugs', () => {
    const slugs = EXERCISES.map((exercise) => exercise.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('gives every exercise cues, faults and a summary', () => {
    for (const exercise of EXERCISES) {
      expect(exercise.cues.length).toBeGreaterThan(1)
      expect(exercise.faults.length).toBeGreaterThan(0)
      expect(exercise.summary.length).toBeGreaterThan(20)
    }
  })

  it('draws the exercises the figure can honestly represent', () => {
    /*
     * The rule is "a drawing that contradicts the cue is worse than no
     * drawing", not "everything must be drawn".
     *
     * There are two renderers. `poses` is the parametric one — squat, air,
     * tuck, arms — which suits a jump and cannot express an arm circle.
     * `mobility` is the jointed skeleton, which can now also tip the whole
     * body over and so covers push-ups and planks. A bodyweight exercise may
     * use either.
     *
     * Four of the strength exercises use neither, on purpose: a glute bridge,
     * a superman, a seated twist and a side plank are all defined by a
     * side-view silhouette, and this renderer draws a front view. Each of them
     * carries a comment saying so. They ship on their cues.
     */
    const UNDRAWABLE = new Set([
      'str-glute-bridge',
      'str-superman',
      'str-russian-twist',
      'str-side-plank',
    ])

    for (const exercise of EXERCISES) {
      // Ladder work is a footfall pattern; trained movement is drawn as poses.
      if (exercise.kind === 'ladder') expect(exercise.pattern?.length).toBeGreaterThan(2)
      if (
        (exercise.kind === 'plyometric' || exercise.kind === 'bodyweight') &&
        !UNDRAWABLE.has(exercise.slug)
      ) {
        const frames = exercise.poses?.length ?? exercise.mobility?.length ?? 0
        expect(frames, `${exercise.slug} has no diagram`).toBeGreaterThan(1)
      }
      // Anything opted out of a diagram must still say what to do instead.
      if (UNDRAWABLE.has(exercise.slug)) {
        expect(exercise.poses, `${exercise.slug}`).toBeUndefined()
        expect(exercise.mobility, `${exercise.slug}`).toBeUndefined()
        expect(exercise.cues.length, `${exercise.slug}`).toBeGreaterThan(2)
      }
      // Mobility and stretching are deliberately allowed to have no diagram.
      if (exercise.poses) expect(exercise.poses.length).toBeGreaterThan(1)
    }
  })

  it('tells you what to do without the kit whenever kit is needed', () => {
    for (const exercise of EXERCISES) {
      if (exercise.equipment !== 'none') expect(exercise.substitute).not.toBeNull()
    }
  })

  it('keeps pose parameters inside their documented ranges', () => {
    for (const exercise of EXERCISES) {
      for (const p of exercise.poses ?? []) {
        expect(p.squat).toBeGreaterThanOrEqual(0)
        expect(p.squat).toBeLessThanOrEqual(1)
        expect(p.air).toBeGreaterThanOrEqual(0)
        expect(p.air).toBeLessThanOrEqual(1)
        expect(p.tuck).toBeGreaterThanOrEqual(0)
        expect(p.tuck).toBeLessThanOrEqual(1)
        expect(p.arms).toBeGreaterThanOrEqual(-1)
        expect(p.arms).toBeLessThanOrEqual(1)
      }
    }
  })

  it('resolves every exercise a seeded circuit references', () => {
    for (const step of STEPS) {
      expect(findExercise(step.exerciseSlug)).toBeDefined()
    }
  })
})

describe('the warm-up and cool-down routines', () => {
  const routines = SEED_DRILLS.filter(
    (drill) => drill.category === 'warmup' || drill.category === 'cooldown',
  )

  it('ships a full warm-up, a quick one, and a cool-down', () => {
    expect(routines.map((drill) => drill.slug).sort()).toEqual([
      'cooldown-stretch',
      'warmup-full',
      'warmup-quick',
    ])
  })

  it('only names exercises that exist', () => {
    for (const drill of routines) {
      for (const step of drill.circuit ?? []) {
        expect(findExercise(step.exerciseSlug), step.exerciseSlug).toBeDefined()
      }
    }
  })

  it('flows continuously, with no rest blocks between movements', () => {
    // A warm-up that stops between every movement is a warm-up that cools you
    // down. Zero-length rests are dropped by the timeline entirely.
    for (const drill of routines) {
      for (const step of drill.circuit ?? []) expect(step.restSec).toBe(0)
    }
  })

  it('runs for about as long as it claims to', () => {
    const lengthOf = (slug: string) => {
      const drill = SEED_DRILLS.find((candidate) => candidate.slug === slug)
      const { totalMs } = buildTimeline(
        planFromConfig(configFromDrill(drill!), { splitStepLeadMs: 0, seed: 1 }),
      )
      return totalMs / 1000
    }
    // Named "6 min", "3 min" and "5 min" in the UI — keep the copy honest.
    expect(lengthOf('warmup-full')).toBeGreaterThan(5.5 * 60)
    expect(lengthOf('warmup-full')).toBeLessThan(7 * 60)
    expect(lengthOf('warmup-quick')).toBeGreaterThan(2.5 * 60)
    expect(lengthOf('warmup-quick')).toBeLessThan(3.75 * 60)
    expect(lengthOf('cooldown-stretch')).toBeLessThan(6 * 60)
  })

  it('needs no kit and no court, so there is never an excuse', () => {
    for (const drill of routines) {
      expect(drill.location).toBe('anywhere')
      expect(drill.equipment).toEqual([])
      for (const step of drill.circuit ?? []) {
        expect(findExercise(step.exerciseSlug)?.equipment).toBe('none')
      }
    }
  })

  it('builds up rather than opening with the sharp work', () => {
    const full = SEED_DRILLS.find((drill) => drill.slug === 'warmup-full')
    const slugs = (full?.circuit ?? []).map((step) => step.exerciseSlug)
    // Split-steps and corner movement are the potentiate phase — they belong
    // at the end, once everything is warm.
    expect(slugs.indexOf('mob-split-steps')).toBeGreaterThan(slugs.indexOf('mob-march'))
    expect(slugs.indexOf('mob-corner-walk')).toBeGreaterThan(slugs.indexOf('mob-ankle-rolls'))
  })
})
