import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { Commitment } from '@/lib/premium/commitment'
import {
  expiryFor,
  isActive,
  isUnlocked,
  type Bundle,
  type FeatureId,
  type PremiumTier,
} from '@/lib/premium/entitlements'

/**
 * Who has paid for what.
 *
 * A word about where this actually lives: in the browser, in local storage,
 * which means anyone who opens the devtools can switch it on. That is a
 * deliberate, temporary state of affairs and not something to paper over —
 * a real subscription needs a payment provider and a server that verifies the
 * receipt, and this store is shaped so that day is a small change: swap
 * `unlock` for something that writes what the server said, and read the tier
 * from the same place.
 *
 * Until then nothing here charges anybody, and the upgrade screen says so.
 */

export type UnlockSource = 'none' | 'preview' | 'purchase'

interface PremiumStore {
  tier: PremiumTier
  source: UnlockSource
  /** Epoch milliseconds, or null when nothing is held. */
  expiresAt: number | null
  /** Which bundle was taken, for the reminder on the profile screen. */
  bundleId: string | null
  /**
   * What was actually bought, as a block with weeks in it.
   *
   * Kept alongside the flag rather than derived from it, because the flag can
   * only ever say "premium, until this date" and the thing somebody paid for
   * was a training block. `sessionsPerWeek` is frozen at purchase: changing
   * your plan later must not retroactively rewrite what you were owed.
   */
  commitment: Commitment | null
  unlock(bundle: Bundle, source: UnlockSource, sessionsPerWeek: number): void
  cancel(): void
}

export const usePremiumStore = create<PremiumStore>()(
  persist(
    (set) => ({
      tier: 'free',
      source: 'none',
      expiresAt: null,
      bundleId: null,
      commitment: null,
      unlock: (bundle, source, sessionsPerWeek) => {
        const startedAt = Date.now()
        const endsAt = expiryFor(bundle, new Date(startedAt))
        set({
          tier: 'premium',
          source,
          expiresAt: endsAt,
          bundleId: bundle.id,
          commitment: { bundleId: bundle.id, startedAt, endsAt, sessionsPerWeek },
        })
      },
      cancel: () =>
        set({
          tier: 'free',
          source: 'none',
          expiresAt: null,
          bundleId: null,
          // The record of what was promised outlives the entitlement on
          // purpose: "what did I actually get for that money" is a fair
          // question after it lapses, not only during.
        }),
    }),
    { name: 'rallyready.premium', version: 2 },
  ),
)

export interface PremiumState {
  tier: PremiumTier
  source: UnlockSource
  expiresAt: number | null
  bundleId: string | null
  commitment: Commitment | null
  /** True only while a premium entitlement is genuinely still in date. */
  active: boolean
  has(feature: FeatureId): boolean
}

/**
 * The tier as the UI should read it — expiry applied. Reading `tier` directly
 * would keep somebody premium for ever once their month ran out.
 */
export function usePremium(): PremiumState {
  const tier = usePremiumStore((state) => state.tier)
  const source = usePremiumStore((state) => state.source)
  const expiresAt = usePremiumStore((state) => state.expiresAt)
  const bundleId = usePremiumStore((state) => state.bundleId)
  const commitment = usePremiumStore((state) => state.commitment)

  const active = isActive({ tier, expiresAt })
  const effective: PremiumTier = active ? 'premium' : 'free'

  return {
    tier: effective,
    source,
    expiresAt,
    bundleId,
    commitment,
    active,
    has: (feature) => isUnlocked(feature, effective),
  }
}
