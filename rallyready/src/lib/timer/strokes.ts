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
 *
 * ## Why a stroke has a level
 *
 * The first eight are the shots. The rest are the same shots played the way a
 * match is actually won: the drop you hold until the last instant, the net shot
 * that spins, the lift disguised as a net shot. Calling "hold, drop" at someone
 * who is still learning to get behind the shuttle teaches nothing, so the
 * vocabulary opens up with the player rather than all at once.
 */

export type StrokeId =
  // The shots.
  | 'clear'
  | 'drop'
  | 'smash'
  | 'net-shot'
  | 'lift'
  | 'drive'
  | 'push'
  | 'block'
  // The shots played the way points are won.
  | 'slice-drop'
  | 'hold-drop'
  | 'punch-clear'
  | 'jump-smash'
  | 'net-kill'
  | 'cross-net'
  | 'tumble-net'
  | 'flick-lift'

/** Ascending, so "at or below this level" is a comparison rather than a set. */
export const STROKE_LEVELS = ['beginner', 'intermediate', 'advanced'] as const
export type StrokeLevel = (typeof STROKE_LEVELS)[number]

export interface StrokeDef {
  id: StrokeId
  /** What the voice says, after the corner. */
  spoken: string
  /** Short form for the board. */
  label: string
  /** One line on what the shot is, for the setup screen. */
  description: string
  /** The level at which this shot starts being worth calling. */
  level: StrokeLevel
}

