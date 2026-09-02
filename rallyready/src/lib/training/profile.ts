import type { Discipline, SkillLevel } from '@/lib/data/types'
import type { CornerId } from '@/lib/timer/corners'
import { patternsFor, type RallyPattern } from '@/lib/timer/patterns'
import { STROKES, strokeAllowed, type StrokeId } from '@/lib/timer/strokes'

/**
 * What "beginner playing doubles" actually means for a session.
 *
 * The app has asked for level and discipline since onboarding and then done
 * almost nothing with them — they steered the first drill recommendation and
 * were otherwise decoration. That is the wrong way round. A club doubles player
 * and a singles player are training for different sports on the same court, and
 * the same drill run by a beginner and by an advanced player should not be the
 * same drill.
 *
 * Three things change here, and nothing else:
 *
 *  - **the vocabulary** — which shots the caller is allowed to ask for;
 *  - **the court** — which zones the calls favour;
 *  - **the volume** — rounds, work, rest and how fast the calls come.
 *
 * ## Where the volume numbers come from
 *
 * Coaching guidance for shadow work is remarkably consistent: developing
 * players are told two minutes of work against a minute of rest for two to four
 * rounds, at a repeatable rhythm rather than maximum speed; intermediate
 * players run timed circuits of around three sets; advanced players are told to
 * keep sessions short, dense and honest, and match data puts a singles rally at
 * roughly six seconds of work against twelve of recovery.
 *
 * So the factors below are not "make it harder": beginners get *fewer* rounds
 * and a *slower* call so there is time to move properly, and advanced players
 * get more rounds and less rest rather than a longer session. Drill defaults
 * are authored at intermediate, which is why that column is all ones.
 */

export interface TrainingProfile {
  level: SkillLevel
  discipline: Discipline
}

/* ------------------------------------------------------------- vocabulary */

/** Every shot worth calling at a level, in catalogue order. */
export function vocabularyFor(level: SkillLevel): StrokeId[] {
  return (Object.keys(STROKES) as StrokeId[]).filter((id) => strokeAllowed(id, level))
}

/** The shots that are new at this level — what the player has just unlocked. */
export function newAtLevel(level: SkillLevel): StrokeId[] {
  return (Object.keys(STROKES) as StrokeId[]).filter((id) => STROKES[id].level === level)
}

/* ------------------------------------------------------------------ court */

/**
 * How often each zone comes up, by game.
 *
 * Singles is played corner to corner: the rear and the net are where points are
 * won and the mid-court is mostly somewhere you pass through. Doubles is the
 * opposite shape — flat, fast, and decided in the front two thirds, with the
 * rear used to attack rather than to survive. Weights rather than switching
 * zones off, because a doubles player still has to cover the back.
 */
const WEIGHTS: Record<Discipline, Partial<Record<CornerId, number>>> = {
  singles: {
    'net-left': 1.15,
    'net-center': 1.15,
    'net-right': 1.15,
    'mid-left': 0.7,
    'mid-right': 0.7,
    'rear-left': 1.25,
    'rear-center': 1.1,
    'rear-right': 1.25,
  },
  doubles: {
    'net-left': 1.35,
    'net-center': 1.35,
    'net-right': 1.35,
    'mid-left': 1.6,
    'mid-right': 1.6,
    'rear-left': 0.75,
    'rear-center': 0.85,
    'rear-right': 0.75,
  },
  both: {},
}

export function weightsFor(discipline: Discipline): Partial<Record<CornerId, number>> {
  return { ...WEIGHTS[discipline] }
}

export const DISCIPLINE_NOTE: Record<Discipline, string> = {
  singles: 'Corner to corner: the rear and the net come up more, the mid-court less.',
  doubles:
    'Flat and front-heavy: mid-court and net come up most, the rear is where you attack from.',
  both: 'Every zone equally — the honest setting if you play both.',
}

/* ----------------------------------------------------------------- volume */

export interface Volume {
  rounds: number
  workSec: number
  restSec: number
  intervalMs: number
}

interface Factors {
  rounds: number
  work: number
  rest: number
  /** Above 1 slows the calls down; a beginner needs time to move properly. */
  interval: number
}

const FACTORS: Record<SkillLevel, Factors> = {
  beginner: { rounds: 0.7, work: 0.85, rest: 1.35, interval: 1.2 },
  intermediate: { rounds: 1, work: 1, rest: 1, interval: 1 },
  advanced: { rounds: 1.4, work: 1.15, rest: 0.7, interval: 0.85 },
}

/** The UI's own limits, so a scaled plan can never fall outside what it can show. */
const LIMITS = {
  rounds: [2, 20],
  workSec: [10, 300],
  restSec: [5, 300],
  intervalMs: [800, 3000],
} as const

const clamp = (value: number, [min, max]: readonly [number, number]) =>
  Math.min(max, Math.max(min, Math.round(value)))

export function scaleVolume(base: Volume, level: SkillLevel): Volume {
  const f = FACTORS[level]
  return {
    rounds: clamp(base.rounds * f.rounds, LIMITS.rounds),
    workSec: clamp(base.workSec * f.work, LIMITS.workSec),
    restSec: clamp(base.restSec * f.rest, LIMITS.restSec),
    intervalMs: clamp(base.intervalMs * f.interval, LIMITS.intervalMs),
  }
}

/** Total time on the clock for a scaled main set, rest included. */
export function volumeSeconds(volume: Volume): number {
  // The last rest is dropped, exactly as the timeline drops it.
  return volume.rounds * volume.workSec + Math.max(0, volume.rounds - 1) * volume.restSec
}

/** Working seconds only — the number that actually drives adaptation. */
export function workSeconds(volume: Volume): number {
  return volume.rounds * volume.workSec
}

export const LEVEL_NOTE: Record<SkillLevel, string> = {
  beginner: 'Fewer rounds, longer rest, slower calls — there is time to arrive properly.',
  intermediate: 'The drill as written.',
  advanced: 'More rounds, less rest, faster calls. Same session length, far more work in it.',
}

/* --------------------------------------------------------------- patterns */

/** The rally patterns a profile should be running, hardest last. */
export function patternsForProfile(profile: TrainingProfile): RallyPattern[] {
  const play = profile.discipline === 'both' ? 'both' : profile.discipline
  return patternsFor(play, profile.level)
}
