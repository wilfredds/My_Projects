import { motion } from 'framer-motion'
import { BookOpen, CalendarRange, LineChart, Timer, User } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'

import { vibrateTap } from '@/lib/audio/haptics'
import { DURATION, SPRING, transition, useTransitionSafe } from '@/lib/motion'
import { TOP_LEVEL_PATHS, type TopLevelPath } from '@/lib/pageDirection'
import { cn } from '@/lib/utils'
import { useCueStore } from '@/store/cueStore'

const LOOK: Record<TopLevelPath, { label: string; icon: typeof Timer }> = {
  '/': { label: 'Train', icon: Timer },
  '/progress': { label: 'Progress', icon: LineChart },
  '/programs': { label: 'Programs', icon: CalendarRange },
  '/library': { label: 'Library', icon: BookOpen },
  '/profile': { label: 'Profile', icon: User },
}

// Order comes from `pageDirection`, which is also what decides which way a
// page slides in. One list, so the marker and the pages cannot disagree.
const ITEMS = TOP_LEVEL_PATHS.map((to) => ({ to, ...LOOK[to], end: to === '/' }))

/**
 * Persistent bottom navigation on mobile; it moves to a sidebar rail on
 * desktop so the planning views get the full width (§5).
 *
 * The active pill is one element shared across all five tabs via `layoutId`,
 * so it travels to the tab you pressed instead of blinking out here and in
 * there. That is the whole trick — it makes the bar read as one object with a
 * moving marker rather than five independent lights.
 */

/** Module-level: `useTransitionSafe` memoises on identity. */
const PILL = SPRING.soft
const ICON = transition(DURATION.quick)

export function BottomNav() {
  const location = useLocation()
  const vibrationEnabled = useCueStore((state) => state.vibrationEnabled)
  const pill = useTransitionSafe(PILL)
  const icon = useTransitionSafe(ICON)

  // A tap that navigates gets the lightest possible confirmation. Tapping the
  // tab you are already on changes nothing, so it buzzes nothing.
  const tap = (to: string, end: boolean) => () => {
    const active = end ? location.pathname === to : location.pathname.startsWith(to)
    if (!active && vibrationEnabled) vibrateTap()
  }

  return (
    <nav
      aria-label="Main"
      className="bg-background/85 safe-bottom fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-lg md:top-0 md:right-auto md:bottom-0 md:left-0 md:w-20 md:border-t-0 md:border-r md:pb-0"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-between px-2 md:h-full md:max-w-none md:flex-col md:justify-start md:gap-1 md:px-2 md:pt-6">
        {ITEMS.map(({ to, label, icon: Icon, end }) => (
          <li key={to} className="flex-1 md:flex-none">
            <NavLink
              to={to}
              end={end}
              onClick={tap(to, end)}
              className={({ isActive }) =>
                cn(
                  'relative flex min-h-[3.25rem] flex-col items-center justify-center gap-1 rounded-xl py-2 text-[0.6875rem] font-medium transition-colors md:min-h-16 md:gap-1.5',
                  isActive
                    ? 'text-primary-ink'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="nav-active-pill"
                      className="bg-accent absolute inset-x-1 inset-y-0.5 rounded-xl"
                      transition={pill}
                      aria-hidden
                    />
                  )}
                  <motion.span
                    className="relative"
                    animate={{ scale: isActive ? 1.06 : 1 }}
                    transition={icon}
                  >
                    <Icon className="size-5" strokeWidth={isActive ? 2.4 : 1.9} aria-hidden />
                  </motion.span>
                  <span className="relative">{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
