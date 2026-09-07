import { describe, expect, it } from 'vitest'

import { SEED_DRILLS } from '@/lib/data/seed/drills'
import type { DrillLocation, SkillLevel } from '@/lib/data/types'

import { countSessions, periodise, phaseByWeek, pooledSlugs, type ProgramSpec } from './periodise'

const spec = (overrides: Partial<ProgramSpec> = {}): ProgramSpec => ({
  totalWeeks: 12,
  sessionsPerWeek: 4,
  level: 'intermediate',
  location: 'court',
  ...overrides,
})

const LEVELS: SkillLevel[] = ['beginner', 'intermediate', 'advanced']
const LOCATIONS: DrillLocation[] = ['court', 'anywhere']

describe('phaseByWeek', () => {
  it('deloads every fourth week and tapers at the end', () => {
    expect(phaseByWeek(12)).toEqual([
      'base',
      'base',
      'base',
      'deload',
      'build',
      'build',
      'build',
      'deload',
      'sharpen',
      'sharpen',
      'sharpen',
      'deload',
    ])
  })

  it('still reaches all four phases in a short program', () => {
    const phases = phaseByWeek(8)
    expect(new Set(phases)).toEqual(new Set(['base', 'build', 'sharpen', 'deload']))
    expect(phases.at(-1)).toBe('deload')
  })

  it('always finishes on a deload, whatever the length', () => {
    for (let weeks = 4; weeks <= 16; weeks++) {
      expect(phaseByWeek(weeks).at(-1)).toBe('deload')
    }
  })

  it('never moves backwards through the loading phases', () => {
    const order = { base: 0, build: 1, sharpen: 2 } as const
    for (let weeks = 4; weeks <= 16; weeks++) {
      const loading = phaseByWeek(weeks).filter((phase) => phase !== 'deload')
      for (let i = 1; i < loading.length; i++) {
        const previous = order[loading[i - 1] as keyof typeof order]
        expect(order[loading[i] as keyof typeof order]).toBeGreaterThanOrEqual(previous)
      }
    }
  })

  it('gives base at least as many weeks as the later blocks', () => {
    const phases = phaseByWeek(12)
    const count = (p: string) => phases.filter((phase) => phase === p).length
    expect(count('base')).toBeGreaterThanOrEqual(count('sharpen'))
  })

  it('clamps absurd lengths into something runnable', () => {
    expect(phaseByWeek(1)).toHaveLength(4)
    expect(phaseByWeek(400)).toHaveLength(16)
    expect(phaseByWeek(Number.NaN)).toHaveLength(8)
  })
})

