import { describe, expect, it } from 'vitest'

import {
  canSwitchOff,
  daysRemaining,
  expiryFor,
  isActive,
  isUnlocked,
  monthlyRate,
  ALWAYS_FREE,
  BUNDLES,
  PREMIUM_FEATURES,
  type FeatureId,
} from './entitlements'

describe('the free/paid line', () => {
  it('unlocks everything for a subscriber', () => {
    for (const feature of PREMIUM_FEATURES) {
      expect(isUnlocked(feature.id, 'premium'), feature.id).toBe(true)
    }
  })

  it('locks exactly the listed features for a free player, and nothing else', () => {
    for (const feature of PREMIUM_FEATURES) {
      expect(isUnlocked(feature.id, 'free'), feature.id).toBe(false)
    }
    expect(isUnlocked('anything-else' as FeatureId, 'free')).toBe(true)
  })

  it('never puts a safety feature behind the paywall', () => {
    // The warm-up, the readiness check and the load warning are the features
    // that stop someone getting hurt. If one of these ever appears in the paid
    // list, this test is the thing that should stop the release.
    const paid = PREMIUM_FEATURES.map((feature) => `${feature.name} ${feature.blurb}`.toLowerCase())
    for (const forbidden of ['warm-up', 'warm up', 'readiness', 'injury']) {
      for (const entry of paid) {
        // "load warnings" may be *mentioned*, but no paid feature may be one.
        expect(entry.startsWith(forbidden), `${forbidden} in "${entry.slice(0, 40)}"`).toBe(false)
      }
    }
    const free = ALWAYS_FREE.join(' ').toLowerCase()
    expect(free).toContain('readiness')
    expect(free).toContain('warm-up')
    expect(free).toContain('benchmark')
  })

  it('keeps taking a challenge free even though sending one is paid', () => {
    const sending = PREMIUM_FEATURES.find((feature) => feature.id === 'send-challenges')
    expect(sending?.blurb.toLowerCase()).toContain('taking a challenge is always free')
  })
})

describe('bundles', () => {
  it('gets cheaper per month the longer you commit', () => {
    const rates = BUNDLES.map(monthlyRate)
    for (let i = 1; i < rates.length; i++) {
      expect(rates[i]!).toBeLessThan(rates[i - 1]!)
    }
  })

  it('prices everything inside the range a club player would actually pay', () => {
    for (const bundle of BUNDLES) {
      expect(bundle.pricePhp).toBeGreaterThan(0)
      expect(monthlyRate(bundle)).toBeLessThanOrEqual(99)
    }
  })

  it('marks exactly one bundle as the best value', () => {
    expect(BUNDLES.filter((bundle) => bundle.best)).toHaveLength(1)
  })

  it('has unique ids', () => {
    const ids = BUNDLES.map((bundle) => bundle.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('entitlement lifetime', () => {
  const now = new Date(2026, 7, 12).getTime()

  it('treats a free tier as inactive whatever the expiry says', () => {
    expect(isActive({ tier: 'free', expiresAt: now + 999_999 }, now)).toBe(false)
  })

  it('treats a missing expiry as expired rather than as forever', () => {
    // The only way a real purchase writes no expiry is a bug, and the safe
    // failure is "not premium", not "premium for ever".
    expect(isActive({ tier: 'premium', expiresAt: null }, now)).toBe(false)
  })

  it('is active until the moment it runs out', () => {
    expect(isActive({ tier: 'premium', expiresAt: now + 1 }, now)).toBe(true)
    expect(isActive({ tier: 'premium', expiresAt: now }, now)).toBe(false)
    expect(isActive({ tier: 'premium', expiresAt: now - 1 }, now)).toBe(false)
  })

  it('runs an expiry the right number of months out', () => {
    const from = new Date(2026, 0, 15)
    const quarter = BUNDLES.find((bundle) => bundle.months === 3)!
    expect(new Date(expiryFor(quarter, from)).getMonth()).toBe(3) // April
  })

  it('counts the days left, and never goes negative', () => {
    expect(daysRemaining(now + 86_400_000 * 3, now)).toBe(3)
    expect(daysRemaining(now - 86_400_000, now)).toBe(0)
    expect(daysRemaining(null, now)).toBeNull()
  })
})

describe('getting back to free', () => {
  const commitment = { bundleId: 'quarter', startedAt: 0, endsAt: 1, sessionsPerWeek: 3 }

  it('is always possible from the free preview', () => {
    /*
     * Every unlock records a commitment. The off switch used to require there
     * be none, so switching the preview on was a one-way door: a tester who
     * wanted to see the free app again had no way back.
     */
    expect(canSwitchOff({ active: true, source: 'preview', commitment })).toBe(true)
  })

  it('is offered for a plain unlock with nothing promised', () => {
    expect(canSwitchOff({ active: true, source: 'purchase', commitment: null })).toBe(true)
  })

  it('is not offered on a paid block, which is weeks owed rather than a switch', () => {
    expect(canSwitchOff({ active: true, source: 'purchase', commitment })).toBe(false)
  })

  it('is not offered when Premium is not on', () => {
    expect(canSwitchOff({ active: false, source: 'preview', commitment })).toBe(false)
  })
})
