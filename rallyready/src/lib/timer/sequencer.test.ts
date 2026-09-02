import { describe, expect, it } from 'vitest'

import { cornerIdsForLayout, type CornerId } from './corners'
import { patternById } from './patterns'
import { createRng } from './rng'
import { applyMode, createSequencer, modeFromConfig, normalizeSequencerConfig } from './sequencer'
import type { DrillMode, SequencerConfig } from './types'

function config(overrides: Partial<SequencerConfig> = {}): SequencerConfig {
  return {
    layout: 6,
    enabled: cornerIdsForLayout(6),
    selection: 'random',
    weights: {},
    avoidImmediateRepeat: true,
    deception: { enabled: false, probability: 0.35, gapMs: 600 },
    announce: 'position',
    strokes: null,
    patterns: [],
    ...overrides,
  }
}

function drawCorners(cfg: SequencerConfig, count: number, seed = 1234): CornerId[] {
  const sequencer = createSequencer(cfg, createRng(seed))
  return Array.from({ length: count }, () => sequencer.next().corner)
}

describe('normalizeSequencerConfig', () => {
  it('drops zones that do not exist in the layout', () => {
    const result = normalizeSequencerConfig(
      config({ layout: 4, enabled: ['net-left', 'mid-left', 'rear-right'] }),
    )
    expect(result.enabled).toEqual(['net-left', 'rear-right'])
  })

  it('restores numbered order regardless of how zones were supplied', () => {
    const result = normalizeSequencerConfig(
      config({ enabled: ['rear-right', 'net-left', 'mid-left'] }),
    )
    expect(result.enabled).toEqual(['net-left', 'mid-left', 'rear-right'])
  })

  it('falls back to the full layout when everything is disabled', () => {
    const result = normalizeSequencerConfig(config({ enabled: [] }))
    expect(result.enabled).toEqual(cornerIdsForLayout(6))
  })
})

describe('sequential selection', () => {
  it('walks the zones in numbered order and wraps around', () => {
    const corners = drawCorners(config({ selection: 'sequential' }), 8)
    expect(corners).toEqual([
      'net-left',
      'net-right',
      'mid-left',
      'mid-right',
      'rear-left',
      'rear-right',
      'net-left',
      'net-right',
    ])
  })

  it('only visits enabled zones', () => {
    const corners = drawCorners(
      config({ selection: 'sequential', enabled: ['net-left', 'rear-right'] }),
      5,
    )
    expect(corners).toEqual(['net-left', 'rear-right', 'net-left', 'rear-right', 'net-left'])
  })
})

describe('random selection', () => {
  it('never repeats a zone back-to-back when asked not to', () => {
    const corners = drawCorners(config({ avoidImmediateRepeat: true }), 2000)
    for (let i = 1; i < corners.length; i++) {
      expect(corners[i]).not.toBe(corners[i - 1])
    }
  })

  it('does allow repeats when the guard is off', () => {
    const corners = drawCorners(config({ avoidImmediateRepeat: false }), 2000)
    const repeats = corners.filter((corner, i) => i > 0 && corner === corners[i - 1])
    expect(repeats.length).toBeGreaterThan(0)
  })

  it('reaches every enabled zone', () => {
    const corners = drawCorners(config(), 600)
    expect(new Set(corners).size).toBe(6)
  })

  it('cannot avoid repeating when only one zone is enabled', () => {
    const corners = drawCorners(config({ enabled: ['net-left'] }), 4)
    expect(corners).toEqual(['net-left', 'net-left', 'net-left', 'net-left'])
  })

  it('is reproducible from a seed', () => {
    expect(drawCorners(config(), 50, 777)).toEqual(drawCorners(config(), 50, 777))
  })
})

describe('weighted selection', () => {
  it('favours the weighted zone roughly in proportion to its weight', () => {
    const corners = drawCorners(
      config({
        selection: 'weighted',
        avoidImmediateRepeat: false,
        weights: { 'rear-left': 5 },
      }),
      6000,
    )
    const counts = corners.reduce<Record<string, number>>((acc, corner) => {
      acc[corner] = (acc[corner] ?? 0) + 1
      return acc
    }, {})

    // rear-left carries weight 5 against five zones of weight 1 → ~50% of calls.
    const heavy = counts['rear-left'] ?? 0
    expect(heavy / corners.length).toBeGreaterThan(0.4)
    expect(heavy / corners.length).toBeLessThan(0.6)

    // Every other zone should sit near 10%.
    for (const id of cornerIdsForLayout(6)) {
      if (id === 'rear-left') continue
      const share = (counts[id] ?? 0) / corners.length
      expect(share).toBeGreaterThan(0.05)
      expect(share).toBeLessThan(0.16)
    }
  })

  it('treats a missing or invalid weight as 1', () => {
    const corners = drawCorners(
      config({
        selection: 'weighted',
        avoidImmediateRepeat: false,
        weights: { 'net-left': Number.NaN, 'net-right': 0, 'mid-left': -3 },
      }),
      6000,
    )
    for (const id of cornerIdsForLayout(6)) {
      const share = corners.filter((corner) => corner === id).length / corners.length
      expect(share).toBeGreaterThan(0.1)
      expect(share).toBeLessThan(0.23)
    }
  })

  it('still honours the no-repeat guard', () => {
    const corners = drawCorners(
      config({ selection: 'weighted', weights: { 'rear-left': 20 } }),
      1500,
    )
    for (let i = 1; i < corners.length; i++) {
      expect(corners[i]).not.toBe(corners[i - 1])
    }
  })
})

