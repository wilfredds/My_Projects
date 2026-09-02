import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { Adjustment } from '@/lib/data/readiness'
import type { Discipline, SkillLevel } from '@/lib/data/types'

/**
 * A warm-up is good for about this long. Past it you have cooled down and the
 * prompt comes back; inside it, the app stops asking. Roughly the window the
 * sports-science literature gives for the raised muscle temperature that makes
 * a warm-up worth doing at all.
 */
export const WARM_FOR_MS = 45 * 60 * 1000

interface UiStore {
  /** The "set up your profile" prompt, once the user has said no thanks. */
  setupPromptDismissed: boolean
  dismissSetupPrompt(): void
  /** When the last warm-up finished, so the app can stop nagging. */
  lastWarmupAt: number | null
  markWarmedUp(): void
  /**
   * The auto-regulation the player accepted, and the day they accepted it for.
   * Dated rather than timed: an adjustment is a decision about today, and it
   * has to expire on its own overnight instead of quietly lightening tomorrow.
   */
  adjustment: Adjustment | null
  adjustmentDate: string | null
  setAdjustment(adjustment: Adjustment | null, date: string): void
  /**
   * The level the catalogue is filtered to. Null means "follow my profile" —
   * once the player picks one here, their choice wins, because browsing above
   * your level to see what is coming is a legitimate thing to want.
   */
  browseLevel: SkillLevel | null
  setBrowseLevel(level: SkillLevel | null): void
  /**
   * The game the training is shaped around. Null follows the profile, for the
   * same reason as the level above: somebody who put "doubles" in onboarding
   * and has a singles tournament next month should be able to say so here
   * without editing their profile.
   */
  browseDiscipline: Discipline | null
  setBrowseDiscipline(discipline: Discipline | null): void
  /**
   * When the first-run welcome was completed or skipped. A first-run screen
   * that reappears is worse than none at all.
   */
  welcomeSeenAt: number | null
  markWelcomeSeen(): void
  /** The install offer is made once and never again. */
  installPromptDismissed: boolean
  dismissInstallPrompt(): void
  /**
   * What has already been celebrated.
   *
   * `null` means the app has never looked, which is what an install from
   * before rewards existed looks like. See `lib/rewards`: on `null` the app
   * takes a silent snapshot rather than handing somebody nine unlock
   * animations for badges they earned months ago.
   */
  seenBadges: string[] | null
  recordSeenBadges(slugs: string[]): void
  celebratedStreak: number | null
  recordCelebratedStreak(weeks: number): void
}

/**
 * Small persisted bits of UI state that are not settings and not data.
 *
 * A prompt you cannot dismiss is a nag, and a nag that reappears on every visit
 * teaches people to ignore that part of the screen.
 */
export const useUiStore = create<UiStore>()(
  persist(
    (set) => ({
      setupPromptDismissed: false,
      dismissSetupPrompt: () => set({ setupPromptDismissed: true }),
      lastWarmupAt: null,
      markWarmedUp: () => set({ lastWarmupAt: Date.now() }),
      adjustment: null,
      adjustmentDate: null,
      setAdjustment: (adjustment, date) =>
        set({ adjustment, adjustmentDate: adjustment === null ? null : date }),
      browseLevel: null,
      setBrowseLevel: (browseLevel) => set({ browseLevel }),
      browseDiscipline: null,
      setBrowseDiscipline: (browseDiscipline) => set({ browseDiscipline }),
      welcomeSeenAt: null,
      markWelcomeSeen: () => set({ welcomeSeenAt: Date.now() }),
      installPromptDismissed: false,
      dismissInstallPrompt: () => set({ installPromptDismissed: true }),
      seenBadges: null,
      recordSeenBadges: (seenBadges) => set({ seenBadges }),
      celebratedStreak: null,
      recordCelebratedStreak: (celebratedStreak) => set({ celebratedStreak }),
    }),
    { name: 'rallyready.ui', version: 7 },
  ),
)

/** The accepted adjustment, but only while it is still today's. */
export function adjustmentFor(
  state: Pick<UiStore, 'adjustment' | 'adjustmentDate'>,
  today: string,
): Adjustment | null {
  if (state.adjustmentDate !== today) return null
  return state.adjustment
}

/** True if a warm-up finished recently enough to still count. */
export function isStillWarm(lastWarmupAt: number | null, now = Date.now()): boolean {
  if (lastWarmupAt === null) return false
  return now - lastWarmupAt < WARM_FOR_MS
}
