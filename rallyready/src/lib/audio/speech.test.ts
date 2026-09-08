import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  deliveryFor,
  hasVoiceFor,
  listVoices,
  speak,
  subscribeVoices,
  voicesSnapshot,
} from './speech'

interface FakeVoice {
  name: string
  lang: string
  localService: boolean
  default: boolean
  voiceURI: string
}

const voice = (
  name: string,
  lang: string,
  { local = true, isDefault = false } = {},
): FakeVoice => ({ name, lang, localService: local, default: isDefault, voiceURI: name })

let spoken: { text: string; lang: string; voice: string | null }[]
let cancelled: number
let listeners: (() => void)[]

/** Installs a speech engine with the given voices. */
function install(voices: FakeVoice[]): void {
  spoken = []
  cancelled = 0
  listeners = []
  class Utterance {
    text: string
    rate = 1
    pitch = 1
    volume = 1
    voice: FakeVoice | null = null
    lang = ''
    constructor(text: string) {
      this.text = text
    }
  }
  const engine = {
    getVoices: () => voices,
    speak: (u: Utterance) =>
      spoken.push({ text: u.text, lang: u.lang, voice: u.voice?.name ?? null }),
    cancel: () => {
      cancelled += 1
    },
    addEventListener: (name: string, fn: () => void) => {
      if (name === 'voiceschanged') listeners.push(fn)
    },
    removeEventListener: (_name: string, fn: () => void) => {
      listeners = listeners.filter((entry) => entry !== fn)
    },
  }
  // `speechSynthesis` is a read-only accessor on Window; assignment would fail.
  Object.defineProperty(window, 'speechSynthesis', { value: engine, configurable: true })
  Object.defineProperty(window, 'SpeechSynthesisUtterance', {
    value: Utterance,
    configurable: true,
  })
}

const EN = voice('English Local', 'en-US', { isDefault: true })
const EN_REMOTE = voice('English Remote', 'en-GB', { local: false })
const FIL = voice('Filipino Local', 'fil-PH')

describe('choosing among the voices a device has', () => {
  beforeEach(() => install([EN_REMOTE, EN, FIL]))

  it('puts the voices on the phone before the ones that need a connection', () => {
    // A network voice fetches its audio, and a call that arrives late is a call
    // that arrives wrong.
    expect(listVoices('en').map((v) => v.name)).toEqual(['English Local', 'English Remote'])
  })

  it('finds Filipino under either tag it is published with', () => {
    install([EN, voice('Tagalog', 'tl-PH')])
    expect(listVoices('fil').map((v) => v.name)).toEqual(['Tagalog'])
    expect(hasVoiceFor('fil')).toBe(true)
  })

  it('reports honestly when a language has no voice at all', () => {
    install([EN])
    expect(listVoices('fil')).toEqual([])
    expect(hasVoiceFor('fil')).toBe(false)
    expect(deliveryFor('fil')).toBe('respelled')
    expect(deliveryFor('en')).toBe('native')
  })

  it('speaks natively once a Filipino voice exists', () => {
    expect(deliveryFor('fil')).toBe('native')
  })

  it('survives an engine that throws when asked', () => {
    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        getVoices: () => {
          throw new Error('no')
        },
        speak: () => {},
        cancel: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
      },
      configurable: true,
    })
    expect(listVoices('en')).toEqual([])
    expect(() => speak('rear left')).not.toThrow()
  })
})

describe('watching the list', () => {
  it('hands back the same array until the voices actually change', () => {
    // React re-renders on a new reference, so a fresh array every call would
    // loop forever. This is the guard on that.
    install([EN, FIL])
    const first = voicesSnapshot()
    expect(voicesSnapshot()).toBe(first)

    install([EN])
    expect(voicesSnapshot()).not.toBe(first)
    expect(voicesSnapshot()).toBe(voicesSnapshot())
  })

  it('subscribes and unsubscribes from the engine', () => {
    install([EN])
    const onChange = vi.fn()
    const stop = subscribeVoices(onChange)
    expect(listeners).toHaveLength(1)
    listeners.forEach((fn) => fn())
    expect(onChange).toHaveBeenCalledTimes(1)
    stop()
    expect(listeners).toHaveLength(0)
  })
})

describe('speaking a call', () => {
  beforeEach(() => install([EN_REMOTE, EN, FIL]))

  it('cancels whatever is still speaking first', () => {
    // Speech queues rather than interrupts: left alone the voice ends up
    // calling corners from ten seconds ago.
    speak('net left')
    expect(cancelled).toBe(1)
  })

  it('uses the voice the player picked', () => {
    speak('net left', { language: 'en', voiceUris: { en: 'English Remote' } })
    expect(spoken.at(-1)?.voice).toBe('English Remote')
  })

  it('falls back rather than going silent when the chosen voice is gone', () => {
    // An uninstalled language pack, a different browser, a new phone. The
    // stored URI resolves to nothing and the drill must still be called.
    speak('net left', { language: 'en', voiceUris: { en: 'A voice this phone lost' } })
    expect(spoken.at(-1)?.voice).toBe('English Local')
  })

  it('keeps a Filipino choice separate from an English one', () => {
    speak('harap kaliwa', {
      language: 'fil',
      voiceUris: { en: 'English Remote', fil: 'Filipino Local' },
    })
    expect(spoken.at(-1)?.voice).toBe('Filipino Local')
    expect(spoken.at(-1)?.lang).toBe('fil-PH')
  })

  it('reads a respelling with the English voice, not the Filipino one', () => {
    install([EN_REMOTE, EN])
    speak('hah-rahp kah-lee-wah', {
      language: 'fil',
      voiceUris: { en: 'English Remote', fil: 'Filipino Local' },
    })
    // The text is English spelling of Filipino words. The player's English
    // choice is the one that applies, and the tag has to say English or the
    // engine tries Filipino phonics on a word that is not Filipino.
    expect(spoken.at(-1)?.voice).toBe('English Remote')
    expect(spoken.at(-1)?.lang).toMatch(/^en/)
  })

  it('says nothing at all rather than throwing when there is no engine', () => {
    Reflect.deleteProperty(window, 'speechSynthesis')
    expect(() => speak('net left')).not.toThrow()
  })
})
