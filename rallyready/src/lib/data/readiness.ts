import { scaleConfig, type DrillConfig } from '@/lib/timer/plan'

import type { LoadStatus } from './load'
import { isPrepOrRecovery } from './seed/drills'
import type { Drill, ReadinessAnswers } from './types'

/**
 * The five-second check-in, and what the app does with the answer.
 *
 * A written plan cannot tell that you slept four hours and can barely walk down
 * the stairs. A coach can, and adjusts the session on the spot. That
 * adjustment — auto-regulation — is most of the difference between a plan and
 * coaching, and it is the one thing a fixed calendar can never do.
 *
 * Three questions, because a questionnaire nobody fills in tells you nothing.
 * They are the three that move most in the wellness literature: sleep, muscle
 * soreness and general energy. Every answer runs 1 (bad) to 5 (good), soreness
 * included, so a higher number always means a better day and the arithmetic
 * never needs a special case.
 */

export const READINESS_MIN = 1
export const READINESS_MAX = 5

export type ReadinessKey = keyof ReadinessAnswers

export interface ReadinessQuestion {
  key: ReadinessKey
  prompt: string
  /** Labels for 1..5, in order. */
  scale: [string, string, string, string, string]
}

export const READINESS_QUESTIONS: ReadinessQuestion[] = [
  {
    key: 'sleep',
    prompt: 'How did you sleep?',
    scale: ['Barely', 'Badly', 'So-so', 'Well', 'Great'],
  },
  {
    key: 'soreness',
    prompt: 'How do your legs feel?',
    scale: ['Wrecked', 'Sore', 'Tight', 'Fine', 'Fresh'],
  },
  {
    key: 'energy',
    prompt: 'Energy right now?',
    scale: ['Empty', 'Low', 'OK', 'Good', 'Buzzing'],
  },
]

export function clampAnswer(value: number): number {
  if (Number.isNaN(value)) return 3
  if (value === Infinity) return READINESS_MAX
  if (value === -Infinity) return READINESS_MIN
  return Math.min(READINESS_MAX, Math.max(READINESS_MIN, Math.round(value)))
}

/** 0–100, where 100 is three fives. */
export function readinessScore(answers: ReadinessAnswers): number {
  const total =
    clampAnswer(answers.sleep) + clampAnswer(answers.soreness) + clampAnswer(answers.energy)
  const lowest = READINESS_QUESTIONS.length * READINESS_MIN
  const range = READINESS_QUESTIONS.length * (READINESS_MAX - READINESS_MIN)
  return Math.round(((total - lowest) / range) * 100)
}

export type ReadinessBand = 'low' | 'fair' | 'good'

export const READINESS_BAND_COPY: Record<ReadinessBand, { label: string; blurb: string }> = {
  low: { label: 'Beat up', blurb: 'Today is a day to move well, not to chase numbers.' },
  fair: { label: 'Serviceable', blurb: 'Not your best day, not a write-off. Train as planned.' },
  good: { label: 'Ready', blurb: 'Good day to do something hard.' },
}

/**
 * Any single answer at the bottom of its scale, whatever the other two say.
 *
 * Averaging hides the answer that matters. "Slept fine, energy fine, legs
 * wrecked" totals to a perfectly respectable 50 — and wrecked legs are the
 * single most direct warning sign there is for a session built entirely out of
 * lunging and landing. One bottom answer outranks the arithmetic.
 */
export function hasRedFlag(answers: ReadinessAnswers): boolean {
  return (
    clampAnswer(answers.sleep) === READINESS_MIN ||
    clampAnswer(answers.soreness) === READINESS_MIN ||
    clampAnswer(answers.energy) === READINESS_MIN
  )
}

export function readinessBand(answers: ReadinessAnswers): ReadinessBand {
  if (hasRedFlag(answers)) return 'low'
  const score = readinessScore(answers)
  if (score < 40) return 'low'
  if (score < 70) return 'fair'
  return 'good'
}

/** The answer dragging the score down, for a reason that names something real. */
export function weakestAnswer(answers: ReadinessAnswers): ReadinessKey {
  const entries: [ReadinessKey, number][] = [
    ['sleep', clampAnswer(answers.sleep)],
    ['soreness', clampAnswer(answers.soreness)],
    ['energy', clampAnswer(answers.energy)],
  ]
  return entries.reduce((worst, entry) => (entry[1] < worst[1] ? entry : worst))[0]
}

