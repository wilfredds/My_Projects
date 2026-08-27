import { AnimatePresence, motion, type Variants } from 'framer-motion'
import { ArrowLeft, Play, RotateCcw, Timer, Trophy, Zap } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { CountUp } from '@/components/motion/CountUp'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import {
  DURATION,
  EASE,
  SPRING,
  motionSafe,
  swapVariants,
  transition,
  useInitialSafe,
  useMotionSafe,
  valuePopVariants,
} from '@/lib/motion'
import {
  gradeReaction,
  isPersonalBest,
  nextTarget,
  summarise,
  GAME_MS,
  GAP_MS,
  TIMEOUT_MS,
  type ReflexEvent,
  type ReflexSummary,
} from '@/lib/games/reflex'
import { vibrateComplete, vibrateCorner } from '@/lib/audio/haptics'
import { CORNERS, cornersForLayout, type CornerId } from '@/lib/timer/corners'
import { cn } from '@/lib/utils'
import { useCueStore } from '@/store/cueStore'
import { useGameStore } from '@/store/gameStore'

/**
 * Reflex Rush — thirty seconds, tap the corner that lights up.
 *
 * The rest of the app is training, which is work you have to make yourself do.
 * This is the part you open because you want to, and it is the one thing a solo
 * player genuinely cannot train against a wall: reacting to a cue you did not
 * choose. It also happens to be measurable to the millisecond, which a shadow
 * drill never is.
 */

type Phase = 'ready' | 'playing' | 'done'

const LAYOUT = 6

/** The last few seconds, where the bar turns and the clock starts shouting. */
const URGENT_MS = 5000

/*
 * Game-only variants. These live here rather than in `lib/motion` because
 * nothing else in the app should feel like this: a target that snaps out at you
 * and a ring that fires off the corner you hit is exactly the wrong register
 * for a training screen, and exactly the right one for the thing you open
 * because you want to.
 */
const targetVariants: Variants = {
  dark: { scale: 1, transition: transition(DURATION.quick) },
  lit: { scale: 1.14, transition: SPRING.pop },
  tap: { scale: 0.92, transition: transition(DURATION.instant) },
}

const rippleVariants: Variants = {
  start: { scale: 1, opacity: 0.85 },
  end: {
    scale: 2.1,
    opacity: 0,
    transition: { duration: 0.45, ease: [...EASE.out] as [number, number, number, number] },
  },
}

