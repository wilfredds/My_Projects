/**
 * What is free, what is paid, and why the line falls where it does.
 *
 * Two rules held this apart:
 *
 * 1. **Nothing that prevents an injury is ever paywalled.** The warm-up, the
 *    readiness check and the training-load warning stay free for everyone,
 *    for ever. Charging someone for the feature that stops them hurting
 *    themselves is not a business model, it is a hostage situation.
 * 2. **The free app has to be genuinely good on its own.** Every drill, the
 *    whole reference, the benchmark, the game and your full history are free.
 *    Premium buys the coaching *judgement* layered on top — being told what to
 *    do today and why — plus the deeper analysis. That is the part a human
 *    coach charges for, and the part that costs real money to keep improving.
 *
 * Receiving a challenge is free even though sending one is not: a social loop
 * that requires both people to pay is not a loop.
 */

export type PremiumTier = 'free' | 'premium'

export type FeatureId =
  'coach' | 'all-programs' | 'custom-programs' | 'deep-analytics' | 'send-challenges'

export interface Feature {
  id: FeatureId
  name: string
  blurb: string
}

export const PREMIUM_FEATURES: Feature[] = [
  {
    id: 'coach',
    name: 'Your daily session, decided',
    blurb:
      'The app reads your check-in, your workload and what you have neglected, then tells you exactly what to do today and why — instead of handing you a catalogue.',
  },
  {
    id: 'all-programs',
    name: 'Every training program',
    blurb:
      'All periodised plans, four to sixteen weeks, Base through Sharpen with deloads built in. Free covers one.',
  },
  {
    id: 'custom-programs',
    name: 'Build your own program',
    blurb: 'Generate a periodised plan around your weeks, your sessions and your court access.',
  },
  {
    id: 'deep-analytics',
    name: 'The full picture',
    blurb:
      'Your training rating and its breakdown, readiness trends, pace curves and per-drill bests.',
  },
  {
    id: 'send-challenges',
    name: 'Challenge other players',
    blurb:
      'Send anyone the exact session you just did — same drill, same shuttle order — and compare. Taking a challenge is always free.',
  },
]

/**
 * Free in perpetuity. Listed explicitly rather than left implicit, so that
 * moving one of these behind the paywall later takes a deliberate edit to a
 * file that says in writing why you should not.
 */
export const ALWAYS_FREE: string[] = [
  'Every drill, circuit and conditioning workout',
  'The full warm-up, cool-down and mobility work',
  'The basics: grips, stance, the shots, with diagrams',
  'Your daily readiness check and load warnings',
  'The fitness benchmark and your whole history',
  'Reflex Rush, and taking any challenge sent to you',
  'Export and import of everything you have logged',
]

/**
 * What is promised in return for the money, in the words it is promised in.
 *
 * Lives beside `ALWAYS_FREE` and for the same reason: a commitment written
 * into a file that explains itself is harder to quietly walk back than one
 * written into a marketing paragraph. Each of these is enforced somewhere —
 * the first by `weeksOf` and `creditedEnd`, the second by `ALWAYS_FREE` and
 * its test, the third by the entitlement check the whole app gates on.
 */
export const GUARANTEES: { title: string; body: string }[] = [
  {
    title: 'You get the weeks you paid for',
    body: 'A bundle is a training block with weeks in it, not a switch. Any week inside it that we fail to cover is added back to the end date automatically — you do not have to notice it or ask for it.',
  },
  {
    title: 'Nothing you have done is ever taken away',
    body: 'Your sessions, your history, the drills, the warm-up and every safety feature stay free and stay yours when a block ends. Premium is the coaching on top; it is not the door.',
  },
  {
    title: 'The account is shown to you, both sides',
    body: 'Week by week, what the block asked of you and what you did — and every promise checked against whether it is actually switched on. If we are not delivering, the same screen says so.',
  },
]

export interface Bundle {
  id: string
  name: string
  /** Philippine pesos, charged once for the whole period. */
  pricePhp: number
  months: number
  blurb: string
  best?: boolean
}

export const BUNDLES: Bundle[] = [
  {
    id: 'month',
    name: '1 month',
    pricePhp: 99,
    months: 1,
    blurb: 'Try the coach for a month. Cancel by simply not renewing.',
  },
  {
    id: 'quarter',
    name: '3 months',
    pricePhp: 199,
    months: 3,
    blurb: 'A full training block, start to finish — long enough to actually see a change.',
    best: true,
  },
  {
    id: 'year',
    name: '12 months',
    pricePhp: 599,
    months: 12,
    blurb: 'A season and then some, at half the monthly rate.',
  },
]

export function monthlyRate(bundle: Bundle): number {
  return Math.round(bundle.pricePhp / bundle.months)
}

/** What one coaching session costs locally, for the comparison on the page. */
export const COACH_SESSION_PHP = 800

export function isUnlocked(feature: FeatureId, tier: PremiumTier): boolean {
  if (tier === 'premium') return true
  return !PREMIUM_FEATURES.some((entry) => entry.id === feature)
}

/**
 * Whether a stored entitlement is still live.
 *
 * `expiresAt` of null means "no expiry recorded" — treated as expired rather
 * than as forever, because the only way a real purchase produces no expiry is
 * if something went wrong writing it.
 */
export function isActive(
  entitlement: { tier: PremiumTier; expiresAt: number | null },
  now = Date.now(),
): boolean {
  if (entitlement.tier !== 'premium') return false
  if (entitlement.expiresAt === null) return false
  return entitlement.expiresAt > now
}

export function expiryFor(bundle: Bundle, from = new Date()): number {
  const end = new Date(from)
  end.setMonth(end.getMonth() + bundle.months)
  return end.getTime()
}

/** Days left, for the reminder on the profile screen. */
export function daysRemaining(expiresAt: number | null, now = Date.now()): number | null {
  if (expiresAt === null) return null
  return Math.max(0, Math.ceil((expiresAt - now) / 86_400_000))
}
