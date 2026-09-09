import { localDateKey } from '@/lib/data/streaks'
import type { Adjustment } from '@/lib/data/readiness'
import { adjustmentFor, useUiStore } from '@/store/uiStore'

/**
 * The adjustment the player accepted today, or null.
 *
 * Every screen that quotes how long a drill will take needs this, because the
 * runner scales the session by it — without it the cards advertise a session
 * nobody is about to do.
 */
export function useTodayAdjustment(): Adjustment | null {
  const adjustment = useUiStore((state) => state.adjustment)
  const adjustmentDate = useUiStore((state) => state.adjustmentDate)
  return adjustmentFor({ adjustment, adjustmentDate }, localDateKey(new Date()))
}