export const STROKES: Record<StrokeId, StrokeDef> = {
  clear: {
    id: 'clear',
    spoken: 'clear',
    label: 'Clear',
    description: 'Overhead, high and to the back. Buys you the time to recover.',
    level: 'beginner',
  },
  drop: {
    id: 'drop',
    spoken: 'drop',
    label: 'Drop',
    description: 'Same overhead preparation, slowed at the last moment.',
    level: 'beginner',
  },
  smash: {
    id: 'smash',
    spoken: 'smash',
    label: 'Smash',
    description: 'Steep and flat out. The one shot that ends a rally on its own.',
    level: 'beginner',
  },
  'net-shot': {
    id: 'net-shot',
    spoken: 'net shot',
    label: 'Net',
    description: 'Fingers and forearm only, dropping just over the tape.',
    level: 'beginner',
  },
  lift: {
    id: 'lift',
    spoken: 'lift',
    label: 'Lift',
    description: 'Underarm from the front, high to the opposite baseline.',
    level: 'beginner',
  },
  drive: {
    id: 'drive',
    spoken: 'drive',
    label: 'Drive',
    description: 'Flat and fast through the middle. The doubles exchange.',
    level: 'beginner',
  },
  push: {
    id: 'push',
    spoken: 'push',
    label: 'Push',
    description: 'Firm and flat into the mid-court gap, taken early.',
    level: 'beginner',
  },
  block: {
    id: 'block',
    spoken: 'block',
    label: 'Block',
    description: 'Absorbing a smash and dropping it short. Nothing but soft hands.',
    level: 'beginner',
  },

  'slice-drop': {
    id: 'slice-drop',
    spoken: 'slice drop',
    label: 'Slice',
    description:
      'Cut across the shuttle instead of through it. Same arm speed, half the pace, and it lands cross-court off a straight-looking swing.',
    level: 'intermediate',
  },
  'net-kill': {
    id: 'net-kill',
    spoken: 'kill',
    label: 'Kill',
    description:
      'Anything above the tape goes down, now. Short punch from the forearm — a backswing at the net is a lost point.',
    level: 'intermediate',
  },
  'cross-net': {
    id: 'cross-net',
    spoken: 'cross net',
    label: 'Cross net',
    description:
      'Net shot played across the body to the far corner. The shot that opens the diagonal when the straight one has stopped working.',
    level: 'intermediate',
  },
  'hold-drop': {
    id: 'hold-drop',
    spoken: 'hold, drop',
    label: 'Hold drop',
    description:
      'Get there early, show the clear, wait — then drop. The whole shot is the pause; without it you are just playing a slower drop.',
    level: 'advanced',
  },
  'punch-clear': {
    id: 'punch-clear',
    spoken: 'punch clear',
    label: 'Punch',
    description:
      'Flat, fast clear over the defender rather than high and safe. Takes their time away instead of buying yours.',
    level: 'advanced',
  },
  'jump-smash': {
    id: 'jump-smash',
    spoken: 'jump smash',
    label: 'Jump',
    description:
      'Take it early and above the line of the net. Land on the racket-side foot and recover forward — the landing is half the shot.',
    level: 'advanced',
  },
  'tumble-net': {
    id: 'tumble-net',
    spoken: 'tumble',
    label: 'Tumble',
    description:
      'Brushed across the base of the feathers so the shuttle turns over the tape. They cannot lift it cleanly and they cannot kill it.',
    level: 'advanced',
  },
  'flick-lift': {
    id: 'flick-lift',
    spoken: 'flick',
    label: 'Flick',
    description:
      'Shown as a net shot, flicked to the back at the last moment. Wrist and fingers only, or the disguise is gone before the shuttle is.',
    level: 'advanced',
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
  net: ['net-shot', 'lift', 'push', 'net-kill', 'cross-net', 'tumble-net', 'flick-lift'],
  mid: ['drive', 'block', 'push', 'lift'],
  rear: ['clear', 'drop', 'smash', 'slice-drop', 'hold-drop', 'punch-clear', 'jump-smash'],
}

const RANK: Record<StrokeLevel, number> = { beginner: 0, intermediate: 1, advanced: 2 }

/** Whether one level is at or below another. Shared with the rally patterns. */
export function levelAtOrBelow(level: StrokeLevel, cap: StrokeLevel): boolean {
  return RANK[level] <= RANK[cap]
}

/** Whether a shot is worth calling at a given level. */
export function strokeAllowed(id: StrokeId, level: StrokeLevel): boolean {
  return levelAtOrBelow(STROKES[id].level, level)
}

/**
 * The shots playable from a row, optionally capped at a level.
 *
 * Uncapped means the whole vocabulary — used by the reference screens, which
 * list what exists rather than what today's session will call.
 */
export function strokesForRow(row: CourtRow, level?: StrokeLevel): StrokeId[] {
  const all = BY_ROW[row]
  return level ? all.filter((id) => strokeAllowed(id, level)) : all
}

/** Every stroke a layout can produce, in catalogue order — for the setup screen. */
export function strokesForRows(rows: CourtRow[], level?: StrokeLevel): StrokeId[] {
  const seen = new Set<StrokeId>()
  for (const row of rows) for (const id of strokesForRow(row, level)) seen.add(id)
  return (Object.keys(STROKES) as StrokeId[]).filter((id) => seen.has(id))
}

/**
 * Picks the stroke for a call.
 *
 * Takes the same seeded generator the sequencer draws corners from, so a
 * seeded session replays the identical sequence of shots as well as the
 * identical sequence of corners — which is what makes a challenge a fair
 * contest rather than two different drills wearing the same name.
 *
 * `allowed` is the session's vocabulary. Anything outside it is ignored, and
 * if that would leave a row with nothing to play the row's own list stands —
 * silence is a worse answer than a shot slightly above your grade.
 */
export function pickStroke(
  row: CourtRow,
  rng: { int(maxExclusive: number): number },
  allowed?: StrokeId[] | null,
): StrokeId {
  const all = BY_ROW[row]
  const pool = allowed?.length ? all.filter((id) => allowed.includes(id)) : all
  const options = pool.length > 0 ? pool : all
  return options[rng.int(options.length)] as StrokeId
}

/** What the voice says for a call: the corner, then the shot. */
export function spokenCall(cornerSpoken: string, stroke: StrokeId): string {
  return `${cornerSpoken}, ${STROKES[stroke].spoken}`
}