describe('periodise', () => {
  it('emits every day of every week', () => {
    const days = periodise(spec({ totalWeeks: 10 }))
    expect(days).toHaveLength(70)
    for (let week = 1; week <= 10; week++) {
      const inWeek = days.filter((day) => day.weekNo === week)
      expect(inWeek.map((day) => day.dayNo)).toEqual([1, 2, 3, 4, 5, 6, 7])
    }
  })

  it('schedules the requested number of sessions in a loading week', () => {
    for (const sessionsPerWeek of [2, 3, 4, 5]) {
      const days = periodise(spec({ sessionsPerWeek }))
      const week1 = days.filter((day) => day.weekNo === 1 && day.focus !== 'rest')
      expect(week1).toHaveLength(sessionsPerWeek)
    }
  })

  it('backs the volume off on a deload week', () => {
    const days = periodise(spec({ totalWeeks: 12, sessionsPerWeek: 5 }))
    const load = days.filter((day) => day.weekNo === 1 && day.focus !== 'rest').length
    const deload = days.filter((day) => day.weekNo === 4 && day.focus !== 'rest').length
    expect(deload).toBeLessThan(load)
    expect(deload).toBeGreaterThanOrEqual(2)
  })

  it('makes rest days explicit rather than leaving gaps', () => {
    const days = periodise(spec({ sessionsPerWeek: 3 }))
    const week1 = days.filter((day) => day.weekNo === 1)
    expect(week1.filter((day) => day.focus === 'rest')).toHaveLength(4)
    for (const day of week1.filter((d) => d.focus === 'rest')) {
      expect(day.drillSlugs).toEqual([])
      expect(day.notes).toContain('Rest days are part of the plan')
    }
  })

  it('only ever references drills that exist', () => {
    const known = new Set(SEED_DRILLS.map((drill) => drill.slug))
    for (const level of LEVELS) {
      for (const location of LOCATIONS) {
        for (const day of periodise(spec({ level, location }))) {
          for (const slug of day.drillSlugs) expect(known.has(slug)).toBe(true)
        }
      }
    }
  })

  it('has no pool entry that does not resolve to a drill', () => {
    // Stronger than checking a generated program: a pool entry that is never
    // reached by the default spec would still be a typo waiting for the week
    // it comes up in.
    const known = new Set(SEED_DRILLS.map((drill) => drill.slug))
    for (const slug of pooledSlugs()) expect(known.has(slug), slug).toBe(true)
  })

  it('puts the home workouts in front of somebody following a home program', () => {
    // A pool is the only way a drill reaches a program follower. The home
    // circuits and the rally patterns both sat outside these lists when they
    // were added, so they existed only for people who browse.
    const used = new Set<string>()
    for (const level of LEVELS) {
      for (const day of periodise(spec({ level, location: 'anywhere', totalWeeks: 16 }))) {
        for (const slug of day.drillSlugs) used.add(slug)
      }
    }
    for (const slug of ['home-full-body', 'quiet-room-workout', 'skipping-intervals']) {
      expect(used, slug).toContain(slug)
    }
  })

  it('puts the rally patterns in front of somebody following a court program', () => {
    const used = new Set<string>()
    for (const level of LEVELS) {
      for (const day of periodise(spec({ level, location: 'court', totalWeeks: 16 }))) {
        for (const slug of day.drillSlugs) used.add(slug)
      }
    }
    expect([...used].some((slug) => slug.endsWith('rally-patterns'))).toBe(true)
  })

  it('uses only no-court drills for an anywhere program', () => {
    const anywhere = new Set(
      SEED_DRILLS.filter((drill) => drill.location === 'anywhere').map((drill) => drill.slug),
    )
    for (const day of periodise(spec({ location: 'anywhere' }))) {
      for (const slug of day.drillSlugs) expect(anywhere.has(slug)).toBe(true)
    }
  })

  it('keeps reaction work away from beginners', () => {
    const advancedSlugs = new Set(['deception-reaction'])
    const days = periodise(spec({ level: 'beginner' }))
    for (const day of days) {
      for (const slug of day.drillSlugs) expect(advancedSlugs.has(slug)).toBe(false)
    }
    // …but an advanced player does get it.
    const sharp = periodise(spec({ level: 'advanced' }))
    expect(sharp.some((day) => day.drillSlugs.includes('deception-reaction'))).toBe(true)
  })

  it('gives every training day a drill or marks it as match play', () => {
    for (const day of periodise(spec())) {
      if (day.focus === 'rest') continue
      if (day.focus === 'matchplay') expect(day.drillSlugs).toEqual([])
      else expect(day.drillSlugs.length).toBeGreaterThan(0)
    }
  })

  it('varies the sessions rather than repeating one drill all program', () => {
    const days = periodise(spec({ totalWeeks: 12, sessionsPerWeek: 4 }))
    const used = new Set(days.flatMap((day) => day.drillSlugs))
    expect(used.size).toBeGreaterThanOrEqual(4)
  })

  it('does not put the same session on the same weekday two weeks running', () => {
    const days = periodise(spec({ totalWeeks: 6, sessionsPerWeek: 4 }))
    let identical = 0
    for (let week = 2; week <= 6; week++) {
      for (let dayNo = 1; dayNo <= 7; dayNo++) {
        const now = days.find((d) => d.weekNo === week && d.dayNo === dayNo)
        const before = days.find((d) => d.weekNo === week - 1 && d.dayNo === dayNo)
        if (!now || !before || now.focus === 'rest') continue
        if (now.title === before.title) identical += 1
      }
    }
    // Some repetition is fine across a whole program; wholesale is not.
    expect(identical).toBeLessThan(6)
  })

  it('progresses the emphasis from base towards speed work', () => {
    const days = periodise(spec({ totalWeeks: 12, level: 'advanced' }))
    const inPhase = (phase: string) =>
      days.filter((day) => day.phase === phase).flatMap((day) => day.drillSlugs)
    expect(inPhase('sharpen')).toContain('deception-reaction')
    expect(inPhase('base')).not.toContain('deception-reaction')
  })

  it('keeps the hardest drills out of base and deload weeks', () => {
    // The two that would hurt a returning player most in week one: a plyometric
    // circuit off court, and a tabata on it.
    const gentle = (location: DrillLocation, banned: string[]) => {
      for (const day of periodise(spec({ location, level: 'advanced', totalWeeks: 16 }))) {
        if (day.phase !== 'base' && day.phase !== 'deload') continue
        for (const slug of day.drillSlugs) expect(banned).not.toContain(slug)
      }
    }
    gentle('anywhere', ['plyometric-power-circuit', 'tabata-shadow'])
    gentle('court', ['rally-hiit', 'tabata-shadow', 'deception-reaction'])
  })

  it('does reach the hard end of the pool by the sharpen block', () => {
    const days = periodise(spec({ location: 'anywhere', level: 'advanced', totalWeeks: 16 }))
    const sharpen = days.filter((day) => day.phase === 'sharpen').flatMap((day) => day.drillSlugs)
    expect(sharpen).toContain('plyometric-power-circuit')
  })

  it('is deterministic', () => {
    expect(periodise(spec())).toEqual(periodise(spec()))
  })

  it('counts its own sessions', () => {
    const days = periodise(spec({ totalWeeks: 8, sessionsPerWeek: 3 }))
    expect(countSessions(days)).toBe(days.filter((day) => day.focus !== 'rest').length)
  })
})