describe('deception', () => {
  const deceptive = config({
    deception: { enabled: true, probability: 0.4, gapMs: 600 },
  })

  it('feints on roughly the configured share of calls', () => {
    const sequencer = createSequencer(deceptive, createRng(2024))
    const plans = Array.from({ length: 4000 }, () => sequencer.next())
    const share = plans.filter((plan) => plan.feint !== undefined).length / plans.length
    expect(share).toBeGreaterThan(0.35)
    expect(share).toBeLessThan(0.45)
  })

  it('never feints towards the corner it is actually calling', () => {
    const sequencer = createSequencer(deceptive, createRng(99))
    for (let i = 0; i < 2000; i++) {
      const plan = sequencer.next()
      if (plan.feint) expect(plan.feint).not.toBe(plan.corner)
    }
  })

  it('emits no feint at all when only one zone is enabled', () => {
    const sequencer = createSequencer(
      {
        ...deceptive,
        enabled: ['net-left'],
        deception: { ...deceptive.deception, probability: 1 },
      },
      createRng(3),
    )
    for (let i = 0; i < 50; i++) {
      expect(sequencer.next().feint).toBeUndefined()
    }
  })

  it('feints on every call at probability 1', () => {
    const sequencer = createSequencer(
      { ...deceptive, deception: { enabled: true, probability: 1, gapMs: 600 } },
      createRng(11),
    )
    for (let i = 0; i < 100; i++) {
      expect(sequencer.next().feint).toBeDefined()
    }
  })
})

describe('mode mapping', () => {
  const modes: DrillMode[] = ['sequential', 'random', 'deception', 'number', 'weighted']

  it.each(modes)('round-trips %s through applyMode/modeFromConfig', (mode) => {
    expect(modeFromConfig(applyMode(config(), mode))).toBe(mode)
  })

  it('turns deception off for every non-deception mode', () => {
    for (const mode of modes.filter((m) => m !== 'deception')) {
      expect(
        applyMode(config({ deception: { enabled: true, probability: 1, gapMs: 600 } }), mode)
          .deception.enabled,
      ).toBe(false)
    }
  })

  it('announces numbers only in number mode', () => {
    expect(applyMode(config(), 'number').announce).toBe('number')
    expect(applyMode(config({ announce: 'number' }), 'random').announce).toBe('position')
  })
})

describe('pattern mode', () => {
  const ids = ['s-four-corners', 's-straight-game']

  it('plays a rally in the order it was written', () => {
    const pattern = patternById('s-four-corners')!
    const sequencer = createSequencer(
      config({ selection: 'pattern', patterns: [pattern.id] }),
      createRng(1),
    )
    for (const shot of pattern.shots) {
      const call = sequencer.next()
      expect(call.corner).toBe(shot.corner)
      expect(call.stroke).toBe(shot.stroke)
    }
  })

  it('says where it is in the rally, so the board can show it', () => {
    const sequencer = createSequencer(config({ selection: 'pattern', patterns: ids }), createRng(4))
    const first = sequencer.next()
    expect(first.pattern?.shotIndex).toBe(1)
    expect(first.pattern?.shots).toBeGreaterThan(2)
    expect(ids).toContain(first.pattern?.id)
  })

  it('starts a new rally when the last one runs out, and not the same one twice', () => {
    const sequencer = createSequencer(config({ selection: 'pattern', patterns: ids }), createRng(9))
    const seen: string[] = []
    for (let i = 0; i < 40; i += 1) {
      const call = sequencer.next()
      if (call.pattern?.shotIndex === 1) seen.push(call.pattern.id)
    }
    expect(seen.length).toBeGreaterThan(3)
    // Back-to-back repeats turn a pattern drill into a memory test.
    for (let i = 1; i < seen.length; i += 1) expect(seen[i]).not.toBe(seen[i - 1])
  })

  it('replays the same rallies for the same seed', () => {
    const run = () => {
      const sequencer = createSequencer(
        config({ selection: 'pattern', patterns: ids }),
        createRng(77),
      )
      return Array.from({ length: 20 }, () => sequencer.next().corner)
    }
    expect(run()).toEqual(run())
  })

  it('falls back to calling corners when the stored ids no longer exist', () => {
    // A renamed pattern must not stop a session somebody is standing on court
    // waiting to start.
    const sequencer = createSequencer(
      config({ selection: 'pattern', patterns: ['no-such-pattern'] }),
      createRng(3),
    )
    const call = sequencer.next()
    expect(call.pattern).toBeUndefined()
    expect(cornerIdsForLayout(6)).toContain(call.corner)
  })
})
