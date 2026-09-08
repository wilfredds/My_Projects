import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { persistStorage } from './persistStorage'

import { DEFAULT_CUE_PREFERENCES, type CuePreferences } from '@/lib/audio/cues'
import { MAX_SPLIT_STEP_LEAD_MS, MIN_SPLIT_STEP_LEAD_MS } from '@/lib/timer/plan'
import { clamp } from '@/lib/utils'

interface CueStore extends CuePreferences {
  set<K extends keyof CuePreferences>(key: K, value: CuePreferences[K]): void
  reset(): void
}

/**
 * How the app sounds. Persisted, because nobody wants to re-enable haptics
 * before every session.
 */
export const useCueStore = create<CueStore>()(
  persist(
    (set) => ({
      ...DEFAULT_CUE_PREFERENCES,
      set: (key, value) =>
        set(() => ({
          [key]:
            key === 'splitStepLeadMs'
              ? clamp(value as number, MIN_SPLIT_STEP_LEAD_MS, MAX_SPLIT_STEP_LEAD_MS)
              : value,
        })),
      reset: () => set({ ...DEFAULT_CUE_PREFERENCES }),
    }),
    {
      name: 'rallyready.cue-preferences',
      storage: persistStorage,
      version: 3,
      /*
       * Version 2 added `callLanguage`; version 3 replaced the single
       * `voiceUri` with one per language.
       *
       * The migration must exist at all because zustand *discards the whole
       * persisted state* on a version mismatch when no `migrate` is given —
       * leaving it out would silently reset everybody's tone volume,
       * split-step lead and haptics the first time they opened the app.
       * Spreading the defaults under the stored state fills in new keys and
       * leaves everything else alone.
       *
       * The old `voiceUri` is dropped rather than carried across, and that
       * loses nothing: it was written by the settings screen and read by
       * nobody, so no session has ever been spoken in the voice it names, and
       * it does not record which language it was chosen for.
       *
       * The cast is zustand's: `migrate` is typed as returning the whole store
       * including its actions, but what it returns is shallow-merged over the
       * live store, so returning the data alone is correct at runtime.
       */
      migrate: (persisted) => {
        const { voiceUri: _dropped, ...rest } = (persisted ?? {}) as Partial<CuePreferences> & {
          voiceUri?: string | null
        }
        return { ...DEFAULT_CUE_PREFERENCES, ...rest } as CueStore
      },
      // Never persist the transient announce flag: it belongs to the drill mode.
      partialize: ({ announceNumbers: _announceNumbers, ...rest }) => rest,
    },
  ),
)

export function selectCuePreferences(state: CueStore): CuePreferences {
  return {
    voiceEnabled: state.voiceEnabled,
    voiceRate: state.voiceRate,
    voiceUris: state.voiceUris,
    toneEnabled: state.toneEnabled,
    toneVolume: state.toneVolume,
    vibrationEnabled: state.vibrationEnabled,
    countdownEnabled: state.countdownEnabled,
    splitStepEnabled: state.splitStepEnabled,
    splitStepLeadMs: state.splitStepLeadMs,
    wakeLockEnabled: state.wakeLockEnabled,
    announceNumbers: state.announceNumbers,
    callLanguage: state.callLanguage,
  }
}
