import { CORNERS, type CornerId } from './corners'
import { levelAtOrBelow, strokesForRow, type StrokeId, type StrokeLevel } from './strokes'

/**
 * Rally patterns — the caller says a point, not a corner.
 *
 * Every drill in the app so far has called places, then places and shots. Both
 * are real training and neither is how a match is won. A match is won in
 * *sequences*: you do not smash to win the rally, you smash so that the block
 * comes back short and you are already at the net to kill it. Watch any
 * professional and the shot that wins the point is usually two shots after the
 * one that decided it.
 *
 * A pattern is a short, named sequence of your own shots — corner and stroke,
 * in order — taken from how points are actually constructed. Shadowed at pace,
 * it trains the thing random calling cannot: the recovery you make *because of*
 * the shot you just played, and the position you take *before* the reply comes.
 *
 * Patterns are tagged by game and by level, because singles and doubles are
 * different sports played on the same court — singles moves people up and
 * back over the full diagonal, doubles is flat, fast and decided in the front
 * two thirds — and because "hold, slice, tumble" is not a drill for somebody
 * still learning to get behind the shuttle.
 *
 * Every shot here is legal for the part of the court it is played from, and a
 * test asserts it: a pattern that asked for a smash from the net would be worse
 * than no pattern at all.
 */

export type PatternPlay = 'singles' | 'doubles'

export interface PatternShot {
  corner: CornerId
  stroke: StrokeId
}

export interface RallyPattern {
  id: string
  /** Short enough to sit on the board while you are running it. */
  name: string
  play: PatternPlay
  level: StrokeLevel
  /** Why a match player runs this, in one sentence. */
  intent: string
  shots: PatternShot[]
}

const shot = (corner: CornerId, stroke: StrokeId): PatternShot => ({ corner, stroke })

