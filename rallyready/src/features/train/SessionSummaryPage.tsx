import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useEffect, useMemo } from 'react'
import { CheckCircle2, Flame, RotateCcw, Timer, Target, Trophy } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'

import { BadgeUnlock } from '@/components/rewards/BadgeUnlock'
import { Confetti } from '@/components/rewards/Confetti'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useRewards } from '@/hooks/useRewards'
import { pageVariants, rewardVariants, useInitialSafe, useMotionSafe } from '@/lib/motion'
import { useRepositories } from '@/lib/data/context'
import { METRIC_RPE } from '@/lib/data/load'
import {
  METRIC_INTERVAL_MS,
  METRIC_REST_SEC,
  METRIC_ROUNDS,
  levelFromIndex,
  METRIC_LEVEL,
  METRIC_SEED,
  METRIC_WORK_SEC,
} from '@/lib/data/stats'
import { formatDuration, pluralize } from '@/lib/utils'

import { useTrainingData } from '../progress/useTrainingData'
import { ChallengeButton } from '../social/ChallengeButton'
import { ChallengeResult } from '../social/ChallengeResult'
import { ProgramDayPrompt } from '../programs/components/ProgramDayPrompt'
import { RpePrompt } from './components/RpePrompt'
import { ShareSessionButton } from './components/ShareSessionButton'

