import { findExercise, type Equipment, type SpaceNeeded } from '@/lib/data/seed/exercises'
import type { Drill, DrillCategory } from '@/lib/data/types'

/**
 * The workouts, as somebody training at home needs to see them.
 *
 * Conditioning was a tab on the training screen and the workouts inside it
 * were listed the way drills are listed — by name and duration. That is the
 * wrong first question for this app. Most people using it are in a bedroom or
 * a garage, and what they need to know before anything else is whether the
 * thing fits, whether it will wake the house, and whether it needs kit they do
 * not own.
 *
 * All three are *derived* from the exercises a workout actually contains
 * rather than typed onto the workout, because a hand-maintained label goes
 * stale the first time somebody swaps an exercise in. A circuit is as loud as
 * its loudest movement and needs as much room as its largest.
 */

export interface WorkoutFacts {
  /** The most any single exercise in it needs. */
  space: SpaceNeeded
  /** True when nothing in it lands hard enough for the flat below to hear. */
  quiet: boolean
  /** Anything you need that is not your own body. */
  equipment: string[]
  exercises: number
}

const SPACE_RANK: Record<SpaceNeeded, number> = { spot: 0, room: 1, court: 2 }

const EQUIPMENT_LABEL: Partial<Record<Equipment, string>> = {
  ladder: 'agility ladder',
  step: 'a step or low bench',
  rope: 'skipping rope',
}

/**
 * Words that mean a drill has already named a piece of kit.
 *
 * The derived label is a fallback for a drill that forgot to list what it
 * needs. Where the drill *did* list it, its own wording wins — it says whether
 * the thing is optional and what will do instead, which a generic label cannot
 * — and adding the label as well produced cards that asked for the same item
 * twice: "skipping rope (optional)" next to "skipping rope".
 */
const EQUIPMENT_WORDS: Partial<Record<Equipment, string[]>> = {
  ladder: ['ladder'],
  step: ['step', 'box', 'bench'],
  rope: ['rope'],
}

function alreadyNamed(listed: string[], kind: Equipment): boolean {
  const words = EQUIPMENT_WORDS[kind]
  if (!words) return false
  return listed.some((item) => words.some((word) => item.toLowerCase().includes(word)))
}

export function factsFor(drill: Drill): WorkoutFacts {
  const steps = drill.circuit ?? []
  const exercises = steps
    .map((step) => findExercise(step.exerciseSlug))
    .filter((exercise) => exercise !== undefined)

  /*
   * A drill with no circuit is a corner-calling one, and its floor comes from
   * the court model rather than from an exercise list: you are moving between
   * zones and landing lunges, so it needs strides and it is not quiet. The
   * first version defaulted these to "fits a towel, quiet", which had Tabata
   * Shadow — four minutes of jumping — advertised as the neighbour-friendly
   * option.
   */
  const callsCorners = exercises.length === 0
  let space: SpaceNeeded = drill.location === 'court' ? 'court' : callsCorners ? 'room' : 'spot'
  let quiet = !callsCorners
  // The drill's own list first, so its wording is the one the card shows.
  const equipment = [...drill.equipment]

  for (const exercise of exercises) {
    if (SPACE_RANK[exercise.space] > SPACE_RANK[space]) space = exercise.space
    if (exercise.noisy) quiet = false
    const label = EQUIPMENT_LABEL[exercise.equipment]
    if (label && !alreadyNamed(equipment, exercise.equipment)) equipment.push(label)
  }

  return { space, quiet, equipment, exercises: exercises.length }
}

export const SPACE_LABEL: Record<SpaceNeeded, string> = {
  spot: 'Fits a towel',
  room: 'Needs a few strides',
  court: 'Needs a court',
}

/* ----------------------------------------------------------------- groups */

export interface WorkoutGroup {
  id: string
  title: string
  blurb: string
}

/**
 * Ordered so the list reads as a session would be built: the thing that keeps
 * you playing first, then the work, then the bookends.
 */
export const WORKOUT_GROUPS: (WorkoutGroup & { categories: DrillCategory[] })[] = [
  {
    id: 'stamina',
    title: 'Full body and stamina',
    blurb: 'Timed circuits that leave you breathing hard. The bulk of home training.',
    categories: ['conditioning'],
  },
  {
    id: 'power',
    title: 'Power',
    blurb: 'Short blocks, long rests. Jump height and the first step out of a lunge.',
    categories: ['plyometric'],
  },
  {
    id: 'strength',
    title: 'Strength',
    blurb: 'Push, squat, hinge, brace — and the shoulder work that keeps you playing.',
    categories: ['strength'],
  },
  {
    id: 'agility',
    title: 'Feet',
    blurb: 'Foot speed and coordination, off the court.',
    categories: ['agility'],
  },
  {
    id: 'bookends',
    title: 'Warm up and recover',
    blurb: 'The five minutes either side that decide whether tomorrow happens.',
    categories: ['warmup', 'cooldown'],
  },
]

export interface WorkoutFilter {
  /** Only what fits in the space of a towel. */
  smallSpace?: boolean
  /** Only what the neighbours cannot hear. */
  quietOnly?: boolean
}

export function matchesFilter(drill: Drill, filter: WorkoutFilter): boolean {
  const facts = factsFor(drill)
  if (filter.smallSpace && facts.space !== 'spot') return false
  if (filter.quietOnly && !facts.quiet) return false
  return true
}

/** Every workout, grouped and filtered, with empty groups dropped. */
export function groupWorkouts(
  drills: Drill[],
  filter: WorkoutFilter = {},
): { group: WorkoutGroup; drills: Drill[] }[] {
  const matching = drills.filter((drill) => matchesFilter(drill, filter))
  return WORKOUT_GROUPS.map(({ categories, ...group }) => ({
    group,
    drills: matching.filter((drill) => categories.includes(drill.category)),
  })).filter((entry) => entry.drills.length > 0)
}