export const PATTERNS: RallyPattern[] = [
  /* ------------------------------------------------------------- singles */
  {
    id: 's-four-corners',
    name: 'Four corners',
    play: 'singles',
    level: 'beginner',
    intent:
      'The base singles pattern: make them cover the long diagonal, then make them cover it again the other way.',
    shots: [
      shot('rear-left', 'clear'),
      shot('net-right', 'net-shot'),
      shot('rear-right', 'clear'),
      shot('net-left', 'net-shot'),
    ],
  },
  {
    id: 's-straight-game',
    name: 'The straight game',
    play: 'singles',
    level: 'beginner',
    intent:
      'Straight until it breaks. The shortest recovery for you and the longest one for them — cross-court is what you play when this stops working.',
    shots: [
      shot('rear-left', 'drop'),
      shot('net-left', 'net-shot'),
      shot('rear-left', 'clear'),
      shot('net-left', 'net-shot'),
    ],
  },
  {
    id: 's-smash-and-follow',
    name: 'Smash and follow in',
    play: 'singles',
    level: 'intermediate',
    intent:
      'The smash is not the point. Arriving at the net before the block does is the point — most rallies are lost by admiring the smash.',
    shots: [
      shot('rear-right', 'smash'),
      shot('net-right', 'net-kill'),
      shot('net-right', 'net-shot'),
      shot('rear-right', 'clear'),
    ],
  },
  {
    id: 's-defend-and-counter',
    name: 'Defend, then take it',
    play: 'singles',
    level: 'intermediate',
    intent:
      'Two blocks to survive, one net shot to level the rally, one clear to take the initiative back. Getting out of defence is a skill of its own.',
    shots: [
      shot('mid-left', 'block'),
      shot('mid-right', 'block'),
      shot('net-left', 'net-shot'),
      shot('rear-right', 'clear'),
    ],
  },
  {
    id: 's-hold-and-slice',
    name: 'Hold, slice, tumble',
    play: 'singles',
    level: 'advanced',
    intent:
      'Every shot from the same preparation. Get there early enough to wait, and the shot they read is the one you did not play.',
    shots: [
      shot('rear-left', 'hold-drop'),
      shot('net-left', 'tumble-net'),
      shot('rear-right', 'slice-drop'),
      shot('net-right', 'cross-net'),
    ],
  },
  {
    id: 's-six-corner-press',
    name: 'Six-corner press',
    play: 'singles',
    level: 'advanced',
    intent:
      'Six shots without a free one. This is what the last five points of a close third game feel like, and it is trainable.',
    shots: [
      shot('rear-left', 'punch-clear'),
      shot('net-right', 'tumble-net'),
      shot('rear-right', 'jump-smash'),
      shot('net-right', 'net-kill'),
      shot('rear-left', 'slice-drop'),
      shot('net-left', 'cross-net'),
    ],
  },

  /* ------------------------------------------------------------- doubles */
  {
    id: 'd-side-by-side',
    name: 'Side-by-side defence',
    play: 'doubles',
    level: 'beginner',
    intent:
      'You lifted, so you are defending. Level with your partner, racket up and in front, and take the smash early rather than deep.',
    shots: [
      shot('mid-left', 'block'),
      shot('mid-right', 'block'),
      shot('mid-right', 'lift'),
      shot('mid-left', 'block'),
    ],
  },
  {
    id: 'd-drive-exchange',
    name: 'Drive exchange',
    play: 'doubles',
    level: 'beginner',
    intent:
      'The flat exchange is won by whoever takes it earlier and higher. Short backswing, racket already up, no time to wind up.',
    shots: [
      shot('mid-left', 'drive'),
      shot('mid-right', 'drive'),
      shot('mid-left', 'drive'),
      shot('net-right', 'push'),
    ],
  },
  {
    id: 'd-attack-rotation',
    name: 'Attack rotation',
    play: 'doubles',
    level: 'intermediate',
    intent:
      'Front and back when you attack: smash, then follow it in and take the front. The pair that rotates faster keeps the attack.',
    shots: [
      shot('rear-right', 'smash'),
      shot('net-right', 'net-kill'),
      shot('net-left', 'net-kill'),
    ],
  },
  {
    id: 'd-lift-and-rotate',
    name: 'Lift and rotate back',
    play: 'doubles',
    level: 'intermediate',
    intent:
      'The moment you lift, the shape changes. Get from the net back to level with your partner before the smash arrives, not after.',
    shots: [
      shot('net-left', 'net-shot'),
      shot('net-left', 'lift'),
      shot('mid-left', 'block'),
      shot('mid-right', 'block'),
    ],
  },
  {
    id: 'd-defence-to-attack',
    name: 'Defence into attack',
    play: 'doubles',
    level: 'advanced',
    intent:
      'Block short, follow it to the net, and if the lift comes, take it in the air. The whole rally turns on those three shots.',
    shots: [
      shot('mid-right', 'block'),
      shot('net-right', 'net-shot'),
      shot('rear-right', 'jump-smash'),
      shot('net-right', 'net-kill'),
    ],
  },
  {
    id: 'd-flat-pressure',
    name: 'Flat pressure',
    play: 'doubles',
    level: 'advanced',
    intent:
      'Nothing goes up. Drive, flick only to change the length, and punish anything that comes back above the tape.',
    shots: [
      shot('mid-left', 'drive'),
      shot('net-left', 'flick-lift'),
      shot('mid-right', 'drive'),
      shot('net-right', 'net-kill'),
    ],
  },
]

export function patternById(id: string): RallyPattern | undefined {
  return PATTERNS.find((pattern) => pattern.id === id)
}

/**
 * The patterns worth running for a game and a level.
 *
 * `both` gets everything, which is the honest answer for a player who plays
 * both: the singles patterns build the movement and the doubles ones build the
 * speed, and club players need both halves.
 */
export function patternsFor(play: PatternPlay | 'both', level: StrokeLevel): RallyPattern[] {
  return PATTERNS.filter(
    (pattern) => (play === 'both' || pattern.play === play) && levelAtOrBelow(pattern.level, level),
  )
}

/** Every zone a set of patterns visits — the board only lights what is used. */
export function cornersInPatterns(patterns: RallyPattern[]): CornerId[] {
  const seen = new Set<CornerId>()
  for (const pattern of patterns) for (const s of pattern.shots) seen.add(s.corner)
  return (Object.keys(CORNERS) as CornerId[]).filter((id) => seen.has(id))
}

/** Whether every shot in a pattern can honestly be played from where it is called. */
export function patternIsLegal(pattern: RallyPattern): boolean {
  return pattern.shots.every((s) => strokesForRow(CORNERS[s.corner].row).includes(s.stroke))
}
