import { PREMIUM_FEATURES, type FeatureId, type PremiumTier } from './entitlements'

/**
 * What was promised, and whether it was delivered.
 *
 * Paying for a training plan is not the same as paying for a feature flag. If
 * somebody buys three months of coaching they have bought a *block* — twelve
 * weeks with sessions in them — and the only way to be honest about that is to
 * write down what the block asked for and what actually happened, week by
 * week, and then show it to them without editing.
 *
 * Two things follow from that, and both are deliberate:
 *
 * 1. **The record is two-sided.** It shows the weeks the player fell short and
 *    it shows the weeks the app had nothing to give. An accountability screen
 *    that only reports the customer's failures is a scoreboard, not an
 *    account.
 * 2. **A week the app failed to plan is credited back.** Not as a gesture —
 *    those weeks are counted here and the period is extended by them. It is
 *    the only promise in the app that costs the app something, which is what
 *    makes it worth making.
 *
 * Everything here is pure and derived from sessions that were actually logged.
 * There is no separate "delivery" counter that could drift away from reality.
 */

export interface Commitment {
  bundleId: string
  /** When the block began. */
  startedAt: number
  /** When it is due to end, before any credit. */
  endsAt: number
  /**
   * Sessions a week the block is built around, taken from the plan at the
   * moment of purchase so that changing it later cannot rewrite history.
   */
  sessionsPerWeek: number
}

/** A week of the block, from the app's side and the player's. */
export type WeekState =
  /** Did what the block asked, or more. */
  | 'met'
  /** Trained, but fewer times than the block asked. */
  | 'short'
  /** The week that is running now. */
  | 'current'
  /** Not here yet. */
  | 'future'
  /**
   * A week inside the block that premium did not actually cover. The player
   * paid for it and the app did not deliver it, so it is credited back.
   */
  | 'uncovered'

export interface WeekDelivery {
  /** 1-based, as a person would count it. */
  index: number
  startsAt: number
  endsAt: number
  /** Sessions the block asked for. */
  asked: number
  /** Sessions actually completed inside the week. */
  done: number
  state: WeekState
}

const WEEK_MS = 7 * 86_400_000

/** How many whole weeks the block covers. Always at least one. */
export function weekCount(commitment: Commitment): number {
  return Math.max(1, Math.round((commitment.endsAt - commitment.startedAt) / WEEK_MS))
}

/**
 * The block, week by week, against what was actually logged.
 *
 * `sessionTimes` are completion timestamps. Anything outside the block is
 * ignored: training before you paid is not something the block delivered, and
 * claiming it would be the easiest lie in the file.
 *
 * `coveredUntil` is when the entitlement actually runs to, which is normally
 * the same as the block's end and is the whole point when it is not. If
 * premium stops early — cancelled, or lost to a bug — the remaining weeks were
 * bought and not supplied, and they are marked as ours rather than quietly
 * folded in with weeks the player skipped.
 */
export function weeksOf(
  commitment: Commitment,
  sessionTimes: number[],
  now: number,
  coveredUntil: number = commitment.endsAt,
): WeekDelivery[] {
  const total = weekCount(commitment)
  const asked = Math.max(0, Math.round(commitment.sessionsPerWeek))

  return Array.from({ length: total }, (_, i) => {
    const startsAt = commitment.startedAt + i * WEEK_MS
    const endsAt = startsAt + WEEK_MS
    const done = sessionTimes.filter((at) => at >= startsAt && at < endsAt).length

    let state: WeekState
    if (asked === 0 || startsAt >= coveredUntil) state = 'uncovered'
    else if (now < startsAt) state = 'future'
    else if (now < endsAt) state = 'current'
    else state = done >= asked ? 'met' : 'short'

    return { index: i + 1, startsAt, endsAt, asked, done, state }
  })
}

export interface DeliverySummary {
  totalWeeks: number
  /** 1-based index of the week running now, or null once the block is over. */
  currentWeek: number | null
  /** Weeks that have finished. */
  elapsedWeeks: number
  askedSoFar: number
  doneSoFar: number
  /** Sessions behind the block's ask. Never negative — being ahead is not debt. */
  shortfall: number
  /** Weeks inside the block that premium did not cover. Credited back. */
  uncoveredWeeks: number
  /** True when the player has done everything asked of them so far. */
  onTrack: boolean
}

export function summarise(weeks: WeekDelivery[], now: number): DeliverySummary {
  const finished = weeks.filter((week) => week.state === 'met' || week.state === 'short')
  const askedSoFar = finished.reduce((sum, week) => sum + week.asked, 0)
  const doneSoFar = finished.reduce((sum, week) => sum + week.done, 0)
  const current = weeks.find((week) => now >= week.startsAt && now < week.endsAt) ?? null

  return {
    totalWeeks: weeks.length,
    currentWeek: current?.index ?? null,
    elapsedWeeks: finished.length,
    askedSoFar,
    doneSoFar,
    shortfall: Math.max(0, askedSoFar - doneSoFar),
    uncoveredWeeks: weeks.filter((week) => week.state === 'uncovered').length,
    onTrack: doneSoFar >= askedSoFar,
  }
}

/**
 * The end date after crediting back every week premium failed to cover.
 *
 * Deliberately not conditional on the player having "earned" it. A week we did
 * not supply is a week we did not supply, whatever they did with it.
 */
export function creditedEnd(commitment: Commitment, weeks: WeekDelivery[]): number {
  const credit = weeks.filter((week) => week.state === 'uncovered').length
  return commitment.endsAt + credit * WEEK_MS
}

export interface PromiseStatus {
  id: FeatureId
  name: string
  /** Whether this is switched on right now, checked rather than asserted. */
  live: boolean
}

/**
 * Every promise the upgrade page made, checked against what is actually on.
 *
 * The point is that this is *derived* from the same entitlement function the
 * rest of the app gates on, so the page cannot claim a feature is delivered
 * while the app quietly refuses it.
 */
export function promiseStatus(
  tier: PremiumTier,
  isUnlocked: (feature: FeatureId, tier: PremiumTier) => boolean,
): PromiseStatus[] {
  return PREMIUM_FEATURES.map((feature) => ({
    id: feature.id,
    name: feature.name,
    live: isUnlocked(feature.id, tier),
  }))
}

/** Days between now and a date, never negative. */
export function daysUntil(at: number, now: number): number {
  return Math.max(0, Math.ceil((at - now) / 86_400_000))
}
