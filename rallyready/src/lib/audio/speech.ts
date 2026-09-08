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
}

const DEFAULT_RATE = 1.3

function synth(): SpeechSynthesis | null {
  if (typeof window === 'undefined') return null
  return 'speechSynthesis' in window ? window.speechSynthesis : null
}

export function isSpeechSupported(): boolean {
  return synth() !== null && typeof window.SpeechSynthesisUtterance === 'function'
}

let preferredVoice: SpeechSynthesisVoice | null = null

export function listVoices(language: CallLanguage = 'en'): SpeechSynthesisVoice[] {
  const speech = synth()
  if (!speech) return []
  try {
    return speech.getVoices().filter((voice) => voiceMatches(voice.lang, language))
  } catch {
    return []
  }
}

export function setPreferredVoice(voiceUri: string | null): void {
  preferredVoice = voiceUri ? (listVoices().find((v) => v.voiceURI === voiceUri) ?? null) : null
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
function resolveVoice(language: CallLanguage): SpeechSynthesisVoice | null {
  const voices = listVoices(language)
  if (voices.length === 0) return null
  // A voice chosen by hand only applies to the language it was chosen from.
  if (preferredVoice && voiceMatches(preferredVoice.lang, language)) return preferredVoice
  // Prefer a local voice: network voices add latency we cannot afford.
  return voices.find((voice) => voice.localService && voice.default) ?? voices[0] ?? null
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
    const voice = resolveVoice(delivery === 'native' ? language : 'en')
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

/** Resolves once the browser has published its voice list (or immediately). */
export function whenVoicesReady(callback: () => void): () => void {
  const speech = synth()
  if (!speech) return () => {}
  if (listVoices().length > 0) {
    callback()
    return () => {}
  }
  const handler = () => callback()
  speech.addEventListener('voiceschanged', handler)
  return () => speech.removeEventListener('voiceschanged', handler)
}
