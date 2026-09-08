import type { CornerDef, CourtRow, CourtSide } from '@/lib/timer/corners'
import { spokenCall, type StrokeId } from '@/lib/timer/strokes'
import type { BlockPhase } from '@/lib/timer/types'

/**
 * What language the calls come in.
 *
 * Most of the players this app is for are Filipino, and a coach on a court in
 * Manila does not call "rear left". They call "likod kaliwa" — and then, in the
 * same breath, "smash". That mix is not sloppiness: the *places* on a court
 * have Filipino names that everyone uses, and the *shots* do not. Nobody has
 * ever shouted a Tagalog word for a smash. So Taglish here is one language with
 * two halves, and translating the half that has no Filipino word would produce
 * something no player has ever heard.
 *
 * ## What is translated, and what deliberately is not
 *
 *  - **Corners** — translated. This is the call. It is what you hear a hundred
 *    times a session and it is the only word you have to act on.
 *  - **Zone numbers** — translated, because Number mode replaces the corner
 *    with a number and it would be strange to count in English inside a
 *    Filipino call.
 *  - **Phase words** — translated. "Pahinga" is what you are told when a rest
 *    starts.
 *  - **Shots** — left in English. See above.
 *  - **Exercise names** — left in English. "Push up", "plank" and "burpee" are
 *    the words used in Filipino gyms; a translation would be a puzzle, not a
 *    cue.
 *  - **The interface** — left in English. It is read sitting down, with time to
 *    think, which is the opposite of a call. If that turns out to be wrong it
 *    is a separate piece of work, and a much larger one.
 *
 * ## Why every phrase is written twice
 *
 * A Filipino voice is not something you can count on. Android usually has one
 * (`fil-PH`, sometimes tagged `tl-PH`); iOS has none at all, and a browser on
 * a desktop may have none either. Falling back to English calls would quietly
 * take the feature away from exactly the phones it was built for.
 *
 * So each phrase carries a `respelled` form as well: the same word spelled the
 * way an English voice has to see it to say it. "kaliwa" read by an English
 * voice comes out "kal-EYE-wuh"; "kah-lee-wah" comes out right. It is not
 * elegant and it is not the preferred path — when a real Filipino voice exists
 * we use the real spelling — but a slightly synthetic accent is a great deal
 * better than a feature that silently does not apply to your phone.
 */

export type CallLanguage = 'en' | 'fil'

export const CALL_LANGUAGES = ['en', 'fil'] as const

export const LANGUAGE_LABEL: Record<CallLanguage, string> = {
  en: 'English',
  fil: 'Taglish',
}

export const LANGUAGE_HINT: Record<CallLanguage, string> = {
  en: '“rear left, smash”',
  fil: '“likod kaliwa, smash”',
}

/**
 * Whether the phrase can be handed to a voice that speaks the language, or has
 * to be respelled for an English one.
 */
export type Delivery = 'native' | 'respelled'

interface Phrase {
  /** Spelled correctly, for a voice that speaks the language. */
  native: string
  /** Spelled for an English voice, when the device has no Filipino one. */
  respelled: string
}

const say = (phrase: Phrase, delivery: Delivery): string =>
  delivery === 'native' ? phrase.native : phrase.respelled

/* ------------------------------------------------------------------ voices */

/**
 * The subtags a voice can carry for each language.
 *
 * `fil` is the modern tag and what Google's Filipino voice reports; `tl`
 * (Tagalog) is the older one and still turns up. Matching only `fil` would
 * miss half the devices that can actually speak it.
 */
const VOICE_SUBTAGS: Record<CallLanguage, string[]> = {
  en: ['en'],
  fil: ['fil', 'tl'],
}

/** The tag we ask the browser to speak in, once a delivery is decided. */
const UTTERANCE_LANG: Record<CallLanguage, string> = {
  en: 'en-US',
  fil: 'fil-PH',
}

/**
 * Whether a voice speaks a language.
 *
 * Compares the primary subtag rather than a prefix: `startsWith('en')` also
 * matches a hypothetical `enm`, and underscores show up in the wild
 * (`fil_PH`) alongside the hyphens the spec asks for.
 */
export function voiceMatches(voiceLang: string, language: CallLanguage): boolean {
  const primary = voiceLang.toLowerCase().replace(/_/g, '-').split('-')[0]
  return primary !== undefined && VOICE_SUBTAGS[language].includes(primary)
}

/**
 * What to set `utterance.lang` to. On the respelled path it must stay English:
 * the text is English spelling, and telling the engine otherwise makes an
 * English voice attempt Filipino phonics on a word that is not Filipino.
 */
