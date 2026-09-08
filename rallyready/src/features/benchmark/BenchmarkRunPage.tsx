import { AnimatePresence, motion } from 'framer-motion'
import { Flag, Pause, Play, X } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { swapVariants, useInitialSafe, useMotionSafe } from '@/lib/motion'
import { useSessionGuard } from '@/hooks/useSessionGuard'
import { useRepositories } from '@/lib/data/context'
import { METRIC_BENCHMARK_LEVEL, METRIC_CALLS } from '@/lib/data/stats'
import {
  BENCHMARK_LEVELS,
  BENCHMARK_TEST_TYPE,
  benchmarkPlan,
  benchmarkScore,
} from '@/lib/timer/benchmark'
import { cornerIdsForLayout } from '@/lib/timer/corners'
import { randomSeed } from '@/lib/timer/rng'
import type { BlockPhase } from '@/lib/timer/types'
import { formatDuration, pluralize } from '@/lib/utils'
import { selectCuePreferences, useCueStore } from '@/store/cueStore'

import { CourtBoard } from '../train/components/CourtBoard'
import { TimerDial } from '../train/components/TimerDial'
import { PHASE_WASH } from '../train/phaseStyles'
import { useDrillRunner, type RunnerSummary } from '../train/useDrillRunner'

/**
 * The benchmark runner.
 *
 * Deliberately not the drill runner with a different plan: there is no Skip
 * here, because skipping a level would invalidate the score. The only way out
 * is to stop, and stopping is the measurement.
 */
