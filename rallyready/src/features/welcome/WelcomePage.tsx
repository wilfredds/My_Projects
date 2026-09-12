import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, HeartPulse, ShieldCheck, TrendingUp, Volume2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { useRepositories } from '@/lib/data/context'
import { markWelcomeShownThisLoad } from '@/lib/firstRun'
import {
  DURATION,
  listItemVariants,
  stepVariants,
  transition,
  useInitialSafe,
  useMotionSafe,
  useTransitionSafe,
  valuePopVariants,
} from '@/lib/motion'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/store/uiStore'

import { CallDemo } from './CallDemo'
import { InstallPrompt } from './InstallPrompt'

/**
 * The first thing a new player sees.
 *
 * Before this, a first-time visitor landed on a dense catalogue with a single
 * welcome card above it — they never learned what the app was for, never heard
 * it work, and on iOS never performed the gesture that unlocks the speech and
 * audio the entire product depends on.
 *
 * Three screens, one idea each, then straight into the four profile questions
 * that already existed. Skippable from the very first screen: somebody who
 * knows what they are doing should not have to sit through an introduction.
 *
 * It is also reachable on purpose, from Profile, and that is not the same
 * visit. Somebody replaying it already has a profile, so the last button must
 * not offer to set one up — it sends them back to training instead.
 */

type Screen = 'what' | 'hear' | 'track'

const ORDER: Screen[] = ['what', 'hear', 'track']

/** Module-level so the memo inside `useTransitionSafe` actually holds. */
const BAR_TRANSITION = transition(DURATION.base)

export function WelcomePage() {
  const navigate = useNavigate()
  const repositories = useRepositories()
  const markSeen = useUiStore((state) => state.markWelcomeSeen)
  const [index, setIndex] = useState(0)

  // Only to decide where the last button goes. Cached, and already fetched by
  // whichever screen sent them here.
  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => repositories.profiles.get(),
  })
  const replaying = profile != null

  const step = useMotionSafe(stepVariants)
  const item = useMotionSafe(listItemVariants)
  const pop = useMotionSafe(valuePopVariants)
  const bar = useTransitionSafe(BAR_TRANSITION)
  const initial = useInitialSafe('hidden')

  const screen = ORDER[index] as Screen
  const last = index === ORDER.length - 1

  // The in-memory guard. Storage can refuse to keep the persisted flag, and
  // without this that turns Skip into a loop back to here.
  useEffect(markWelcomeShownThisLoad, [])

  const finish = () => {
    markSeen()
    navigate(replaying ? '/' : '/onboarding', { replace: true })
  }

  const skip = () => {
    markSeen()
    navigate('/', { replace: true })
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-5 pt-8 pb-8 md:pt-16">
      {/* A progress bar that fills rather than jumps between steps. */}
      <div className="mb-8 flex items-center gap-3">
        <div className="bg-secondary h-1.5 flex-1 overflow-hidden rounded-full">
          <motion.div
            className="bg-primary h-full origin-left rounded-full"
            initial={false}
            animate={{ scaleX: (index + 1) / ORDER.length }}
            transition={bar}
            style={{ transformOrigin: 'left' }}
          />
        </div>
        <Button variant="ghost" size="sm" onClick={skip} className="shrink-0">
          Skip
        </Button>
      </div>

      {/* Top-aligned on a phone, where you read downwards; centred on a desktop,
          where a short screen otherwise floats above an acre of nothing. */}
      <div className="flex-1 md:flex md:items-center">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={screen}
            variants={step}
            initial={initial}
            animate="visible"
            exit="exit"
            className="w-full"
          >
            {screen === 'what' && (
              <section>
                <p className="text-primary type-eyebrow text-sm">RallyReady</p>
                <h1 className="mt-2 text-[2.6rem] leading-[1.05] font-extrabold tracking-[-0.03em] text-balance">
                  A badminton coach for training on your own.
                </h1>
                <p className="text-muted-foreground mt-4 text-lg leading-relaxed">
                  You do not need a partner or a court. The app calls out a corner. You move to it.
                  That is the drill.
                </p>
                <ul className="mt-6 space-y-3">
                  {[
                    'Works in a garage, a hallway or a car park',
                    'Every session logs itself',
                    'Completely usable with no connection at all',
                  ].map((line, i) => (
                    <motion.li
                      key={line}
                      custom={i}
                      variants={item}
                      initial={initial}
                      animate="visible"
                      className="text-muted-foreground flex gap-3 text-sm leading-snug"
                    >
                      <span className="bg-primary mt-1.5 size-2 shrink-0 rounded-full" />
                      {line}
                    </motion.li>
                  ))}
                </ul>
              </section>
            )}

            {screen === 'hear' && (
              <section>
                <p className="text-primary type-eyebrow flex items-center gap-2 text-sm">
                  <Volume2 className="size-4" aria-hidden />
                  Listen
                </p>
                <h1 className="mt-2 text-[2.2rem] leading-[1.08] font-extrabold tracking-[-0.03em] text-balance">
                  You never look at the screen.
                </h1>
                <p className="text-muted-foreground mt-3 mb-6 leading-relaxed">
                  Press the button and listen. Every call is spoken out loud. It also beeps and
                  buzzes, so you can feel it with the phone in your pocket.
                </p>
                <CallDemo />
              </section>
            )}

            {screen === 'track' && (
              <section>
                <p className="text-primary type-eyebrow text-sm">And it watches</p>
                <h1 className="mt-2 text-[2.2rem] leading-[1.08] font-extrabold tracking-[-0.03em] text-balance">
                  It will tell you when to stop.
                </h1>
                <p className="text-muted-foreground mt-3 leading-relaxed">
                  When you train alone, nobody tells you to slow down. The app does. That part is
                  always free.
                </p>
                <ul className="mt-6 space-y-3">
                  {[
                    {
                      icon: HeartPulse,
                      title: 'A five-second check-in',
                      body: 'Three taps: sleep, legs, energy. On a bad day the session gets easier.',
                    },
                    {
                      icon: TrendingUp,
                      title: 'Training load, not minutes',
                      body: 'Ten hard minutes count for more than thirty easy ones.',
                    },
                    {
                      icon: ShieldCheck,
                      title: 'A warm-up you can actually do',
                      body: 'Guided and spoken. Five minutes now beats six weeks off.',
                    },
                  ].map((entry, i) => (
                    <motion.li
                      key={entry.title}
                      custom={i}
                      variants={item}
                      initial={initial}
                      animate="visible"
                      className="flex gap-3"
                    >
                      <span className="bg-accent text-accent-foreground grid size-9 shrink-0 place-items-center rounded-xl">
                        <entry.icon className="size-4" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{entry.title}</p>
                        <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                          {entry.body}
                        </p>
                      </div>
                    </motion.li>
                  ))}
                </ul>
                <InstallPrompt />
              </section>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-8 flex items-center gap-3">
        <div className="flex gap-1.5" aria-hidden>
          {ORDER.map((name, i) => (
            <span
              key={name}
              className={cn(
                'h-1.5 rounded-full transition-all duration-[var(--duration-base)]',
                i === index ? 'bg-primary w-5' : 'bg-border w-1.5',
              )}
            />
          ))}
        </div>
        <div className="flex-1" />
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={last ? 'go' : 'next'} variants={pop} initial="hidden" animate="visible">
            <Button size="lg" onClick={() => (last ? finish() : setIndex((n) => n + 1))}>
              {last ? (replaying ? 'Back to training' : 'Set me up') : 'Next'}
              <ArrowRight />
            </Button>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