const WEAKEST_REASON: Record<ReadinessKey, string> = {
  sleep: 'You slept badly, and a tired nervous system makes fast footwork slower and sloppier.',
  soreness: 'Your legs are still sore, so the last session has not finished being absorbed yet.',
  energy: 'You are running on empty, and a session you push through half-hearted teaches nothing.',
}

/* ------------------------------------------------------------ regulation */

export type Adjustment = 'lighter' | 'as-planned' | 'harder'

export interface Recommendation {
  adjustment: Adjustment
  /** Multiplier applied to work time and rounds when the user accepts it. */
  scale: number
  headline: string
  reason: string
}

/**
 * Reduced enough to matter, not so far that the session stops counting — and
 * shared with the runner, so the number the recommendation promises is the
 * number the drill actually uses.
 */
export const ADJUSTMENT_SCALE: Record<Adjustment, number> = {
  lighter: 0.7,
  'as-planned': 1,
  harder: 1.15,
}

const LIGHTER_SCALE = ADJUSTMENT_SCALE.lighter
const HARDER_SCALE = ADJUSTMENT_SCALE.harder

const AS_PLANNED: Recommendation = {
  adjustment: 'as-planned',
  scale: 1,
  headline: 'Train as planned',
  reason: 'Nothing here says today should be different. Do the session as written.',
}

/**
 * Turns today's check and the recent workload into one instruction.
 *
 * Deliberately conservative in one direction: it will suggest backing off on
 * the strength of feel alone, but never suggests going harder unless the
 * workload figures agree. Wrongly telling a fresh player to take it easy costs
 * one ordinary session. Wrongly telling a tired one to push costs six weeks.
 */
export function autoRegulate(input: {
  answers: ReadinessAnswers | null
  load: LoadStatus
}): Recommendation {
  const { answers, load } = input

  if (!answers) {
    if (load === 'spiking') {
      return {
        adjustment: 'lighter',
        scale: LIGHTER_SCALE,
        headline: 'Take today lighter',
        reason:
          'This week is already far heavier than the month behind it. Another hard session is how that turns into an injury.',
      }
    }
    return AS_PLANNED
  }

  const band = readinessBand(answers)

  if (band === 'low') {
    return {
      adjustment: 'lighter',
      scale: LIGHTER_SCALE,
      headline: 'Take today lighter',
      reason: `${WEAKEST_REASON[weakestAnswer(answers)]} Cut it back, move well, and keep the streak.`,
    }
  }

  if (load === 'spiking') {
    return {
      adjustment: 'lighter',
      scale: LIGHTER_SCALE,
      headline: 'Take today lighter',
      reason:
        band === 'good'
          ? 'You feel good, but your load has jumped well past what the last month prepared you for. Feeling good is exactly how people run into that wall.'
          : 'Your week is already well above your recent normal. Trim this one and come back hard in a few days.',
    }
  }

  if (band === 'good' && (load === 'steady' || load === 'detraining' || load === 'settling')) {
    return {
      adjustment: 'harder',
      scale: HARDER_SCALE,
      headline: 'Good day to push',
      reason:
        load === 'detraining'
          ? 'You feel fresh and you have been training below your usual. Add a round.'
          : 'You feel fresh and your workload has room in it. Add a round or hold a faster interval.',
    }
  }

  return AS_PLANNED
}

/**
 * The settings a drill will *actually* run with today.
 *
 * An accepted "take today lighter" cuts the rounds by 30%, and the runner has
 * always applied it — but every screen that showed a duration was still
 * quoting the unadjusted one, so a card promised eight minutes and the drill
 * ran six. That is the same class of lie as a card that ignores the player's
 * level, and it is only reachable by somebody who does the daily check-in,
 * which is to say a returning player.
 *
 * A warm-up or a cool-down is never scaled: a shorter warm-up is not a lighter
 * session, it is a worse one. The rule lives here so the runner and the cards
 * cannot drift apart on it.
 */
export function configForToday(
  config: DrillConfig,
  drill: Drill,
  adjustment: Adjustment | null,
): DrillConfig {
  if (!adjustment || isPrepOrRecovery(drill)) return config
  return scaleConfig(config, ADJUSTMENT_SCALE[adjustment])
}
