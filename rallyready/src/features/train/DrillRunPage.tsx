import { AnimatePresence, motion } from 'framer-motion'
import { ArrowDown, ArrowUp, ChevronsRight, Loader2, Pause, Play, Power, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

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
import { findExercise } from '@/lib/data/seed/exercises'
import { isConditioning, isPrepOrRecovery } from '@/lib/data/seed/drills'
import { ADJUSTMENT_SCALE } from '@/lib/data/readiness'
import {
  METRIC_CALLS,
  METRIC_COMPLETED,
  METRIC_DECEPTION,
  METRIC_INTERVAL_MS,
  METRIC_REST_SEC,
  METRIC_ROUNDS,
  METRIC_SEED,
  METRIC_WORK_SEC,
} from '@/lib/data/stats'
import { localDateKey } from '@/lib/data/streaks'
import type { Drill } from '@/lib/data/types'
import { cornerIdsForLayout } from '@/lib/timer/corners'
import { estimateDurationSec, isCircuit, planFromConfig, scaleConfig } from '@/lib/timer/plan'
import { CircuitBoard } from '@/features/conditioning/components/CircuitBoard'
import { patternById } from '@/lib/timer/patterns'
import { STROKES } from '@/lib/timer/strokes'
import { randomSeed } from '@/lib/timer/rng'
import type { BlockPhase } from '@/lib/timer/types'
import { formatCompactDuration, formatDuration, pluralize } from '@/lib/utils'
import { useCueStore } from '@/store/cueStore'
import { useUiStore } from '@/store/uiStore'
import { useDrillConfig } from '@/store/drillConfigStore'

import { CourtBoard } from './components/CourtBoard'
import { TimerDial } from './components/TimerDial'
import { PHASE_TEXT, PHASE_WASH } from './phaseStyles'
import { useDrillRunner, type RunnerSummary } from './useDrillRunner'

export function DrillRunPage() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const repositories = useRepositories()

  const [drill, setDrill] = useState<Drill | null | undefined>(undefined)
  useEffect(() => {
    let cancelled = false
    void repositories.drills.getBySlug(slug).then((found) => {
      if (!cancelled) setDrill(found)
    })
    return () => {
      cancelled = true
    }
  }, [repositories, slug])

  if (drill === undefined) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Loader2 className="text-muted-foreground size-6 animate-spin" aria-label="Loading drill" />
      </div>
    )
  }

  if (drill === null) {
    return (
      <div className="grid min-h-dvh place-items-center gap-4 p-6 text-center">
        <div>
          <h1 className="text-xl font-semibold">Drill not found</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            &ldquo;{slug}&rdquo; is not in the catalogue.
          </p>
        </div>
        <Button onClick={() => navigate('/')}>Back to Train</Button>
      </div>
    )
  }

  return <Runner drill={drill} />
}

