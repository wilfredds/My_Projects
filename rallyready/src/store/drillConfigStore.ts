import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { Drill } from '@/lib/data/types'
import { useTrainingProfile } from '@/hooks/useTrainingProfile'
import { configFromDrill, type DrillConfig } from '@/lib/timer/plan'

interface DrillConfigStore {
  /** Per-drill overrides, keyed by slug. */
  overrides: Record<string, DrillConfig>
  save(slug: string, config: DrillConfig): void
  clear(slug: string): void
  clearAll(): void
}

/**
 * Remembers how each drill was last set up. Tweaking the interval once should
 * stick — re-configuring before every session is exactly the friction that
 * stops people training.
 */
export const useDrillConfigStore = create<DrillConfigStore>()(
  persist(
    (set) => ({
      overrides: {},
      save: (slug, config) =>
        set((state) => ({ overrides: { ...state.overrides, [slug]: config } })),
      clear: (slug) =>
        set((state) => {
          const { [slug]: _removed, ...rest } = state.overrides
          return { overrides: rest }
        }),
      clearAll: () => set({ overrides: {} }),
    }),
    { name: 'rallyready.drill-config', version: 1 },
  ),
)

/**
 * A drill's saved setup, or its shipped defaults fitted to this player if it
 * has never been touched.
 */
export function useDrillConfig(drill: Drill | null | undefined): DrillConfig | null {
  const override = useDrillConfigStore((state) => (drill ? state.overrides[drill.slug] : undefined))
  const training = useTrainingProfile()
  if (!drill) return null
  return override ?? configFromDrill(drill, training)
}