export function ReflexRushPage() {
  const swap = useMotionSafe(swapVariants)
  const pop = useMotionSafe(valuePopVariants)
  const initial = useInitialSafe('hidden')
  // Still needed as a plain boolean: the board components take it as a prop.
  const reducedMotion = useReducedMotion()
  const vibrationEnabled = useCueStore((state) => state.vibrationEnabled)
  const bestScore = useGameStore((state) => state.bestScore)
  const bestReactionMs = useGameStore((state) => state.bestReactionMs)
  const record = useGameStore((state) => state.record)

  const [phase, setPhase] = useState<Phase>('ready')
  const [target, setTarget] = useState<CornerId | null>(null)
  const [remainingMs, setRemainingMs] = useState(GAME_MS)
  const [liveScore, setLiveScore] = useState(0)
  const [summary, setSummary] = useState<ReflexSummary | null>(null)
  const [beatIt, setBeatIt] = useState(false)
  const [flash, setFlash] = useState<{ id: number; corner: CornerId; good: boolean } | null>(null)
  const flashId = useRef(0)

  /*
   * All the timing lives in one ref driven by one animation frame.
   *
   * The first version scheduled the next target with `setTimeout` calling
   * itself, which needed the callback to reference itself before it existed and
   * left a fistful of timers to clean up on every exit. A single loop asking
   * "what should be on screen now?" is both simpler and impossible to leak.
   */
  const clock = useRef({
    endsAt: 0,
    shownAt: 0,
    /** When the next target is due; 0 means one is already showing. */
    nextAt: 0,
    current: null as CornerId | null,
    events: [] as ReflexEvent[],
  })

  const finish = useCallback(() => {
    const result = summarise(clock.current.events)
    clock.current.current = null
    setTarget(null)
    setSummary(result)
    setBeatIt(isPersonalBest(result.score, bestScore))
    record({
      at: Date.now(),
      score: result.score,
      hits: result.hits,
      accuracy: result.accuracy,
      averageMs: result.averageMs,
      bestMs: result.bestMs,
    })
    if (vibrationEnabled) vibrateComplete()
    setPhase('done')
  }, [bestScore, record, vibrationEnabled])

  const start = () => {
    const now = performance.now()
    clock.current = { endsAt: now + GAME_MS, shownAt: 0, nextAt: now, current: null, events: [] }
    setSummary(null)
    setBeatIt(false)
    setFlash(null)
    setLiveScore(0)
    setTarget(null)
    setRemainingMs(GAME_MS)
    setPhase('playing')
  }

  useEffect(() => {
    if (phase !== 'playing') return
    let frame = 0

    const tick = () => {
      const now = performance.now()
      const state = clock.current

      if (now >= state.endsAt) {
        finish()
        return
      }
      setRemainingMs(state.endsAt - now)

      if (state.current === null) {
        // Between targets: put the next one up when the gap has elapsed.
        if (now >= state.nextAt) {
          const corner = nextTarget(LAYOUT, state.current, Math.random)
          state.current = corner
          state.shownAt = now
          setTarget(corner)
        }
      } else if (now - state.shownAt >= TIMEOUT_MS) {
        // Left too long — it moves on without you, and that counts against you.
        state.events.push({ kind: 'timeout', corner: state.current })
        state.current = null
        state.nextAt = now + GAP_MS
        setTarget(null)
      }

      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [phase, finish])

  /*
   * Leaving mid-game abandons it rather than scoring it.
   *
   * The loop runs on `requestAnimationFrame`, which stops in a hidden tab
   * while the clock does not, so a game backgrounded for a notification would
   * come back over and resolve to whatever had been tapped before you left.
   * Recording a score of two as an attempt is not a result; it is a
   * misunderstanding of what happened.
   */
  useEffect(() => {
    if (phase !== 'playing') return
    const onVisibility = () => {
      if (document.visibilityState !== 'hidden') return
      clock.current.current = null
      setTarget(null)
      setFlash(null)
      setLiveScore(0)
      setRemainingMs(GAME_MS)
      setPhase('ready')
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [phase])

  const tap = (corner: CornerId) => {
    if (phase !== 'playing') return
    const state = clock.current
    const now = performance.now()

    if (corner !== state.current) {
      state.events.push({ kind: 'wrong', corner })
      setLiveScore(summarise(state.events).score)
      flashId.current += 1
      setFlash({ id: flashId.current, corner, good: false })
      window.setTimeout(() => setFlash(null), 460)
      return
    }

    state.events.push({ kind: 'hit', corner, reactionMs: now - state.shownAt })
    state.current = null
    state.nextAt = now + GAP_MS
    setTarget(null)
    setLiveScore(summarise(state.events).score)
    if (vibrationEnabled) vibrateCorner(CORNERS[corner].row)
    flashId.current += 1
    setFlash({ id: flashId.current, corner, good: true })
    window.setTimeout(() => setFlash(null), 460)
  }

  const seconds = Math.ceil(remainingMs / 1000)
  const urgent = phase === 'playing' && remainingMs <= URGENT_MS

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
        <Link to="/">
          <ArrowLeft />
          Train
        </Link>
      </Button>

      <div className="mb-5 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight">Reflex Rush</h1>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            Thirty seconds. Tap the corner the moment it lights up.
          </p>
        </div>
        {phase === 'playing' && (
          <div className="shrink-0 text-right">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.p
                key={seconds}
                variants={pop}
                initial="hidden"
                animate="visible"
                exit="exit"
                className={cn(
                  'tnum text-3xl leading-none font-bold tabular-nums transition-colors',
                  urgent && 'text-destructive',
                )}
              >
                {seconds}
              </motion.p>
            </AnimatePresence>
            <p className="text-muted-foreground text-xs font-medium">seconds</p>
          </div>
        )}
      </div>

      {phase === 'playing' && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-muted-foreground flex items-baseline gap-1.5 text-sm">
            Score
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={liveScore}
                variants={pop}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="tnum text-foreground font-bold"
              >
                {liveScore}
              </motion.span>
            </AnimatePresence>
          </p>
          <div className="bg-secondary h-1.5 flex-1 overflow-hidden rounded-full">
            {/*
             * Scaled, not resized. This runs off the game's animation frame, so
             * a `width` here would put a layout pass between every frame and
             * the taps it is timing.
             */}
            <div
              className={cn(
                'h-full origin-left rounded-full transition-colors',
                urgent ? 'bg-destructive' : 'bg-primary',
              )}
              style={{ transform: `scaleX(${Math.max(0, remainingMs / GAME_MS)})` }}
            />
          </div>
        </div>
      )}

      <Board
        target={phase === 'playing' ? target : null}
        flash={flash}
        disabled={phase !== 'playing'}
        onTap={tap}
        reducedMotion={reducedMotion}
      />

      <AnimatePresence mode="wait" initial={false}>
        {phase === 'ready' && (
          <motion.div
            key="ready"
            variants={swap}
            initial={initial}
            animate="visible"
            exit="exit"
            className="mt-5"
          >
            <Button size="xl" className="w-full" onClick={start}>
              <Play className="fill-current" />
              Start
            </Button>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Stat
                icon={<Trophy className="size-4" />}
                label="Best score"
                value={bestScore > 0 ? String(bestScore) : '—'}
              />
              <Stat
                icon={<Zap className="size-4" />}
                label="Fastest read"
                value={bestReactionMs === null ? '—' : `${Math.round(bestReactionMs)}ms`}
              />
            </div>
            <p className="text-muted-foreground mt-4 text-xs leading-relaxed">
              Rest your eyes on the middle of the court rather than hunting the target — that is how
              you read a smash too. Wrong taps cost you; missed targets just move on.
            </p>
          </motion.div>
        )}

        {phase === 'done' && summary && (
          <motion.div
            key="done"
            variants={swap}
            initial={initial}
            animate="visible"
            className="mt-5"
          >
            <Card level={beatIt ? 'lead' : 'default'} className="mb-4">
              <CardContent className="p-5 text-center">
                {beatIt && <p className="text-primary type-eyebrow mb-1">New personal best</p>}
                <p className="tnum text-5xl leading-none font-bold tracking-tight">
                  <CountUp value={summary.score} />
                </p>
                <p className="text-muted-foreground mt-2 text-sm">
                  {gradeReaction(summary.averageMs).label} ·{' '}
                  {summary.averageMs === null ? '—' : `${summary.averageMs}ms average`}
                </p>
                <p className="text-muted-foreground mx-auto mt-2 max-w-xs text-xs leading-relaxed">
                  {gradeReaction(summary.averageMs).blurb}
                </p>
              </CardContent>
            </Card>

            <div className="mb-4 grid grid-cols-3 gap-3">
              <Stat icon={<Zap className="size-4" />} label="Hits" value={String(summary.hits)} />
              <Stat
                icon={<Timer className="size-4" />}
                label="Fastest"
                value={summary.bestMs === null ? '—' : `${Math.round(summary.bestMs)}ms`}
              />
              <Stat
                icon={<Trophy className="size-4" />}
                label="Accuracy"
                value={`${Math.round(summary.accuracy * 100)}%`}
              />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button size="lg" className="sm:flex-1" onClick={start}>
                <RotateCcw />
                Go again
              </Button>
              <Button asChild variant="outline" size="lg" className="sm:flex-1">
                <Link to="/">Back to Train</Link>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-3.5">
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
          {icon}
          {label}
        </p>
        <p className="tnum mt-1 text-xl font-bold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  )
}

interface BoardProps {
  target: CornerId | null
  flash: { id: number; corner: CornerId; good: boolean } | null
  disabled: boolean
  onTap: (corner: CornerId) => void
  reducedMotion: boolean
}

/**
 * The court, with every corner a button.
 *
 * Built here rather than reusing the runner's board: that one is a display and
 * this one needs hit targets big enough to hit at speed with a thumb. The
 * targets are deliberately oversized — a game that measures reaction time must
 * not accidentally be measuring aim.
 */
/** Maps a 0–1 court coordinate into the band that keeps a target on screen. */
const inset = (value: number, margin: number) => margin + value * (100 - margin * 2)

function Board({ target, flash, disabled, onTap, reducedMotion }: BoardProps) {
  // Stripped here rather than with the hook: this component is already handed
  // the reduced-motion state by its parent.
  const targetMotion = motionSafe(targetVariants, reducedMotion)
  const rippleMotion = motionSafe(rippleVariants, reducedMotion)

  return (
    <div className="bg-court-surface border-border relative mx-auto aspect-[3/4] w-full max-w-sm overflow-hidden rounded-2xl border">
      {/* Court markings, purely decorative. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="border-court-line absolute inset-x-3 inset-y-3 border" />
        <div className="bg-court-line absolute inset-x-3 top-1/2 h-0.5" />
        <div className="bg-court-line/60 absolute inset-y-3 left-1/2 w-px" />
      </div>

      {cornersForLayout(LAYOUT).map((corner) => {
        const lit = target === corner.id
        const flashing = flash?.corner === corner.id
        return (
          <button
            key={corner.id}
            type="button"
            disabled={disabled}
            onPointerDown={() => onTap(corner.id)}
            aria-label={corner.description}
            aria-pressed={lit}
            className={cn(
              // `w-` plus `aspect-square`, not `size-`: the board is 3:4, so a
              // percentage height and a percentage width are different lengths
              // and the targets came out as eggs.
              'absolute aspect-square w-[27%] -translate-x-1/2 -translate-y-1/2 rounded-full text-center',
              'focus-visible:ring-ring focus-visible:rounded-full focus-visible:ring-2 focus-visible:outline-none',
              disabled && 'opacity-60',
            )}
            // Court coordinates run right to the sidelines, and a target
            // centred on one is half off the board. Squeezed inwards so a whole
            // circle always fits — the relative layout is what matters here,
            // not court-accurate placement.
            style={{ left: `${inset(corner.x, 16)}%`, top: `${inset(corner.y, 15)}%` }}
          >
            {/*
             * The circle is a child rather than the button itself: the button
             * carries the `-translate-*` that centres it on its coordinate, and
             * framer writes `transform` wholesale, so animating the button
             * would knock it half a target off its own corner.
             */}
            <motion.span
              variants={targetMotion}
              animate={lit ? 'lit' : 'dark'}
              whileTap="tap"
              className={cn(
                'absolute inset-0 grid place-items-center rounded-full border-2 transition-colors',
                lit
                  ? 'bg-primary border-primary text-primary-foreground'
                  : 'border-court-line bg-card/70 text-muted-foreground',
                flashing && !flash?.good && 'border-destructive bg-destructive/20',
              )}
            >
              <span className="text-[0.6rem] leading-tight font-bold tracking-wide">
                {corner.label[0]}
                <br />
                {corner.label[1]}
              </span>
            </motion.span>

            {/* A ring fired off the corner you just touched. Keyed on a
                counter, so hitting the same corner twice replays it. */}
            <AnimatePresence>
              {flashing && flash && (
                <motion.span
                  key={flash.id}
                  variants={rippleMotion}
                  initial="start"
                  animate="end"
                  exit="end"
                  className={cn(
                    'pointer-events-none absolute inset-0 rounded-full border-2',
                    flash.good ? 'border-primary' : 'border-destructive',
                  )}
                  aria-hidden
                />
              )}
            </AnimatePresence>
          </button>
        )
      })}
    </div>
  )
}
