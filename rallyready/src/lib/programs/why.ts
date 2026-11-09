import type { ProgramFocus } from '@/lib/data/types'

import { phaseByWeek, type ProgramPhase } from './periodise'

/**
 * What this week is for, and when it lets up.
 *
 * A plan tells you what to do today. A coach also tells you why, and — more
 * importantly for anyone training alone — when it stops. The weeks people skip
 * are the ugly ones in the middle of a build block, and they skip them because
 * from the inside an eight-week program is indistinguishable from an infinite
 * one. Naming the block and pointing at the deload turns "this is relentless"
 * into "this is week two of three".
 *
 * Derived from the enrolment rather than stored, so it cannot drift out of step
 * with the plan the same function generated.
 */

export interface WhyToday {
  phase: ProgramPhase
  /** Short heading, e.g. "Build week 5 of 8". */
  label: string
  /** What this week is doing to you. */
  purpose: string
  /** What is coming, so a hard block reads as finite. Null in the last week. */
  ahead: string | null
}

const PURPOSE: Record<ProgramPhase, string> = {
  base: 'Movement quality and volume. Nothing this week should feel desperate — you are building the base the hard weeks get spent from.',
  build:
    'Work capacity. The blocks get longer and the rests get shorter, and this is the block that makes the difference by week eight.',
  sharpen:
    'Speed and reaction. Short efforts, fully recovered between them — you are training how fast you move, not how long you last.',
  deload:
    'Backing off on purpose. Fitness is built while you recover, not while you train, and this is the week that collects it.',
}

const REST_PURPOSE =
  'Rest is a session. The work you did this week turns into fitness today, not on the court.'

/** The next deload at or after `week`, or null if there is not one. */
function nextDeload(phases: ProgramPhase[], week: number): number | null {
  for (let candidate = week + 1; candidate <= phases.length; candidate++) {
    if (phases[candidate - 1] === 'deload') return candidate
  }
  return null
}

export function whyToday(input: {
  totalWeeks: number
  currentWeek: number
  focus: ProgramFocus
}): WhyToday | null {
  const phases = phaseByWeek(input.totalWeeks)
  const week = Math.min(Math.max(1, Math.round(input.currentWeek)), phases.length)
  const phase = phases[week - 1]
  if (!phase) return null

  const total = phases.length
  const isFinalWeek = week === total
  const taper = isFinalWeek && phase === 'deload'

  // "Deload" and "taper" are coach words; this line is on the Today card.
  const label = taper
    ? `Final week — the last of ${total}`
    : `${PHASE_WORD[phase]} week ${week} of ${total}`

  const purpose =
    input.focus === 'rest'
      ? REST_PURPOSE
      : taper
        ? 'The work is done. This week is about arriving fresh, so keep it short and keep it sharp.'
        : PURPOSE[phase]

  return { phase, label, purpose, ahead: aheadOf(phases, week, phase) }
}

const PHASE_WORD: Record<ProgramPhase, string> = {
  base: 'Base',
  build: 'Build',
  sharpen: 'Sharpen',
  deload: 'Easy',
}

function aheadOf(phases: ProgramPhase[], week: number, phase: ProgramPhase): string | null {
  const total = phases.length
  if (week === total) return null
  if (week === total - 1) return 'One week left after this one.'

  if (phase === 'deload') {
    return `Back to full training in week ${week + 1}.`
  }

  const deload = nextDeload(phases, week)
  if (deload === null) return `${total - week} weeks to go.`
  if (deload === week + 1) return 'Next week backs off — hold on until then.'
  return `Week ${deload} backs off. ${deload - week} hard weeks between here and there.`
}