function Runner({ drill }: { drill: Drill }) {
  const navigate = useNavigate()
  const repositories = useRepositories()
  const swap = useMotionSafe(swapVariants)
  const initial = useInitialSafe('hidden')
  // Still needed as a plain boolean: the board components take it as a prop.
  const reducedMotion = useReducedMotion()
  const savedConfig = useDrillConfig(drill)

  /*
   * Auto-regulation, applied at the last possible moment.
   *
   * The adjustment is deliberately not written into the saved config: it is a
   * decision about today, and a tired Tuesday must not quietly become the new
   * normal for this drill. Warm-ups and cool-downs are exempt — a lighter
   * warm-up is not a lighter session, it is a worse one.
   */
  const storedAdjustment = useUiStore((state) => state.adjustment)
  const adjustmentDate = useUiStore((state) => state.adjustmentDate)
  const adjustment =
    isPrepOrRecovery(drill) || adjustmentDate !== localDateKey(new Date()) ? null : storedAdjustment

  const config = useMemo(
    () =>
      savedConfig && adjustment
        ? scaleConfig(savedConfig, ADJUSTMENT_SCALE[adjustment])
        : savedConfig,
    [savedConfig, adjustment],
  )

  // Pulled out of the optional chain so hook dependency arrays stay plain
  // identifiers — the React Compiler cannot track `config?.mode` as a dep.
  const drillMode = config?.mode ?? null

  const cues = useCueStore()
  const setAnnounceNumbers = useCueStore((state) => state.set)
  const markWarmedUp = useUiStore((state) => state.markWarmedUp)

  // Number mode is a property of the drill, not a saved cue preference.
  useEffect(() => {
    setAnnounceNumbers('announceNumbers', drillMode === 'number')
  }, [drillMode, setAnnounceNumbers])

  const [quitOpen, setQuitOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const startedAtRef = useRef<Date>(new Date())

  // One seed per mount: the session is reproducible, but a fresh visit is a
  // fresh drill. Re-rolling on every render would rebuild the timeline mid-run.
  const seed = useMemo(() => randomSeed(), [])

  const preferences = useMemo(
    () => ({
      voiceEnabled: cues.voiceEnabled,
      voiceRate: cues.voiceRate,
      voiceUri: cues.voiceUri,
      toneEnabled: cues.toneEnabled,
      toneVolume: cues.toneVolume,
      vibrationEnabled: cues.vibrationEnabled,
      countdownEnabled: cues.countdownEnabled,
      splitStepEnabled: cues.splitStepEnabled,
      splitStepLeadMs: cues.splitStepLeadMs,
      wakeLockEnabled: cues.wakeLockEnabled,
      announceNumbers: cues.announceNumbers,
    }),
    [cues],
  )

  const plan = useMemo(() => {
    if (!config) return null
    return planFromConfig(config, {
      splitStepLeadMs: cues.splitStepEnabled ? cues.splitStepLeadMs : 0,
      seed,
    })
  }, [config, cues.splitStepEnabled, cues.splitStepLeadMs, seed])

  const handleComplete = useCallback(
    async (summary: RunnerSummary) => {
      setSaving(true)

      // A warm-up is preparation, not training. Logging it as a session would
      // let someone hold a streak by stretching, and would drag the training
      // load and pace charts towards work that was deliberately easy. It is
      // remembered only so the app can stop nagging you to do one.
      if (isPrepOrRecovery(drill)) {
        if (drill.category === 'warmup') markWarmedUp()
        navigate('/', { replace: true })
        return
      }

      try {
        const session = await repositories.sessions.create(
          {
            drillId: drill.id,
            drillName: drill.name,
            startedAt: startedAtRef.current,
            durationSec: summary.durationSec,
            roundsCompleted: summary.roundsCompleted,
            avgShotIntervalMs: summary.avgShotIntervalMs,
            source: isConditioning(drill) ? 'conditioning' : 'timer',
          },
          [
            { metricKey: METRIC_CALLS, metricValue: summary.callsAnswered },
            { metricKey: METRIC_COMPLETED, metricValue: summary.completed ? 1 : 0 },
            // Recorded per session so the badge engine can count Deception work
            // without having to know what the drill is configured like today.
            { metricKey: METRIC_DECEPTION, metricValue: drillMode === 'deception' ? 1 : 0 },
            // What it would take to replay this session exactly on another
            // phone. Recorded here rather than reconstructed later, because the
            // settings can be changed afterwards and a challenge that does not
            // match what you actually did is worse than no challenge.
            { metricKey: METRIC_SEED, metricValue: seed },
            { metricKey: METRIC_ROUNDS, metricValue: config?.rounds ?? 0 },
            { metricKey: METRIC_WORK_SEC, metricValue: config?.workSec ?? 0 },
            { metricKey: METRIC_REST_SEC, metricValue: config?.restSec ?? 0 },
            { metricKey: METRIC_INTERVAL_MS, metricValue: config?.intervalMs ?? 0 },
          ],
        )
        navigate(`/session/${session.id}`, { replace: true })
      } catch {
        // Storage refused (private mode, quota). The training still happened —
        // do not strand the user on a dead screen over it.
        navigate('/', { replace: true })
      }
    },
    [config, drillMode, drill, markWarmedUp, navigate, repositories, seed],
  )

  const runner = useDrillRunner({
    plan: plan ?? FALLBACK_PLAN,
    preferences,
    onComplete: handleComplete,
  })
  const { state, timeline } = runner

  const phase: BlockPhase = state.block?.phase ?? 'prepare'
  const isIdle = state.status === 'idle'

  // A refresh or a back gesture used to bin the session outright.
  useSessionGuard({
    active: state.status === 'running' || state.status === 'paused',
    onLeaveAttempt: () => setQuitOpen(true),
  })
  const isResting = phase === 'rest' || phase === 'cooldown' || phase === 'prepare'
  const enabledCorners = config?.enabledCorners ?? cornerIdsForLayout(drill.corners)
  const circuit = config ? isCircuit(config) : false

  // During a rest the card shows what is coming, which is the only thing worth
  // knowing while you catch your breath. Before the start it previews the
  // opening exercise rather than showing nothing.
  const shownExercise =
    state.block?.exerciseSlug ??
    state.nextBlock?.exerciseSlug ??
    (circuit ? config?.circuit?.[0]?.exerciseSlug : undefined)

  /** The exercise after the rest that follows the current work block. */
  const nextExerciseAfterRest = () =>
    timeline.blocks.find(
      (block) => block.index > state.blockIndex && block.exerciseSlug !== undefined,
    )?.exerciseSlug

  // Space bar pauses — handy with a laptop propped on a chair.
  useEffect(() => {
    if (isIdle) return
    const handler = (event: KeyboardEvent) => {
      if (event.code !== 'Space' && event.key !== ' ') return
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'BUTTON'].includes(target.tagName)) return
      event.preventDefault()
      runner.togglePause()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isIdle, runner])

  if (!config || !plan) return null

  const secondsRemaining = Math.ceil(state.blockRemainingMs / 1000)
  const totalSec = Math.round(timeline.totalMs / 1000)

  /** The line under the digits: what is coming, or how the round is going. */
  /** "Attack rotation · 2 of 3 · smash", or just the shot outside pattern mode. */
  const rally = state.activePattern ? patternById(state.activePattern.id) : undefined
  const shotLine =
    isIdle || isResting
      ? null
      : [
          rally?.name,
          state.activePattern
            ? `${state.activePattern.shotIndex} of ${state.activePattern.shots}`
            : null,
          state.activeStroke ? STROKES[state.activeStroke].label : null,
        ]
          .filter(Boolean)
          .join(' · ') || null

  function runnerDetail(): string {
    if (phase === 'warmup') return `Easy movement · ${pluralize(state.callsAnswered, 'call')}`
    if (circuit) {
      // The dial's label already carries the position and the card names the
      // exercise, so this line answers the only remaining question.
      if (isResting) return state.nextBlock?.label ?? 'Finishing up'
      const upcoming = state.nextBlock?.exerciseSlug ?? nextExerciseAfterRest()
      return upcoming ? `Then · ${findExercise(upcoming)?.name ?? 'next'}` : 'Last one'
    }
    if (state.block && !state.block.emitsCalls) {
      return state.nextBlock ? `Up next · ${state.nextBlock.label}` : 'Finishing up'
    }
    return `${pluralize(state.callsAnswered, 'call')} answered`
  }

  return (
    // Exactly one viewport tall and non-scrolling: mid-drill the board must
    // never slide out from under a glance.
    <div className="relative flex h-dvh flex-col overflow-hidden">
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-b to-transparent transition-colors duration-500 ${PHASE_WASH[phase]}`}
        aria-hidden
      />

      <header className="safe-top relative flex shrink-0 items-center justify-between gap-3 px-4 pt-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => (isIdle ? navigate(-1) : setQuitOpen(true))}
          aria-label={isIdle ? 'Back' : 'Exit drill'}
        >
          <X />
        </Button>

        <div className="min-w-0 text-center">
          <p className="truncate text-sm font-semibold">{drill.name}</p>
          <p className="text-muted-foreground tnum text-xs">
            {isIdle
              ? `${formatCompactDuration(estimateDurationSec(config))} · ${timeline.totalCalls} calls`
              : `${formatDuration(state.elapsedMs / 1000)} / ${formatDuration(totalSec)}`}
          </p>
        </div>

        <div className="w-11" />
      </header>

      {/* Announced for screen readers instead of the per-second digits. */}
      <p aria-live="polite" className="sr-only">
        {isIdle
          ? 'Ready to start'
          : `${state.block?.label ?? ''}, ${secondsRemaining} seconds left`}
      </p>

      {/* Portrait stacks the dial over the board; landscape and desktop put them
          side by side so both can be far bigger than a stacked layout allows. */}
      <main className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-4 py-2 md:flex-row md:gap-8 md:px-8">
        <div className="w-full max-w-[min(20rem,38dvh)] shrink-0 md:max-w-[min(26rem,58dvh)]">
          <TimerDial
            display={
              isIdle ? formatDuration(estimateDurationSec(config)) : String(secondsRemaining)
            }
            overallProgress={state.overallProgress}
            phase={phase}
            phaseLabel={isIdle ? 'Ready' : (state.block?.label ?? 'Ready')}
            detail={isIdle ? 'Total time' : runnerDetail()}
          />
        </div>

        <div className="min-h-0 w-full max-w-[20rem] flex-1 md:h-full md:max-w-[24rem] md:flex-none">
          {circuit ? (
            <CircuitBoard exerciseSlug={shownExercise} resting={isResting} />
          ) : (
            <div className="flex h-full min-h-0 flex-col">
              <div className="min-h-0 flex-1">
                <CourtBoard
                  layout={config.layout}
                  enabled={enabledCorners}
                  activeCorner={state.activeCorner}
                  callProgress={state.callProgress}
                  showNumbers={config.mode === 'number'}
                  resting={isResting}
                  reducedMotion={reducedMotion}
                />
              </div>

              {/*
               * The shot, echoing what was just spoken.
               *
               * Never the only place it appears — you cannot watch a screen and
               * move to a corner at the same time, which is the whole premise
               * of the app. This is for the glance between rallies, and for
               * anyone training with the sound off.
               */}
              {shotLine && (
                <p
                  className="text-muted-foreground mt-1 min-h-[1.25rem] text-center text-xs"
                  aria-live="off"
                >
                  {shotLine}
                </p>
              )}
            </div>
          )}
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
              {/* Never change someone's session without telling them it
                  changed, or the drill they know becomes untrustworthy. */}
              {adjustment && (
                <Badge variant={adjustment === 'lighter' ? 'outline' : 'accent'}>
                  {adjustment === 'lighter' ? (
                    <ArrowDown className="size-3" aria-hidden />
                  ) : (
                    <ArrowUp className="size-3" aria-hidden />
                  )}
                  {adjustment === 'lighter' ? 'Lightened for today' : 'Pushed up for today'}
                </Badge>
              )}

              <div className="flex flex-wrap justify-center gap-2">
                {circuit ? (
                  <>
                    <Badge variant="outline">
                      {pluralize(config.circuit?.length ?? 0, 'exercise')}
                    </Badge>
                    <Badge variant="outline">{pluralize(config.circuitRounds, 'round')}</Badge>
                    {drill.equipment.length > 0 && (
                      <Badge variant="outline">{drill.equipment.join(', ')}</Badge>
                    )}
                  </>
                ) : (
                  <>
                    <Badge variant="outline">{config.layout} zones</Badge>
                    <Badge variant="outline">
                      {(config.intervalMs / 1000).toFixed(2)}s per call
                    </Badge>
                    <Badge variant="outline">
                      {config.workSec}s / {config.restSec}s × {config.rounds}
                    </Badge>
                  </>
                )}
              </div>
              <Button size="xl" className="w-full" onClick={() => void runner.start()}>
                <Play className="fill-current" />
                Start drill
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate(`/train/${drill.slug}`)}>
                Adjust settings
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
              {/* Skip and End are icon-only so Pause keeps the width it deserves
                  and the row still fits a 375px phone. */}
              <Button
                variant="outline"
                size="lg"
                className="size-14 shrink-0 px-0"
                onClick={runner.skipBlock}
                disabled={saving}
                title="Skip to the next block"
              >
                <ChevronsRight />
                <span className="sr-only">Skip to the next block</span>
              </Button>
              <Button
                size="lg"
                className="min-w-0 flex-1"
                onClick={runner.togglePause}
                disabled={saving}
              >
                {state.status === 'paused' ? (
                  <Play className="fill-current" />
                ) : (
                  <Pause className="fill-current" />
                )}
                {state.status === 'paused' ? 'Resume' : 'Pause'}
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="size-14 shrink-0 px-0"
                onClick={() => setQuitOpen(true)}
                disabled={saving}
                title="End session"
              >
                <Power />
                <span className="sr-only">End session</span>
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {saving && (
          <p className={`mt-3 text-center text-sm ${PHASE_TEXT[phase]}`}>Saving your session…</p>
        )}
      </footer>

      <Dialog open={quitOpen} onOpenChange={setQuitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End this session?</DialogTitle>
            <DialogDescription>
              What you have done so far still counts — {state.roundsCompleted}{' '}
              {state.roundsCompleted === 1 ? 'round' : 'rounds'} and {state.callsAnswered} calls
              will be logged.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setQuitOpen(false)}>
              Keep going
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setQuitOpen(false)
                if (state.status === 'idle') navigate(-1)
                else runner.stop()
              }}
            >
              End and save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/**
 * Hooks cannot be called conditionally, so the runner always gets a plan.
 * This one is never actually run — `config` is resolved before the UI renders.
 */
const FALLBACK_PLAN = planFromConfig(
  {
    layout: 6,
    enabledCorners: cornerIdsForLayout(6),
    mode: 'random',
    weights: {},
    intervalMs: 1400,
    workSec: 30,
    restSec: 30,
    rounds: 1,
    warmupSec: 0,
    cooldownSec: 0,
    prepareSec: 5,
    sprint: null,
    avoidImmediateRepeat: true,
    deceptionProbability: 0.35,
    deceptionGapMs: 600,
    circuit: null,
    circuitRounds: 1,
    patterns: [],
    strokes: null,
  },
  { splitStepLeadMs: 0, seed: 1 },
)
