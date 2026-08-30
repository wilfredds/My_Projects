import { describe, expect, it } from 'vitest'

import { CORNERS, cornersForLayout, type CornerId } from './corners'
import { createRng } from './rng'
import {
  pickStroke,
  spokenCall,
  STROKES,
  strokesForRow,
  strokesForRows,
  type StrokeId,
} from './strokes'

describe('the stroke vocabulary', () => {
  it('never asks for a shot that cannot be played from there', () => {
    // The whole point of encoding this: a caller that says "smash" while you
    // are standing at the net has told you it does not know the game.
    expect(strokesForRow('net')).not.toContain('smash')
    expect(strokesForRow('net')).not.toContain('clear')
    expect(strokesForRow('rear')).not.toContain('net-shot')
    expect(strokesForRow('rear')).not.toContain('block')
  })

  it('gives every part of the court something to play', () => {
    for (const row of ['net', 'mid', 'rear'] as const) {
      expect(strokesForRow(row).length, row).toBeGreaterThan(1)
    }
  })

  it('describes every stroke it can call', () => {
    for (const id of Object.keys(STROKES) as StrokeId[]) {
      const stroke = STROKES[id]
      expect(stroke.spoken.length, id).toBeGreaterThan(2)
      expect(stroke.label.length, id).toBeGreaterThan(2)
      expect(stroke.description.length, id).toBeGreaterThan(20)
    }
  })

  it('only offers strokes that some row can actually produce', () => {
    const reachable = new Set([
      ...strokesForRow('net'),
      ...strokesForRow('mid'),
      ...strokesForRow('rear'),
    ])
    for (const id of Object.keys(STROKES) as StrokeId[]) {
      expect(reachable.has(id), `${id} is defined but unreachable`).toBe(true)
    }
  })

  it('picks only legal strokes, whatever the seed', () => {
    const rng = createRng(20260821)
    for (let i = 0; i < 400; i += 1) {
      for (const row of ['net', 'mid', 'rear'] as const) {
        expect(strokesForRow(row)).toContain(pickStroke(row, rng))
      }
    }
  })

  it('replays the same shots for the same seed', () => {
    // A challenge sends a seed. Same corners and different shots would not be
    // the same session.
    const draw = () => {
      const rng = createRng(7)
      return Array.from({ length: 30 }, () => pickStroke('rear', rng))
    }
    expect(draw()).toEqual(draw())
  })

  it('does not collapse to one shot', () => {
    const rng = createRng(99)
    const seen = new Set(Array.from({ length: 200 }, () => pickStroke('rear', rng)))
    expect(seen.size).toBe(strokesForRow('rear').length)
  })

  it('covers every layout the app offers', () => {
    for (const layout of [4, 6, 8] as const) {
      const rows = cornersForLayout(layout).map((corner) => CORNERS[corner.id as CornerId].row)
      expect(strokesForRows(rows).length, `layout ${layout}`).toBeGreaterThan(2)
    }
  })

  it('says the corner before the shot', () => {
    // Where to go, then what to do when you get there — in that order,
    // because you start moving before the second word lands.
    expect(spokenCall('rear left', 'smash')).toBe('rear left, smash')
  })
})
