import { describe, expect, it } from 'vitest'

import { CORNERS, type CornerId } from '@/lib/timer/corners'
import { STROKES, type StrokeId } from '@/lib/timer/strokes'
import type { BlockPhase } from '@/lib/timer/types'

import {
  CALL_LANGUAGES,
  callText,
  completeText,
  cornerText,
  LANGUAGE_INTERVAL_FACTOR,
  numberText,
  phaseText,
  utteranceLang,
  voiceMatches,
  type CallLanguage,
} from './language'

const cornerIds = Object.keys(CORNERS) as CornerId[]
const strokeIds = Object.keys(STROKES) as StrokeId[]
/** The phases a block can be in that anything is ever said for. */
const SPOKEN_PHASES: BlockPhase[] = ['warmup', 'work', 'rest', 'sprint', 'cooldown']

describe('English is exactly what it was', () => {
  it('speaks each corner in the corner definition’s own words', () => {
    for (const id of cornerIds) {
      expect(cornerText(CORNERS[id], 'en')).toBe(CORNERS[id].spoken)
    }
  })

  it('speaks a zone number as the digit', () => {
    for (let n = 1; n <= 8; n++) expect(numberText(n, 'en')).toBe(String(n))
  })

  it('keeps the phase words and the finishing line', () => {
    expect(phaseText('work', 'en')).toBe('go')
    expect(phaseText('rest', 'en')).toBe('rest')
    expect(completeText('en')).toBe('Session complete. Well done.')
  })

  it('says nothing for a phase that was always silent', () => {
    for (const language of CALL_LANGUAGES) {
      expect(phaseText('prepare', language)).toBeUndefined()
    }
  })

  it('does not move the interval floor', () => {
    // Guards every English session against this feature: a factor of anything
    // but 1 would silently re-time drills for players who never touched it.
    expect(LANGUAGE_INTERVAL_FACTOR.en).toBe(1)
  })
})

describe('the Filipino call', () => {
  it('gives every corner two words in both spellings', () => {
    for (const id of cornerIds) {
      for (const delivery of ['native', 'respelled'] as const) {
        expect(cornerText(CORNERS[id], 'fil', delivery).split(' '), id).toHaveLength(2)
      }
    }
  })

  it('never calls two corners the same thing', () => {
    // The whole call is "where to go". Two corners sharing a phrase would send
    // the player to the wrong one with no way to tell.
    for (const delivery of ['native', 'respelled'] as const) {
      const calls = cornerIds.map((id) => cornerText(CORNERS[id], 'fil', delivery))
      expect(new Set(calls).size).toBe(cornerIds.length)
    }
  })

  it('never calls a corner what English calls another one', () => {
    const english = new Set(cornerIds.map((id) => CORNERS[id].spoken))
    for (const id of cornerIds) {
      expect(english.has(cornerText(CORNERS[id], 'fil'))).toBe(false)
    }
  })

  it('leaves the shot in English', () => {
    // Nobody has ever shouted a Tagalog word for a smash. Translating this half
    // would produce a call no player has heard.
    for (const stroke of strokeIds) {
      const call = callText(CORNERS['rear-left'], stroke, 'fil')
      expect(call.endsWith(STROKES[stroke].spoken), stroke).toBe(true)
      expect(call.startsWith('likod kaliwa,')).toBe(true)
    }
  })

  it('counts the zones, and falls back to the digit outside them', () => {
    const spoken = Array.from({ length: 8 }, (_, i) => numberText(i + 1, 'fil'))
    expect(new Set(spoken).size).toBe(8)
    for (const word of spoken) expect(word).not.toMatch(/\d/)
    // A layout can only produce 1-8, but a zone that is not in the layout is
    // numbered 0 — which has no word and must not become silence.
    expect(numberText(0, 'fil')).toBe('0')
    expect(numberText(9, 'fil')).toBe('9')
  })

  it('has a word for every phase English has a word for', () => {
    for (const phase of SPOKEN_PHASES) {
      expect(phaseText(phase, 'fil'), phase).toBeTruthy()
      expect(phaseText(phase, 'fil', 'respelled'), phase).toBeTruthy()
    }
  })

  it('finishes the session in Filipino', () => {
    expect(completeText('fil')).not.toBe(completeText('en'))
    expect(completeText('fil').length).toBeGreaterThan(0)
  })

  it('leaves more room in the slot than English does', () => {
    // "harap kaliwa" is five syllables where "net left" is two, and speech
    // cancels rather than queues: too short a slot amputates the call.
    expect(LANGUAGE_INTERVAL_FACTOR.fil).toBeGreaterThan(LANGUAGE_INTERVAL_FACTOR.en)
  })
})

describe('the respelled fallback', () => {
  const respellings = () => [
    ...cornerIds.map((id) => cornerText(CORNERS[id], 'fil', 'respelled')),
    ...Array.from({ length: 8 }, (_, i) => numberText(i + 1, 'fil', 'respelled')),
    ...SPOKEN_PHASES.map((phase) => phaseText(phase, 'fil', 'respelled') ?? ''),
    completeText('fil', 'respelled'),
  ]

  it('uses only letters an English voice reads', () => {
    // The point of a respelling is that an English engine can pronounce it. A
    // stray accent or ñ would be read as a symbol or dropped.
    for (const text of respellings()) {
      expect(text, text).toMatch(/^[A-Za-z.\- ]+$/)
    }
  })

  it('differs from the native spelling wherever the word is Filipino', () => {
    for (const id of cornerIds) {
      const native = cornerText(CORNERS[id], 'fil', 'native')
      expect(cornerText(CORNERS[id], 'fil', 'respelled'), id).not.toBe(native)
    }
  })

  it('is spoken with an English tag, because the text is English spelling', () => {
    expect(utteranceLang('fil', 'respelled')).toMatch(/^en/)
    expect(utteranceLang('fil', 'native')).toMatch(/^fil/)
    expect(utteranceLang('en', 'native')).toMatch(/^en/)
  })
})

describe('finding a voice that speaks the language', () => {
  it('accepts both tags Filipino is published under', () => {
    // `fil` is the modern tag; `tl` is Tagalog's older one and still shipping.
    for (const tag of ['fil-PH', 'fil_PH', 'fil', 'tl-PH', 'TL-ph', 'tl']) {
      expect(voiceMatches(tag, 'fil'), tag).toBe(true)
    }
  })

  it('does not mistake an English voice for a Filipino one, or the reverse', () => {
    for (const tag of ['en-US', 'en-GB', 'en_AU']) {
      expect(voiceMatches(tag, 'fil'), tag).toBe(false)
      expect(voiceMatches(tag, 'en'), tag).toBe(true)
    }
    expect(voiceMatches('fil-PH', 'en')).toBe(false)
  })

  it('matches the whole subtag, not a prefix', () => {
    // `startsWith('en')` would claim Middle English, and `startsWith('tl')`
    // anything else beginning tl. Neither speaks what we are about to say.
    expect(voiceMatches('enm', 'en')).toBe(false)
    expect(voiceMatches('tlh-Piqd', 'fil')).toBe(false)
  })

  it('is not confused by a language it has never heard of', () => {
    for (const language of CALL_LANGUAGES as readonly CallLanguage[]) {
      expect(voiceMatches('', language)).toBe(false)
    }
  })
})
