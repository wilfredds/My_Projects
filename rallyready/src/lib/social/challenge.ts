import { levelFromIndex, levelIndex } from '@/lib/data/stats'
import type { SkillLevel } from '@/lib/data/types'

/**
 * Challenge codes — sending another player the *exact* session you just did.
 *
 * The engine has been seed-deterministic since the first phase: the same seed
 * produces the same corner order, the same intervals, the same everything. That
 * was built for testability, and it turns out to be the whole feature here. A
 * short code carrying a drill, a few settings and that seed means two people on
 * opposite sides of the country run an identical drill and can compare scores
 * honestly — with no server, no accounts and no network.
 *
 * Encoded rather than a URL query string so it survives being pasted into
 * Messenger, which mangles long links and helpfully strips parameters.
 */

/**
 * Version 2 appends the sender's level.
 *
 * Not a cosmetic detail: level decides the shot vocabulary and which rally
 * patterns a drill runs, so without it the receiver of a Strokes or Rallies
 * challenge gets a different stream of calls from the same seed — a different
 * session wearing the same name, which is the one thing this feature promises
 * not to do. It rides at the end so the fields before it keep their positions.
 */
export const CHALLENGE_VERSION = 2

export interface Challenge {
  /** Drill slug — the code is worthless if both sides do different drills. */
  drill: string
  seed: number
  rounds: number
  workSec: number
  restSec: number
  intervalMs: number
  /** The sender's score, so there is something to beat. Null for an open one. */
  target: number | null
  /** Who sent it, trimmed. Free text, never trusted for anything. */
  from: string | null
  /**
   * The level the sender ran it at, which sets the shots and the rallies.
   * Codes from before version 2 do not carry one and are read as intermediate,
   * the level every drill's defaults are written at.
   */
  level: SkillLevel
}

/** Fields, in the order they are packed. Order is part of the wire format. */
const FIELDS = ['seed', 'rounds', 'workSec', 'restSec', 'intervalMs'] as const

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/**
 * Base32 over a small integer, using an alphabet without the characters people
 * mistype when reading a code aloud — no O/0, no I/1.
 */
function encodeInt(value: number): string {
  let n = Math.max(0, Math.round(value))
  if (n === 0) return ALPHABET[0] as string
  let out = ''
  while (n > 0) {
    out = ALPHABET[n % 32] + out
    n = Math.floor(n / 32)
  }
  return out
}

function decodeInt(text: string): number | null {
  if (text.length === 0) return null
  let n = 0
  for (const char of text) {
    const index = ALPHABET.indexOf(char)
    if (index === -1) return null
    n = n * 32 + index
  }
  return n
}

/**
 * A comma, specifically because `encodeURIComponent` escapes it.
 *
 * The obvious choice was a hyphen — and it silently destroyed every code, because
 * a hyphen is an *unreserved* URI character that `encodeURIComponent` leaves
 * alone. "six-corner-shadow" split into three fields. The separator has to be a
 * character the escaping actually removes from the values, or the values can
 * impersonate it.
 */
const SEPARATOR = ','

/** Packs a challenge into something a person can paste into a chat. */
export function encodeChallenge(challenge: Challenge): string {
  const numbers = FIELDS.map((field) => encodeInt(challenge[field]))
  const parts = [
    encodeInt(CHALLENGE_VERSION),
    ...numbers,
    challenge.target === null ? '' : encodeInt(challenge.target),
    encodeURIComponent(challenge.drill),
    challenge.from === null ? '' : encodeURIComponent(challenge.from.slice(0, 24)),
    encodeInt(levelIndex(challenge.level)),
  ]
  return parts.join(SEPARATOR)
}

export type DecodeResult = { ok: true; challenge: Challenge } | { ok: false; error: string }

/** Rejects anything it cannot fully understand rather than guessing at defaults. */
export function decodeChallenge(code: string): DecodeResult {
  const trimmed = code.trim()
  if (trimmed.length === 0) return { ok: false, error: 'Paste a challenge code first.' }

  const parts = trimmed.split(SEPARATOR)
  if (parts.length < FIELDS.length + 3) {
    return { ok: false, error: 'That does not look like a RallyReady challenge code.' }
  }

  const version = decodeInt(parts[0] ?? '')
  if (version === null) {
    return { ok: false, error: 'That does not look like a RallyReady challenge code.' }
  }
  if (version > CHALLENGE_VERSION) {
    return { ok: false, error: 'That challenge came from a newer version of RallyReady.' }
  }

  const values: Record<string, number> = {}
  for (let i = 0; i < FIELDS.length; i++) {
    const value = decodeInt(parts[i + 1] ?? '')
    if (value === null) return { ok: false, error: 'That challenge code is damaged.' }
    values[FIELDS[i] as string] = value
  }

  const targetRaw = parts[FIELDS.length + 1] ?? ''
  const target = targetRaw === '' ? null : decodeInt(targetRaw)
  if (targetRaw !== '' && target === null) {
    return { ok: false, error: 'That challenge code is damaged.' }
  }

  const drill = decodeURIComponent(parts[FIELDS.length + 2] ?? '')
  if (!drill) return { ok: false, error: 'That challenge does not name a drill.' }

  const fromRaw = parts[FIELDS.length + 3] ?? ''

  // Absent on version 1 codes, which is not damage — it is an older sender.
  const levelRaw = parts[FIELDS.length + 4]
  const level = levelFromIndex(
    levelRaw === undefined || levelRaw === '' ? null : decodeInt(levelRaw),
  )

  // Settings are clamped, not trusted. A code is a string from the internet,
  // and a hand-edited one must not be able to start a nine-hour drill.
  return {
    ok: true,
    challenge: {
      drill,
      seed: values.seed ?? 1,
      rounds: clamp(values.rounds ?? 1, 1, 30),
      workSec: clamp(values.workSec ?? 30, 5, 600),
      restSec: clamp(values.restSec ?? 30, 0, 600),
      intervalMs: clamp(values.intervalMs ?? 1400, 500, 5000),
      target: target === null ? null : clamp(target, 0, 100_000),
      from: fromRaw === '' ? null : decodeURIComponent(fromRaw).slice(0, 24),
      level,
    },
  }
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.round(value)))
}

/** The link form, for sharing where a URL is nicer than a code. */
export function challengeUrl(origin: string, code: string): string {
  return `${origin.replace(/\/$/, '')}/challenge/${encodeURIComponent(code)}`
}

/** The message that goes with it. Short, because it is going into a chat. */
export function challengeMessage(challenge: Challenge, drillName: string, url: string): string {
  const beat =
    challenge.target === null
      ? 'Same drill, same shuttle order.'
      : `I got ${challenge.target} calls. Same drill, same order — beat it.`
  return `RallyReady challenge: ${drillName}. ${beat}\n${url}`
}
