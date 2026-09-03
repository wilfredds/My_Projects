import { describe, expect, it } from 'vitest'

import { cornerIdsForLayout, CORNERS } from './corners'
import { cornersInPatterns, patternById, patternIsLegal, patternsFor, PATTERNS } from './patterns'
import { strokesForRow, STROKES } from './strokes'

describe('the rally patterns', () => {
  it('never asks for a shot that cannot be played from where it is called', () => {
    // The one thing that would make a pattern worse than no pattern: a
    // sequence that tells you to smash from the net has announced that it does
    // not know the game, and nothing after that is believed either.
    for (const pattern of PATTERNS) {
      for (const shot of pattern.shots) {
        expect(
          strokesForRow(CORNERS[shot.corner].row),
          `${pattern.id}: ${shot.stroke} from ${shot.corner}`,
        ).toContain(shot.stroke)
      }
      expect(patternIsLegal(pattern), pattern.id).toBe(true)
    }
  })

  it('only visits zones the standard board actually has', () => {
    // Patterns are authored against the six-zone layout so any board that can
    // run one can run all of them. A zone outside the layout would be called
    // with number 0 and light nothing.
    const six = cornerIdsForLayout(6)
    for (const corner of cornersInPatterns(PATTERNS)) {
      expect(six, corner).toContain(corner)
    }
  })

  it('keeps every shot inside the level it is offered at', () => {
    // A beginner pattern made of advanced strokes would hand somebody "hold,
    // drop" the first time they opened the app.
    const rank = { beginner: 0, intermediate: 1, advanced: 2 }
    for (const pattern of PATTERNS) {
      for (const shot of pattern.shots) {
        expect(
          rank[STROKES[shot.stroke].level],
          `${pattern.id} calls ${shot.stroke}`,
        ).toBeLessThanOrEqual(rank[pattern.level])
      }
    }
  })

  it('is a sequence rather than a single shot', () => {
    for (const pattern of PATTERNS) {
      expect(pattern.shots.length, pattern.id).toBeGreaterThan(2)
      expect(pattern.intent.length, pattern.id).toBeGreaterThan(40)
      // Short enough to sit on the board next to the corner you are running to.
      expect(pattern.name.length, pattern.id).toBeLessThanOrEqual(24)
    }
  })

  it('has no duplicate ids', () => {
    const ids = PATTERNS.map((pattern) => pattern.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(patternById(id)?.id).toBe(id)
  })

  it('gives both games something at every level', () => {
    for (const play of ['singles', 'doubles'] as const) {
      for (const level of ['beginner', 'intermediate', 'advanced'] as const) {
        expect(patternsFor(play, level).length, `${play} ${level}`).toBeGreaterThan(0)
      }
    }
  })

  it('opens up rather than swaps out as the player improves', () => {
    // Levelling up should never take a pattern away — the four-corner press is
    // still the four-corner press when you are good at it.
    const beginner = patternsFor('singles', 'beginner').map((p) => p.id)
    const advanced = patternsFor('singles', 'advanced').map((p) => p.id)
    for (const id of beginner) expect(advanced).toContain(id)
    expect(advanced.length).toBeGreaterThan(beginner.length)
  })

  it('keeps the two games apart', () => {
    // Not a filter for its own sake: side-by-side defence is meaningless in
    // singles and the six-corner press is not a doubles pattern.
    for (const pattern of patternsFor('singles', 'advanced')) expect(pattern.play).toBe('singles')
    for (const pattern of patternsFor('doubles', 'advanced')) expect(pattern.play).toBe('doubles')
    expect(patternsFor('both', 'advanced').length).toBe(PATTERNS.length)
  })
})
