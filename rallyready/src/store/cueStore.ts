import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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
      version: 2,
      /*
       * Version 2 added `callLanguage`. The migration is a passthrough on
       * purpose: zustand *discards the whole persisted state* on a version
       * mismatch when no `migrate` is given, so leaving it out would silently
       * reset everybody's tone volume, split-step lead and haptics the first
       * time they opened the app after this shipped. Spreading the defaults
       * under the stored state fills in the new key and leaves the rest alone.
       *
       * The cast is zustand's: `migrate` is typed as returning the whole store
       * including its actions, but what it returns is shallow-merged over the
       * live store, so returning the data alone is correct at runtime.
       */
      migrate: (persisted) =>
        ({
          ...DEFAULT_CUE_PREFERENCES,
          ...(persisted as Partial<CuePreferences>),
        }) as CueStore,
      // Never persist the transient announce flag: it belongs to the drill mode.
      partialize: ({ announceNumbers: _announceNumbers, ...rest }) => rest,
    },
  ),
)

export function selectCuePreferences(state: CueStore): CuePreferences {
  return {
    voiceEnabled: state.voiceEnabled,
    voiceRate: state.voiceRate,
    voiceUri: state.voiceUri,
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
