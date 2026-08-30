import type { CourtRow } from './corners'

/**
 * Shadow strokes — the shot, not just the corner.
 *
 * Every drill in the app until now called a *place*: "rear left", and you moved
 * there. That is half of what a coach shouts. The other half is the shot —
 * "rear left, smash" — because where you go and what you play from there are
 * different decisions, and the second one changes the whole movement. You
 * scissor-jump into a smash and you glide into a drop from the same corner.
 *
 * Which strokes are legal from where is not a style choice, it is the sport:
 * you cannot smash from the net and you cannot play a net shot from the
 * baseline. Encoding that here means the caller can never ask for something
 * impossible, which is exactly the sort of thing that destroys trust in a
 * training app the first time it happens.
 */

export type StrokeId = 'clear' | 'drop' | 'smash' | 'net-shot' | 'lift' | 'drive' | 'push' | 'block'

export interface StrokeDef {
  id: StrokeId
  /** What the voice says, after the corner. */
  spoken: string
  /** Short form for the board. */
  label: string
  /** One line on what the shot is, for the setup screen. */
  description: string
}

export const STROKES: Record<StrokeId, StrokeDef> = {
  clear: {
    id: 'clear',
    spoken: 'clear',
    label: 'Clear',
    description: 'Overhead, high and to the back. Buys you the time to recover.',
  },
  drop: {
    id: 'drop',
    spoken: 'drop',
    label: 'Drop',
    description: 'Same overhead preparation, slowed at the last moment.',
  },
  smash: {
    id: 'smash',
    spoken: 'smash',
    label: 'Smash',
    description: 'Steep and flat out. The one shot that ends a rally on its own.',
  },
  'net-shot': {
    id: 'net-shot',
    spoken: 'net shot',
    label: 'Net',
    description: 'Fingers and forearm only, dropping just over the tape.',
  },
  lift: {
    id: 'lift',
    spoken: 'lift',
    label: 'Lift',
    description: 'Underarm from the front, high to the opposite baseline.',
  },
  drive: {
    id: 'drive',
    spoken: 'drive',
    label: 'Drive',
    description: 'Flat and fast through the middle. The doubles exchange.',
  },
  push: {
    id: 'push',
    spoken: 'push',
    label: 'Push',
    description: 'Firm and flat into the mid-court gap, taken early.',
  },
  block: {
    id: 'block',
    spoken: 'block',
    label: 'Block',
    description: 'Absorbing a smash and dropping it short. Nothing but soft hands.',
  },
}

/**
 * What can honestly be played from each part of the court.
 *
 * Deliberately not "every stroke everywhere". A caller that asks for a smash
 * from the net is not adding variety, it is telling you it does not know the
 * game.
 */
const BY_ROW: Record<CourtRow, StrokeId[]> = {
  net: ['net-shot', 'lift', 'push'],
  mid: ['drive', 'block', 'push', 'lift'],
  rear: ['clear', 'drop', 'smash'],
}

export function strokesForRow(row: CourtRow): StrokeId[] {
  return BY_ROW[row]
}

/** Every stroke a layout can produce, in catalogue order — for the setup screen. */
export function strokesForRows(rows: CourtRow[]): StrokeId[] {
  const seen = new Set<StrokeId>()
  for (const row of rows) for (const id of BY_ROW[row]) seen.add(id)
  return (Object.keys(STROKES) as StrokeId[]).filter((id) => seen.has(id))
}

/**
 * Picks the stroke for a call.
 *
 * Takes the same seeded generator the sequencer draws corners from, so a
 * seeded session replays the identical sequence of shots as well as the
 * identical sequence of corners — which is what makes a challenge a fair
 * contest rather than two different drills wearing the same name.
 */
export function pickStroke(row: CourtRow, rng: { int(maxExclusive: number): number }): StrokeId {
  const options = BY_ROW[row]
  return options[rng.int(options.length)] as StrokeId
}

/** What the voice says for a call: the corner, then the shot. */
export function spokenCall(cornerSpoken: string, stroke: StrokeId): string {
  return `${cornerSpoken}, ${STROKES[stroke].spoken}`
}
