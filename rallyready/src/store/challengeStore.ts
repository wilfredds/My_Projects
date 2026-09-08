import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { persistStorage } from './persistStorage'

import type { Challenge } from '@/lib/social/challenge'

export interface AcceptedChallenge extends Challenge {
  acceptedAt: number
}

interface ChallengeStore {
  /** The challenge currently being attempted, if any. */
  active: AcceptedChallenge | null
  accept(challenge: AcceptedChallenge): void
  clear(): void
}

/**
 * The challenge you are in the middle of.
 *
 * Held between accepting one and finishing the drill, so the summary screen can
 * say whether you beat it. Cleared the moment it has been reported — a stale
 * challenge silently comparing itself against next week's session would be
 * worse than no comparison at all.
 */
export const useChallengeStore = create<ChallengeStore>()(
  persist(
    (set) => ({
      active: null,
      accept: (challenge) => set({ active: challenge }),
      clear: () => set({ active: null }),
    }),
    { name: 'rallyready.challenge', version: 1, storage: persistStorage },
  ),
)
