import { describe, expect, it } from 'vitest'

import {
  challengeMessage,
  challengeUrl,
  decodeChallenge,
  encodeChallenge,
  type Challenge,
} from './challenge'

const base: Challenge = {
  drill: 'six-corner-shadow',
  seed: 918_273,
  level: 'intermediate' as const,
  rounds: 6,
  workSec: 45,
  restSec: 30,
  intervalMs: 1400,
  target: 142,
  from: 'Wilfred',
}

const round = (challenge: Challenge) => {
  const result = decodeChallenge(encodeChallenge(challenge))
  if (!result.ok) throw new Error(result.error)
  return result.challenge
}

describe('encode and decode', () => {
  it('survives a full round trip unchanged', () => {
    expect(round(base)).toEqual(base)
  })

  it('carries the seed exactly — the whole point is an identical session', () => {
    for (const seed of [0, 1, 42, 999_999, 2_147_483_647]) {
      expect(round({ ...base, seed }).seed).toBe(seed)
    }
  })

  it('handles an open challenge with no score to beat', () => {
    const open = round({ ...base, target: null })
    expect(open.target).toBeNull()
  })

  it('handles an anonymous challenge', () => {
    expect(round({ ...base, from: null }).from).toBeNull()
  })

  it('does not let a hyphen in a name break the format', () => {
    const tricky = round({ ...base, from: 'Anne-Marie' })
    expect(tricky.from).toBe('Anne-Marie')
    expect(tricky.drill).toBe(base.drill)
  })

  it('does not let a hyphen in a drill slug break the format', () => {
    expect(round({ ...base, drill: 'rear-court-scissor' }).drill).toBe('rear-court-scissor')
  })

  it('produces a code with no characters that get misread aloud', () => {
    const code = encodeChallenge({ ...base, drill: 'x', from: null })
    // The numeric part must avoid O/0 and I/1; the drill slug is its own text.
    const numeric = code.split(',').slice(0, 7).join('')
    expect(numeric).not.toMatch(/[O0I1]/)
  })

  it('trims an absurdly long name rather than shipping it', () => {
    const long = 'x'.repeat(200)
    expect((round({ ...base, from: long }).from ?? '').length).toBeLessThanOrEqual(24)
  })
})

describe('decodeChallenge', () => {
  it('refuses an empty string with something actionable', () => {
    const result = decodeChallenge('   ')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/paste/i)
  })

  it('refuses obvious rubbish', () => {
    for (const junk of ['hello', 'not-a-code', '????', 'https://example.com']) {
      expect(decodeChallenge(junk).ok).toBe(false)
    }
  })

  it('refuses a code from a newer version rather than guessing', () => {
    const future = encodeChallenge(base).replace(/^[^,]+/, 'Z')
    const result = decodeChallenge(future)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/newer version/i)
  })

  it('ignores surrounding whitespace from a paste', () => {
    expect(decodeChallenge(`\n  ${encodeChallenge(base)}  \n`).ok).toBe(true)
  })

  it('clamps a hand-edited code instead of trusting it', () => {
    // Somebody editing the numbers must not be able to start a nine-hour drill.
    const evil = encodeChallenge({
      ...base,
      rounds: 9999,
      workSec: 99_999,
      intervalMs: 1,
    })
    const result = decodeChallenge(evil)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.challenge.rounds).toBeLessThanOrEqual(30)
    expect(result.challenge.workSec).toBeLessThanOrEqual(600)
    expect(result.challenge.intervalMs).toBeGreaterThanOrEqual(500)
  })

  it('refuses a code missing its drill', () => {
    const parts = encodeChallenge(base).split(',')
    parts[7] = ''
    expect(decodeChallenge(parts.join(',')).ok).toBe(false)
  })

  it('refuses a truncated code', () => {
    const code = encodeChallenge(base)
    expect(decodeChallenge(code.slice(0, 6)).ok).toBe(false)
  })
})

describe('sharing', () => {
  it('builds a link without doubling the slash', () => {
    expect(challengeUrl('https://rallyready.app/', 'ABC')).toBe(
      'https://rallyready.app/challenge/ABC',
    )
  })

  it('escapes a code so it survives being a path segment', () => {
    expect(challengeUrl('https://x.test', 'a b')).toContain('a%20b')
  })

  it('writes a message short enough for a chat, naming the score to beat', () => {
    const message = challengeMessage(base, 'Six-Corner Shadow', 'https://x.test/c/ABC')
    expect(message).toContain('Six-Corner Shadow')
    expect(message).toContain('142')
    expect(message.length).toBeLessThan(200)
  })

  it('does not invent a score for an open challenge', () => {
    const message = challengeMessage({ ...base, target: null }, 'Drill', 'https://x.test')
    expect(message).not.toMatch(/\d+ calls/)
  })
})

describe('the level a challenge was set at', () => {
  it('travels with the code, because it decides the shots', () => {
    // Level chooses the shot vocabulary and the rally patterns, so the same
    // seed at a different level is a different session under the same name.
    for (const level of ['beginner', 'intermediate', 'advanced'] as const) {
      const decoded = decodeChallenge(encodeChallenge({ ...base, level }))
      expect(decoded.ok && decoded.challenge.level).toBe(level)
    }
  })

  it('reads a code from before it existed as intermediate', () => {
    // Version 1 codes have no level field. That is an older sender, not damage,
    // and intermediate is what every drill's own defaults are written at.
    const v2 = encodeChallenge({ ...base, level: 'advanced' })
    const v1 = v2.split(',').slice(0, -1).join(',')
    const decoded = decodeChallenge(v1)
    expect(decoded.ok).toBe(true)
    expect(decoded.ok && decoded.challenge.level).toBe('intermediate')
    // Everything before the new field still lands where it did.
    expect(decoded.ok && decoded.challenge.seed).toBe(base.seed)
    expect(decoded.ok && decoded.challenge.drill).toBe(base.drill)
  })
})