export function SessionSummaryPage() {
  const { id = '' } = useParams()
  const repositories = useRepositories()
  const variants = useMotionSafe(pageVariants)
  const reward = useMotionSafe(rewardVariants)
  const initial = useInitialSafe('hidden')
  const queryClient = useQueryClient()

  // The session that just finished invalidates every derived figure — streak,
  // weekly load, personal bests, badges.
  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: ['sessions'] })
    void queryClient.invalidateQueries({ queryKey: ['metrics'] })
    void queryClient.invalidateQueries({ queryKey: ['streak'] })
    void queryClient.invalidateQueries({ queryKey: ['badges'] })
  }, [id, queryClient])

  const { data: session, isLoading } = useQuery({
    queryKey: ['session', id],
    queryFn: () => repositories.sessions.getById(id),
  })

  const { data: metrics = [] } = useQuery({
    queryKey: ['session-metrics', id],
    queryFn: () => repositories.sessions.listMetrics(id),
    enabled: Boolean(session),
  })

  /*
   * The same derivation the Progress screen runs, for two reasons: it is where
   * the badge reconciliation lives, so finishing a session now awards what it
   * earned instead of waiting for somebody to open the dashboard; and the
   * reward moments below need the earned list and the streak to agree with
   * each other. Every query behind it is shared and cached.
   */
  const training = useTrainingData()
  const streak = training.loading ? undefined : training.streak
  const earnedSlugs = useMemo(
    () => training.badges.filter((badge) => badge.earned).map((badge) => badge.slug),
    [training.badges],
  )
  const rewards = useRewards(earnedSlugs, streak?.currentStreak, !training.loading)

  // `drillId` is a slug locally and a uuid once signed in, so resolve the drill
  // rather than assuming the stored id can be routed to.
  const { data: drill } = useQuery({
    queryKey: ['drill-by-id', session?.drillId],
    queryFn: () => repositories.drills.getById(session?.drillId ?? ''),
    enabled: Boolean(session?.drillId),
  })

  if (isLoading) return <p className="text-muted-foreground text-sm">Loading session…</p>

  if (!session) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Session not found</h1>
        <Button asChild>
          <Link to="/">Back to Train</Link>
        </Button>
      </div>
    )
  }

  const calls = metrics.find((metric) => metric.metricKey === 'calls_answered')?.metricValue ?? 0
  const finished = metrics.find((metric) => metric.metricKey === 'completed')?.metricValue === 1
  const rpe = metrics.find((metric) => metric.metricKey === METRIC_RPE)?.metricValue ?? null
  const extendedStreak = rewards.streakWeeks !== null

  // Everything needed to hand this exact session to somebody else. Absent on
  // sessions logged before challenges existed, which is why it is optional.
  const metric = (key: string) => metrics.find((entry) => entry.metricKey === key)?.metricValue
  const seed = metric(METRIC_SEED)
  const replayable =
    seed !== undefined && drill
      ? {
          drill: drill.slug,
          seed,
          rounds: metric(METRIC_ROUNDS) ?? session.roundsCompleted,
          workSec: metric(METRIC_WORK_SEC) ?? 30,
          restSec: metric(METRIC_REST_SEC) ?? 30,
          intervalMs: metric(METRIC_INTERVAL_MS) ?? 1400,
          target: calls,
          from: null,
          // Read back from the session rather than from the profile: the level
          // that shaped those calls is the one that has to travel with them,
          // and it may not be the level you are on today.
          level: levelFromIndex(metric(METRIC_LEVEL)),
        }
      : null

  return (
    <motion.div variants={variants} initial={initial} animate="visible">
      <div className="mb-8 text-center">
        {/* The burst is anchored to the trophy rather than to the whole header
            block, so it comes off the thing you just earned. */}
        <div className="relative mx-auto mb-4 size-16">
          {/* Only for a session actually finished. Bailing out at round two is
              a perfectly good decision, and it does not want a fanfare. */}
          {finished && <Confetti />}
          <motion.div
            variants={reward}
            initial={initial}
            animate="visible"
            className="bg-accent text-accent-foreground relative grid size-16 place-items-center rounded-2xl"
          >
            {finished ? (
              <Trophy className="size-8" aria-hidden />
            ) : (
              <CheckCircle2 className="size-8" aria-hidden />
            )}
          </motion.div>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">
          {finished ? 'Session complete' : 'Session logged'}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {session.drillName ?? 'Custom drill'} ·{' '}
          {new Date(session.startedAt).toLocaleString(undefined, {
            weekday: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>

      {/* A circuit answers no corner calls, so "Calls: 0" and a blank average
          would be noise. Show only the figures that mean something. */}
      <div
        className={`mb-5 grid gap-3 ${calls > 0 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2'}`}
      >
        <Stat
          icon={<Timer className="size-4" />}
          label="Time"
          value={formatDuration(session.durationSec)}
        />
        <Stat
          icon={<RotateCcw className="size-4" />}
          label={calls > 0 ? 'Rounds' : 'Exercises'}
          value={String(session.roundsCompleted)}
        />
        {calls > 0 && (
          <>
            <Stat icon={<Target className="size-4" />} label="Calls" value={String(calls)} />
            <Stat
              icon={<Timer className="size-4" />}
              label="Avg interval"
              value={
                session.avgShotIntervalMs
                  ? `${(session.avgShotIntervalMs / 1000).toFixed(2)}s`
                  : '—'
              }
            />
          </>
        )}
      </div>

      {/* Above everything else the screen offers: the rating is worth almost
          nothing an hour later, and the streak card will still be there. */}
      <RpePrompt sessionId={session.id} durationSec={session.durationSec} initial={rpe} />

      {/* Did you beat the challenge you took? Answered before anything else,
          because it is the only reason this screen was opened. */}
      <ChallengeResult drillSlug={drill?.slug} calls={calls} />

      {replayable && drill && <ChallengeButton challenge={replayable} drillName={drill.name} />}

      <ProgramDayPrompt drillSlug={drill?.slug} />

      {rewards.newBadges.length > 0 && <BadgeUnlock slugs={rewards.newBadges} />}

      {streak && (
        <Card level={extendedStreak ? 'lead' : 'default'} className="relative mb-5">
          {extendedStreak && <Confetti count={14} />}
          <CardContent className="relative flex items-center gap-4 p-5">
            <motion.div
              variants={extendedStreak ? reward : undefined}
              initial={extendedStreak ? initial : false}
              animate="visible"
              className="bg-accent text-accent-foreground grid size-11 shrink-0 place-items-center rounded-xl"
            >
              <Flame className="size-5" aria-hidden />
            </motion.div>
            <div className="min-w-0">
              {extendedStreak && <p className="text-primary type-eyebrow">Streak extended</p>}
              <p className="font-semibold">
                {streak.currentStreak > 0
                  ? `${pluralize(streak.currentStreak, 'week')} in a row`
                  : 'Streak started'}
              </p>
              <p className="text-muted-foreground text-sm">
                {pluralize(streak.weeklySessionsCount, 'session')} this week
                {streak.longestStreak > streak.currentStreak &&
                  ` · best run ${pluralize(streak.longestStreak, 'week')}`}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        {drill && (
          <Button asChild size="lg" className="sm:flex-1">
            <Link to={`/run/${drill.slug}`}>Go again</Link>
          </Button>
        )}
        <ShareSessionButton
          data={{
            drillName: session.drillName ?? 'Solo session',
            durationLabel: formatDuration(session.durationSec),
            rounds: session.roundsCompleted,
            calls,
            paceLabel: session.avgShotIntervalMs
              ? `${(session.avgShotIntervalMs / 1000).toFixed(2)}s`
              : null,
            streakWeeks: streak?.currentStreak ?? 0,
            dateLabel: new Date(session.startedAt).toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            }),
          }}
        />
        <Button asChild variant="outline" size="lg" className="sm:flex-1">
          <Link to="/">Back to Train</Link>
        </Button>
      </div>
    </motion.div>
  )
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
          {icon}
          {label}
        </p>
        <p className="tnum mt-1.5 text-2xl font-bold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  )
}
