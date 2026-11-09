import { readJson, writeJson } from '@/lib/data/local/storage'
import type { NewSession, NewSessionMetric } from '@/lib/data/types'

/**
 * A drill the phone cut short.
 *
 * A budget Android frees memory by throwing away tabs in the background, and
 * switching to a music app mid-drill is exactly how a tab ends up there. When
 * the player comes back the page loads fresh: before this, twenty minutes of
 * training were simply gone, with nothing saved and nothing to say they had
 * happened.
 *
 * So the runner keeps a copy of what it would save — the exact record, not a
 * description of it — at moments when writing costs nothing: when the drill
 * pauses (which it does the instant the page is hidden) and when a round
 * changes. Never per tick. Ending a drill, saved or not, clears it.
 */
export interface InterruptedRun {
  drillSlug: string
  /** When the copy was taken, epoch ms. */
  savedAt: number
  /** The session exactly as "End and save" would have written it. */
  input: Omit<NewSession, 'startedAt'> & { startedAt: string }
  metrics: NewSessionMetric[]
}

const KEY = 'interrupted-run'

/** Under this, there is nothing worth asking about. */
export const MIN_WORTH_KEEPING_SEC = 30

/**
 * How long a cut-short drill is still offered. Training from this morning is
 * still worth logging tonight; from three days ago it is clutter.
 */
export const OFFER_FOR_MS = 24 * 60 * 60 * 1000

export function keepCheckpoint(run: InterruptedRun): void {
  // Refused storage is not a reason to disturb a drill: no copy, no offer.
  writeJson(KEY, run)
}

export function clearCheckpoint(): void {
  writeJson(KEY, null)
}

function isRun(value: unknown): value is InterruptedRun {
  if (!value || typeof value !== 'object') return false
  const run = value as Partial<InterruptedRun>
  return (
    typeof run.drillSlug === 'string' &&
    typeof run.savedAt === 'number' &&
    !!run.input &&
    typeof run.input.startedAt === 'string' &&
    typeof run.input.durationSec === 'number' &&
    Array.isArray(run.metrics)
  )
}

/** The cut-short drill still worth offering, or null. */
export function readCheckpoint(now: number = Date.now()): InterruptedRun | null {
  const run = readJson<unknown>(KEY, null)
  if (!isRun(run)) return null
  if (run.input.durationSec < MIN_WORTH_KEEPING_SEC) return null
  if (now - run.savedAt > OFFER_FOR_MS || run.savedAt > now + 60_000) return null
  return run
}

/** The record, ready for `sessions.create`. */
export function sessionFrom(run: InterruptedRun): {
  input: NewSession
  metrics: NewSessionMetric[]
} {
  return { input: { ...run.input, startedAt: new Date(run.input.startedAt) }, metrics: run.metrics }
}
