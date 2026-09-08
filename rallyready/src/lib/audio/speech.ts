import { voiceMatches, utteranceLang, type CallLanguage, type Delivery } from './language'

/**
 * Spoken callouts.
 *
 * This is the feature the whole product rests on (§1): during a drill the user
 * must never need to look at the screen. Two things matter more than anything
 * else here — latency and not queueing up.
 *
 * At a 0.8s shot interval an utterance can easily outlast its slot, and
 * `speechSynthesis` queues rather than interrupts. Left alone it drifts further
 * and further behind until the voice is calling corners from ten seconds ago.
 * So every call cancels whatever is still speaking first.
 */

export interface SpeakOptions {
  rate?: number
  pitch?: number
  volume?: number
  /** Which language the text is in. Decides the voice and the `lang` tag. */
  language?: CallLanguage
  /**
   * The voice the player picked, per language. Absent, or a URI this device no
   * longer has, falls back to the best automatic choice.
   *
   * It travels with the call rather than being set once out of band, because
   * the out-of-band version of this was a module-level global that nothing ever
   * called: the app stored a chosen voice for months and never used it.
   */
  voiceUris?: Partial<Record<CallLanguage, string | null>>
}

const DEFAULT_RATE = 1.3

function synth(): SpeechSynthesis | null {
  if (typeof window === 'undefined') return null
  return 'speechSynthesis' in window ? window.speechSynthesis : null
}

export function isSpeechSupported(): boolean {
  return synth() !== null && typeof window.SpeechSynthesisUtterance === 'function'
}

/**
 * The voices that can speak a language, best first.
 *
 * "Best" is local before remote, because a network voice fetches its audio and
 * the call arrives late — which in a drill is the same as arriving wrong. The
 * rest of the order is the engine's own, then alphabetical, so the list a
 * player picks from does not reshuffle itself between visits.
 */
export function listVoices(language: CallLanguage = 'en'): SpeechSynthesisVoice[] {
  const speech = synth()
  if (!speech) return []
  try {
    return speech
      .getVoices()
      .filter((voice) => voiceMatches(voice.lang, language))
      .sort(
        (a, b) =>
          Number(b.localService) - Number(a.localService) ||
          Number(b.default) - Number(a.default) ||
          a.name.localeCompare(b.name),
      )
  } catch {
    return []
  }
}

/**
 * Whether this device can actually speak a language.
 *
 * Not cached. `getVoices()` returns a list the engine already holds and the
 * scan is a few dozen string compares — nothing next to the cost of speaking —
 * and caching it would mean going stale exactly when it matters, because
 * Chrome publishes its voices asynchronously and Android can install one
 * mid-session.
 */
export function hasVoiceFor(language: CallLanguage): boolean {
  return listVoices(language).length > 0
}

/**
 * Whether a language can be spoken as written, or has to be respelled for an
 * English voice. English is always `native`: respelling it would mean the
 * device has no voice at all, in which case nothing is said either way.
 */
export function deliveryFor(language: CallLanguage): Delivery {
  if (language === 'en') return 'native'
  return hasVoiceFor(language) ? 'native' : 'respelled'
}

/**
 * Chrome loads voices asynchronously and returns [] on the first call, so the
 * default is resolved lazily and re-resolved until a voice list arrives.
 */
function resolveVoice(
  language: CallLanguage,
  voiceUri?: string | null,
): SpeechSynthesisVoice | null {
  const voices = listVoices(language)
  if (voices.length === 0) return null
  /*
   * A chosen voice, if this device still has it. Voices come and go — an
   * uninstalled language pack, a different browser, the same account on a new
   * phone — and a stored URI that no longer resolves must fall through to the
   * automatic choice rather than silencing the drill.
   */
  if (voiceUri) {
    const chosen = voices.find((voice) => voice.voiceURI === voiceUri)
    if (chosen) return chosen
  }
  // Otherwise the head of the list, which is already local-first.
  return voices[0] ?? null
}

export function speak(text: string, options: SpeakOptions = {}): void {
  const speech = synth()
  if (!speech) return
  try {
    // Never let a slow utterance push the next call late.
    speech.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = options.rate ?? DEFAULT_RATE
    utterance.pitch = options.pitch ?? 1
    utterance.volume = options.volume ?? 1
    const language = options.language ?? 'en'
    const delivery = deliveryFor(language)
    /*
     * On the respelled path the text is English spelling of Filipino words, so
     * it needs an English voice and an English tag. Handing "kah-lee-wah" to a
     * Filipino engine would have it pronounce the respelling literally.
     */
    const voiceLanguage = delivery === 'native' ? language : 'en'
    const voice = resolveVoice(voiceLanguage, options.voiceUris?.[voiceLanguage])
    if (voice) utterance.voice = voice
    utterance.lang = voice?.lang ?? utteranceLang(language, delivery)
    speech.speak(utterance)
  } catch {
    /* a broken speech stack must not take the drill down with it */
  }
}

export function cancelSpeech(): void {
  try {
    synth()?.cancel()
  } catch {
    /* nothing to do */
  }
}

/**
 * iOS will not speak at all unless the engine was first touched inside a user
 * gesture. Called from the Start button.
 */
export function primeSpeech(): void {
  const speech = synth()
  if (!speech) return
  try {
    const utterance = new SpeechSynthesisUtterance(' ')
    utterance.volume = 0
    speech.speak(utterance)
    speech.cancel()
  } catch {
    /* nothing to do */
  }
}

/* ------------------------------------------------- watching the voice list */

const NO_VOICES: SpeechSynthesisVoice[] = []
let snapshot: SpeechSynthesisVoice[] = NO_VOICES
let snapshotKey = ''

/**
 * A stable snapshot of the browser's voice list, for `useSyncExternalStore`.
 *
 * `getVoices()` builds a fresh array on every call, and React treats a new
 * array as a change — returning it straight through would re-render forever.
 * So the array is held and only replaced when the voices themselves differ.
 */
export function voicesSnapshot(): SpeechSynthesisVoice[] {
  const speech = synth()
  if (!speech) return NO_VOICES
  let voices: SpeechSynthesisVoice[]
  try {
    voices = speech.getVoices()
  } catch {
    voices = []
  }
  const key = voices.map((voice) => `${voice.voiceURI}|${voice.lang}`).join(',')
  if (key !== snapshotKey) {
    snapshotKey = key
    snapshot = voices
  }
  return snapshot
}

/** The snapshot for a render with no browser to ask. Always the same array. */
export function serverVoicesSnapshot(): SpeechSynthesisVoice[] {
  return NO_VOICES
}

/**
 * Watches for the browser publishing or changing its voices. Chrome returns an
 * empty list on the first call and fills it in later, so a screen that asks
 * once on mount tells half its users they have no voices at all.
 */
export function subscribeVoices(onChange: () => void): () => void {
  const speech = synth()
  if (!speech) return () => {}
  speech.addEventListener('voiceschanged', onChange)
  return () => speech.removeEventListener('voiceschanged', onChange)
}
