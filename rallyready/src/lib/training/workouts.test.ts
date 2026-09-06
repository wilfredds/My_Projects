import { describe, expect, it } from 'vitest'

import { SEED_DRILLS, isConditioning, isPrepOrRecovery } from '@/lib/data/seed/drills'
import { findExercise } from '@/lib/data/seed/exercises'

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
