import { describe, expect, it } from 'vitest'

import type { Discipline, SkillLevel } from '@/lib/data/types'
import { STROKES } from '@/lib/timer/strokes'

import {
  newAtLevel,
  patternsForProfile,
  scaleVolume,
  vocabularyFor,
  volumeSeconds,
  weightsFor,
  workSeconds,
  type Volume,
} from './profile'

const LEVELS: SkillLevel[] = ['beginner', 'intermediate', 'advanced']
const BASE: Volume = { rounds: 6, workSec: 40, restSec: 20, intervalMs: 1400 }

describe('the shot vocabulary', () => {
  it('grows with the player and never shrinks', () => {
    const [beginner, intermediate, advanced] = LEVELS.map(vocabularyFor) as [
      string[],
      string[],
      string[],
    ]
    for (const id of beginner) expect(intermediate).toContain(id)
    for (const id of intermediate) expect(advanced).toContain(id)
    expect(advanced.length).toBeGreaterThan(beginner.length)
  })

  it('starts with the shots and adds the ways of playing them', () => {
    // A beginner is asked for a drop. An advanced player is asked to hold it.
    expect(vocabularyFor('beginner')).toContain('drop')
    expect(vocabularyFor('beginner')).not.toContain('hold-drop')
    expect(vocabularyFor('advanced')).toContain('hold-drop')
  })

  it('adds something at every level', () => {
    for (const level of LEVELS) expect(newAtLevel(level).length, level).toBeGreaterThan(0)
  })

  it('describes every shot it can call', () => {
    for (const id of vocabularyFor('advanced')) {
      expect(STROKES[id].description.length, id).toBeGreaterThan(30)
    }
  })
})

describe('the court, by game', () => {
  it('sends a singles player to the corners and a doubles player to the middle', () => {
    const singles = weightsFor('singles')
    const doubles = weightsFor('doubles')
    expect(singles['rear-left']).toBeGreaterThan(singles['mid-left'] as number)
    expect(doubles['mid-left']).toBeGreaterThan(doubles['rear-left'] as number)
    // Nothing is switched off: a doubles player still has to cover the back.
    for (const weights of [singles, doubles]) {
      for (const weight of Object.values(weights)) expect(weight).toBeGreaterThan(0)
    }
  })

  it('leaves the court alone for somebody who plays both', () => {
    expect(weightsFor('both')).toEqual({})
  })
})

describe('volume by level', () => {
  it('gives a beginner fewer rounds, longer rest and slower calls', () => {
    const scaled = scaleVolume(BASE, 'beginner')
    expect(scaled.rounds).toBeLessThan(BASE.rounds)
    expect(scaled.restSec).toBeGreaterThan(BASE.restSec)
    // Slower calls are the point: the drill is not easier, there is time to
    // arrive properly rather than to arrive late.
    expect(scaled.intervalMs).toBeGreaterThan(BASE.intervalMs)
  })

  it('leaves an intermediate session exactly as the drill was written', () => {
    expect(scaleVolume(BASE, 'intermediate')).toEqual(BASE)
  })

  it('gives an advanced player more work and less recovery', () => {
    const scaled = scaleVolume(BASE, 'advanced')
    expect(scaled.rounds).toBeGreaterThan(BASE.rounds)
    expect(scaled.restSec).toBeLessThan(BASE.restSec)
    expect(scaled.intervalMs).toBeLessThan(BASE.intervalMs)
    expect(workSeconds(scaled)).toBeGreaterThan(workSeconds(BASE) * 1.4)
  })

  it('keeps every scaled plan inside what the setup screen can show', () => {
    const extremes: Volume[] = [
      { rounds: 1, workSec: 5, restSec: 1, intervalMs: 400 },
      { rounds: 40, workSec: 600, restSec: 600, intervalMs: 5000 },
    ]
    for (const base of extremes) {
      for (const level of LEVELS) {
        const scaled = scaleVolume(base, level)
        expect(scaled.rounds).toBeGreaterThanOrEqual(2)
        expect(scaled.rounds).toBeLessThanOrEqual(20)
        expect(scaled.intervalMs).toBeGreaterThanOrEqual(800)
        expect(scaled.intervalMs).toBeLessThanOrEqual(3000)
        expect(scaled.workSec).toBeLessThanOrEqual(300)
        expect(scaled.restSec).toBeGreaterThanOrEqual(5)
      }
    }
  })

  it('counts the clock the way the timeline does', () => {
    // Six rounds means five rests: you do not rest at the end of a session.
    expect(volumeSeconds(BASE)).toBe(6 * 40 + 5 * 20)
    expect(workSeconds(BASE)).toBe(240)
  })

  it('does not make an advanced session longer, only denser', () => {
    const advanced = scaleVolume(BASE, 'advanced')
    expect(workSeconds(advanced) / volumeSeconds(advanced)).toBeGreaterThan(
      workSeconds(BASE) / volumeSeconds(BASE),
    )
  })
})

describe('patterns for a profile', () => {
  it('matches the game and the level', () => {
    for (const discipline of ['singles', 'doubles'] as Discipline[]) {
      for (const pattern of patternsForProfile({ discipline, level: 'advanced' })) {
        expect(pattern.play).toBe(discipline)
      }
    }
    const both = patternsForProfile({ discipline: 'both', level: 'beginner' })
    expect(both.some((p) => p.play === 'singles')).toBe(true)
    expect(both.some((p) => p.play === 'doubles')).toBe(true)
    for (const pattern of both) expect(pattern.level).toBe('beginner')
  })
})