export function utteranceLang(language: CallLanguage, delivery: Delivery): string {
  return delivery === 'native' ? UTTERANCE_LANG[language] : UTTERANCE_LANG.en
}

/* -------------------------------------------------------------- vocabulary */

const ROW_WORD: Record<CourtRow, Phrase> = {
  net: { native: 'harap', respelled: 'hah-rahp' },
  mid: { native: 'gitna', respelled: 'geet-nah' },
  rear: { native: 'likod', respelled: 'lee-kod' },
}

const SIDE_WORD: Record<CourtSide, Phrase> = {
  left: { native: 'kaliwa', respelled: 'kah-lee-wah' },
  center: { native: 'gitna', respelled: 'geet-nah' },
  right: { native: 'kanan', respelled: 'kah-nahn' },
}

/** 1–8, which is every zone number any layout can produce. */
const NUMBER_WORD: Phrase[] = [
  { native: 'isa', respelled: 'ee-sah' },
  { native: 'dalawa', respelled: 'dah-lah-wah' },
  { native: 'tatlo', respelled: 'taht-loh' },
  { native: 'apat', respelled: 'ah-paht' },
  { native: 'lima', respelled: 'lee-mah' },
  { native: 'anim', respelled: 'ah-neem' },
  { native: 'pito', respelled: 'pee-toh' },
  { native: 'walo', respelled: 'wah-loh' },
]

/**
 * "Warm up" and "cool down" are not translated because they are not translated
 * on court either — they are the words Filipino coaches use.
 */
const PHASE_WORD: Partial<Record<BlockPhase, Phrase>> = {
  work: { native: 'sige', respelled: 'see-geh' },
  sprint: { native: 'bilisan', respelled: 'bee-lee-sahn' },
  rest: { native: 'pahinga', respelled: 'pah-hing-ah' },
  warmup: { native: 'warm up', respelled: 'warm up' },
  cooldown: { native: 'cool down', respelled: 'cool down' },
}

const COMPLETE: Phrase = {
  native: 'Tapos na. Magaling.',
  respelled: 'Tah-pos nah. Mah-gah-ling.',
}

const PHASE_WORD_EN: Partial<Record<BlockPhase, string>> = {
  work: 'go',
  sprint: 'sprint',
  rest: 'rest',
  warmup: 'warm up',
  cooldown: 'cool down',
}

const COMPLETE_EN = 'Session complete. Well done.'

/* ------------------------------------------------------------------- calls */

/** The corner, spoken. English returns the corner's own wording untouched. */
export function cornerText(
  def: CornerDef,
  language: CallLanguage,
  delivery: Delivery = 'native',
): string {
  if (language === 'en') return def.spoken
  return `${say(ROW_WORD[def.row], delivery)} ${say(SIDE_WORD[def.side], delivery)}`
}

/**
 * A full call: where to go, then what to play.
 *
 * The two halves are joined by `strokes.spokenCall`, which owns the comma
 * between them — it is load-bearing, the pause that keeps the engine from
 * running "likod kaliwa smash" together as one word, and it should be decided
 * in one place rather than two.
 */
export function callText(
  def: CornerDef,
  stroke: StrokeId | undefined,
  language: CallLanguage,
  delivery: Delivery = 'native',
): string {
  const corner = cornerText(def, language, delivery)
  return stroke ? spokenCall(corner, stroke) : corner
}

/** A zone number, spoken. Out-of-range numbers fall back to the digit. */
export function numberText(
  value: number,
  language: CallLanguage,
  delivery: Delivery = 'native',
): string {
  const word = NUMBER_WORD[value - 1]
  if (language === 'en' || !word) return String(value)
  return say(word, delivery)
}

export function phaseText(
  phase: BlockPhase,
  language: CallLanguage,
  delivery: Delivery = 'native',
): string | undefined {
  if (language === 'en') return PHASE_WORD_EN[phase]
  const word = PHASE_WORD[phase]
  return word ? say(word, delivery) : undefined
}

export function completeText(language: CallLanguage, delivery: Delivery = 'native'): string {
  return language === 'en' ? COMPLETE_EN : say(COMPLETE, delivery)
}

/* ---------------------------------------------------------------- interval */

/**
 * How much longer a call takes to say in this language, as a multiplier.
 *
 * "harap kaliwa" is five syllables where "net left" is two. Speech cancels
 * whatever is still speaking, so a slot shorter than the phrase does not delay
 * the call — it amputates it, and half a corner name is worse than none. The
 * floors in `lib/timer/plan` are scaled by this, which is the whole of its
 * effect: it moves the *minimum* a player is allowed to select, and nothing
 * else about the session.
 */
export const LANGUAGE_INTERVAL_FACTOR: Record<CallLanguage, number> = {
  en: 1,
  fil: 1.25,
}