export function BenchmarkRunPage() {
  const navigate = useNavigate()
  const repositories = useRepositories()
  const swap = useMotionSafe(swapVariants)
  const initial = useInitialSafe('hidden')
  // Still needed as a plain boolean: the board components take it as a prop.
  const reducedMotion = useReducedMotion()
  const cues = useCueStore()

  const [stopOpen, setStopOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const startedAtRef = useRef<Date>(new Date())

  const seed = useMemo(() => randomSeed(), [])
  const plan = useMemo(() => benchmarkPlan(seed), [seed])

  const preferences = useMemo(
    () => ({
      ...selectCuePreferences(cues),
      // The metronome would pace the athlete through a test of their own pacing.
      splitStepEnabled: false,
      splitStepLeadMs: 0,
      announceNumbers: false,
    }),
    [cues],
  )

  const handleComplete = useCallback(
    async (summary: RunnerSummary) => {
      setSaving(true)
      const score = benchmarkScore(summary.callsAnswered)
      try {
        const benchmark = await repositories.benchmarks.create({
          testType: BENCHMARK_TEST_TYPE,
          takenAt: startedAtRef.current,
          score,
          levelReached: summary.roundsCompleted,
          raw: {
            durationSec: summary.durationSec,
            callsAnswered: summary.callsAnswered,
            avgShotIntervalMs: summary.avgShotIntervalMs,
            finishedAllLevels: summary.completed,
          },
        })
        // A benchmark is training too, so it belongs in the streak and totals.
        await repositories.sessions.create(
          {
            drillId: null,
            drillName: 'Fitness benchmark',
            startedAt: startedAtRef.current,
            durationSec: summary.durationSec,
            roundsCompleted: summary.roundsCompleted,
            avgShotIntervalMs: summary.avgShotIntervalMs,
            source: 'benchmark',
          },
          [
            { metricKey: METRIC_CALLS, metricValue: summary.callsAnswered },
            { metricKey: METRIC_BENCHMARK_LEVEL, metricValue: summary.roundsCompleted },
          ],
        )
        navigate(`/benchmark/result/${benchmark.id}`, { replace: true })
      } catch {
        navigate('/benchmark', { replace: true })
      }
    },
    [navigate, repositories],
  )

  const runner = useDrillRunner({ plan, preferences, onComplete: handleComplete })
  const { state, timeline } = runner

  const phase: BlockPhase = state.block?.phase ?? 'prepare'
  const isIdle = state.status === 'idle'
  const isResting = phase === 'rest' || phase === 'prepare'

  // Losing a benchmark to a stray back gesture is worse than losing a drill:
  // the whole point is that it is a measurement you only take occasionally.
  useSessionGuard({
    active: state.status === 'running' || state.status === 'paused',
    onLeaveAttempt: () => setStopOpen(true),
  })
  // A rest block carries no round number of its own, so the level coming up is
  // derived from how many are already banked.
  const nextLevel = Math.min(state.roundsCompleted + 1, BENCHMARK_LEVELS)
  const secondsRemaining = Math.ceil(state.blockRemainingMs / 1000)

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden">
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-b to-transparent transition-colors duration-500 ${PHASE_WASH[phase]}`}
        aria-hidden
      />

      <header className="safe-top relative flex shrink-0 items-center justify-between gap-3 px-4 pt-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => (isIdle ? navigate('/benchmark') : setStopOpen(true))}
          aria-label={isIdle ? 'Back' : 'Stop the test'}
        >
          <X />
        </Button>
        <div className="min-w-0 text-center">
          <p className="truncate text-sm font-semibold">Fitness benchmark</p>
          <p className="text-muted-foreground tnum text-xs">
            {isIdle
              ? `${BENCHMARK_LEVELS} levels · up to ${formatDuration(timeline.totalMs / 1000)}`
              : `${formatDuration(state.elapsedMs / 1000)} elapsed`}
          </p>
        </div>
        <div className="w-11" />
      </header>

      <p aria-live="polite" className="sr-only">
        {isIdle
          ? 'Ready to start the benchmark'
          : `${state.block?.label ?? ''}, ${secondsRemaining} seconds left`}
      </p>

      <main className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-4 py-2 md:flex-row md:gap-8 md:px-8">
        <div className="w-full max-w-[min(20rem,38dvh)] shrink-0 md:max-w-[min(26rem,58dvh)]">
          <TimerDial
            display={isIdle ? String(BENCHMARK_LEVELS) : String(secondsRemaining)}
            overallProgress={state.overallProgress}
            phase={phase}
            phaseLabel={isIdle ? 'Levels' : (state.block?.label ?? 'Ready')}
            detail={
              isIdle
                ? 'Go until you cannot hold the pace'
                : phase === 'rest'
                  ? `Level ${nextLevel} next`
                  : `${pluralize(state.callsAnswered, 'corner')} · ${pluralize(state.roundsCompleted, 'level')} banked`
            }
          />
        </div>

        <div className="min-h-0 w-full max-w-[20rem] flex-1 md:h-full md:max-w-[24rem] md:flex-none">
          <CourtBoard
            layout={4}
            enabled={cornerIdsForLayout(4)}
            activeCorner={state.activeCorner}
            callProgress={state.callProgress}
            showNumbers={false}
            resting={isResting}
            reducedMotion={reducedMotion}
          />
        </div>
      </main>

      <footer className="safe-bottom relative px-4 pb-5">
        <AnimatePresence mode="wait" initial={false}>
          {isIdle ? (
            <motion.div
              key="idle"
              variants={swap}
              initial={initial}
              animate="visible"
              exit="exit"
              className="mx-auto flex w-full max-w-md flex-col items-center gap-3"
            >
              <div className="flex flex-wrap justify-center gap-2">
                <Badge variant="outline">4 corners</Badge>
                <Badge variant="outline">18s → 30s work</Badge>
                <Badge variant="outline">10s recovery</Badge>
              </div>
              <Button size="xl" className="w-full" onClick={() => void runner.start()}>
                <Play className="fill-current" />
                Start the test
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="running"
              variants={swap}
              initial={initial}
              animate="visible"
              exit="exit"
              className="mx-auto flex w-full max-w-md items-center gap-3"
            >
              <Button
                variant="outline"
                size="lg"
                className="size-14 shrink-0 px-0"
                onClick={runner.togglePause}
                disabled={saving}
                title={state.status === 'paused' ? 'Resume' : 'Pause'}
              >
                {state.status === 'paused' ? (
                  <Play className="fill-current" />
                ) : (
                  <Pause className="fill-current" />
                )}
                <span className="sr-only">{state.status === 'paused' ? 'Resume' : 'Pause'}</span>
              </Button>
              <Button
                size="lg"
                variant="destructive"
                className="min-w-0 flex-1"
                onClick={() => setStopOpen(true)}
                disabled={saving}
              >
                <Flag />
                I&rsquo;m done — record my score
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
        {saving && <p className="text-muted-foreground mt-3 text-center text-sm">Saving…</p>}
      </footer>

      <Dialog open={stopOpen} onOpenChange={setStopOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record your score?</DialogTitle>
            <DialogDescription>
              You have completed {pluralize(state.roundsCompleted, 'level')} and{' '}
              {pluralize(state.callsAnswered, 'corner')}. Stopping now records that as your result —
              this is the test, not a failure.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setStopOpen(false)}>
              Keep going
            </Button>
            <Button
              onClick={() => {
                setStopOpen(false)
                if (state.status === 'idle') navigate('/benchmark')
                else runner.stop()
              }}
            >
              Record it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
