import type { BlockPhase } from '@/lib/timer/types'

/**
 * Phase colour mapping, shared by the dial, the board and the runner's
 * background wash. Work is energetic, rest is cool and calm (§5).
 */

export const PHASE_TEXT: Record<BlockPhase, string> = {
  prepare: 'text-muted-foreground',
  warmup: 'text-warmup-ink',
  work: 'text-work-ink',
  rest: 'text-rest-ink',
  sprint: 'text-sprint-ink',
  cooldown: 'text-cooldown-ink',
}

export const PHASE_STROKE: Record<BlockPhase, string> = {
  prepare: 'stroke-muted-foreground',
  warmup: 'stroke-warmup',
  work: 'stroke-work',
  rest: 'stroke-rest',
  sprint: 'stroke-sprint',
  cooldown: 'stroke-cooldown',
}

/** Solid phase colour, for the shape strip that previews a session. */
export const PHASE_FILL: Record<BlockPhase, string> = {
  prepare: 'bg-muted-foreground/40',
  warmup: 'bg-warmup',
  work: 'bg-work',
  rest: 'bg-rest',
  sprint: 'bg-sprint',
  cooldown: 'bg-cooldown',
}

export const PHASE_NAME: Record<BlockPhase, string> = {
  prepare: 'Get ready',
  warmup: 'Warm-up',
  work: 'Work',
  rest: 'Rest',
  sprint: 'Sprint',
  cooldown: 'Cool-down',
}

/** A wash of phase colour behind the runner — readable from across a room. */
export const PHASE_WASH: Record<BlockPhase, string> = {
  prepare: 'from-muted-foreground/5',
  warmup: 'from-warmup/10',
  work: 'from-work/15',
  rest: 'from-rest/12',
  sprint: 'from-sprint/15',
  cooldown: 'from-cooldown/10',
}
