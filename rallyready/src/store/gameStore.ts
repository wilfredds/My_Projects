import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { persistStorage } from './persistStorage'

/**
 * Mini-game results, kept out of the training repositories on purpose.
 *
 * Thirty seconds of tapping a phone is not training and must never reach the
 * training load, the streak or the pace chart — a streak you can hold by
 * playing a game is a streak that means nothing. It lives here instead: local,
 * disposable, and yours.
 */

export interface ReflexResult {
  /** Epoch milliseconds. */
  at: number
  score: number
  hits: number
  accuracy: number
  averageMs: number | null
  bestMs: number | null
}

const HISTORY = 20

interface GameStore {
  bestScore: number
  bestReactionMs: number | null
  played: number
  /** Newest first, capped — this is a scoreboard, not an archive. */
  history: ReflexResult[]
  record(result: ReflexResult): void
  reset(): void
}

export const useGameStore = create<GameStore>()(
  persist(
    (set) => ({
      bestScore: 0,
      bestReactionMs: null,
      played: 0,
      history: [],
      record: (result) =>
        set((state) => ({
          bestScore: Math.max(state.bestScore, result.score),
          bestReactionMs:
            result.bestMs === null
              ? state.bestReactionMs
              : Math.min(state.bestReactionMs ?? Infinity, result.bestMs),
          played: state.played + 1,
          history: [result, ...state.history].slice(0, HISTORY),
        })),
      reset: () => set({ bestScore: 0, bestReactionMs: null, played: 0, history: [] }),
    }),
    { name: 'rallyready.games', version: 1, storage: persistStorage },
  ),
)
