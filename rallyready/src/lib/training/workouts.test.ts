import { describe, expect, it } from 'vitest'

import { SEED_DRILLS, isConditioning, isPrepOrRecovery } from '@/lib/data/seed/drills'
import { EXERCISES, findExercise } from '@/lib/data/seed/exercises'

import { factsFor, groupWorkouts, matchesFilter, WORKOUT_GROUPS } from './workouts'

const bySlug = (slug: string) => SEED_DRILLS.find((drill) => drill.slug === slug)!

/** Everything the workouts screen lists. */
const WORKOUTS = SEED_DRILLS.filter((drill) => isConditioning(drill) || isPrepOrRecovery(drill))

describe('what a workout needs', () => {
  it('is as loud as its loudest movement', () => {
    // Derived rather than typed onto the workout: a label somebody has to
    // remember to update is a label that is wrong within a month.
    const full = factsFor(bySlug('home-full-body'))
    expect(full.quiet).toBe(false)
    const quiet = factsFor(bySlug('quiet-room-workout'))
    expect(quiet.quiet).toBe(true)
    for (const step of bySlug('quiet-room-workout').circuit ?? []) {
      expect(findExercise(step.exerciseSlug)?.noisy, step.exerciseSlug).toBe(false)
    }
  })

  it('needs as much room as its largest movement', () => {
    expect(factsFor(bySlug('quiet-room-workout')).space).toBe('spot')
    // Shuttle runs need a few strides, so anything containing them does too.
    const roomy = SEED_DRILLS.filter((drill) =>
      (drill.circuit ?? []).some((step) => step.exerciseSlug === 'cond-shuttle-run'),
    )
    for (const drill of roomy) expect(factsFor(drill).space, drill.slug).not.toBe('spot')
  })

  it('does not call a shadow drill quiet or towel-sized', () => {
    // No circuit means it calls corners: you are moving between zones and
    // landing lunges, which needs strides and is audible downstairs. Defaulting
    // these the other way had four minutes of Tabata jumping advertised as the
    // neighbour-friendly option.
    for (const drill of WORKOUTS) {
      if (drill.circuit?.length) continue
      const facts = factsFor(drill)
      expect(facts.space, drill.slug).not.toBe('spot')
      expect(facts.quiet, drill.slug).toBe(false)
    }
  })

  it('names the kit rather than leaving you to find out mid-session', () => {
    expect(factsFor(bySlug('skipping-intervals')).equipment.join(' ')).toMatch(/rope/i)
    expect(factsFor(bySlug('quiet-room-workout')).equipment).toEqual([])
  })

  it('counts the exercises in the circuit', () => {
    for (const drill of WORKOUTS) {
      if (!drill.circuit?.length) continue
      expect(factsFor(drill).exercises, drill.slug).toBe(drill.circuit.length)
    }
  })
})

describe('the workouts screen', () => {
  it('has somewhere to put every workout', () => {
    // A workout in no group is a workout nobody can find.
    const grouped = new Set(
      groupWorkouts(WORKOUTS).flatMap((entry) => entry.drills.map((drill) => drill.slug)),
    )
    for (const drill of WORKOUTS) expect(grouped, drill.slug).toContain(drill.slug)
  })

  it('drops groups that would render empty', () => {
    const only = groupWorkouts([bySlug('quiet-room-workout')])
    expect(only).toHaveLength(1)
    expect(only[0]?.group.id).toBe('strength')
  })

  it('leaves a home player something to do in every case', () => {
    // The point of the filters: somebody in a small flat at eleven at night
    // should still be offered a real session, not an empty screen.
    const strict = WORKOUTS.filter((drill) =>
      matchesFilter(drill, { smallSpace: true, quietOnly: true }),
    )
    expect(strict.length).toBeGreaterThan(2)
    for (const drill of strict) {
      const facts = factsFor(drill)
      expect(facts.space, drill.slug).toBe('spot')
      expect(facts.quiet, drill.slug).toBe(true)
    }
  })

  it('gives every group a title and a reason to exist', () => {
    for (const group of WORKOUT_GROUPS) {
      expect(group.title.length).toBeGreaterThan(3)
      expect(group.blurb.length).toBeGreaterThan(25)
      expect(group.categories.length).toBeGreaterThan(0)
    }
  })
})

describe('the kit a workout asks for', () => {
  it('never asks for the same thing twice', () => {
    /*
     * The derived label is a fallback for a drill that did not list its kit.
     * Adding it on top of a drill that did produced cards reading "skipping
     * rope (optional)" next to "skipping rope" — the same item, asked for
     * twice, in two different voices.
     */
    for (const drill of SEED_DRILLS) {
      const listed = factsFor(drill).equipment.map((item) => item.toLowerCase())
      for (const word of ['ladder', 'rope', 'step', 'box', 'bench']) {
        const hits = listed.filter((item) => item.includes(word))
        expect(hits.length, `${drill.slug}: ${JSON.stringify(hits)}`).toBeLessThan(2)
      }
    }
  })

  it('still names kit a drill forgot to list', () => {
    // The fallback has to survive: a circuit that needs a rope and says
    // nothing must not look like it needs nothing.
    const forgot = {
      ...SEED_DRILLS.find((drill) => drill.slug === 'skipping-intervals')!,
      equipment: [],
    }
    expect(factsFor(forgot).equipment).toContain('skipping rope')
  })

  it('keeps the drill’s own wording, which says what a generic label cannot', () => {
    // "(optional)" and "(or tape)" are the words that decide whether somebody
    // without the kit can do the workout at all.
    const ladder = SEED_DRILLS.find((drill) => drill.slug === 'agility-ladder-circuit')!
    expect(factsFor(ladder).equipment).toEqual(['agility ladder (or tape)'])
  })
})

describe('the exercise catalogue', () => {
  it('never lists two exercises under one name', () => {
    // Two entries called "Plank shoulder taps" and two called "High knees"
    // sat in the library for two phases, each pair written up differently, so
    // the same movement appeared twice and neither entry looked canonical.
    const byName = new Map<string, string[]>()
    for (const exercise of EXERCISES) {
      const key = exercise.name.toLowerCase()
      byName.set(key, [...(byName.get(key) ?? []), exercise.slug])
    }
    const clashes = [...byName].filter(([, slugs]) => slugs.length > 1)
    expect(clashes, JSON.stringify(clashes)).toEqual([])
  })

  it('has an exercise for every circuit step that names one', () => {
    for (const drill of SEED_DRILLS) {
      for (const step of drill.circuit ?? []) {
        expect(
          EXERCISES.some((exercise) => exercise.slug === step.exerciseSlug),
          `${drill.slug} → ${step.exerciseSlug}`,
        ).toBe(true)
      }
    }
  })
})
