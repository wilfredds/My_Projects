import {
  Award,
  Flame,
  Gauge,
  LineChart as LineChartIcon,
  Timer,
  TrendingUp,
  Trophy,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { CountUp } from '@/components/motion/CountUp'
import { StaggerItem } from '@/components/motion/StaggerItem'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { gradeBenchmark } from '@/lib/timer/benchmark'
import { formatDuration, pluralize } from '@/lib/utils'

import { AXIS_TICK, CHART, TOOLTIP_STYLE } from './chartTheme'
import { LoadStatusStrip } from './components/LoadStatusStrip'
import { RatingCard } from './components/RatingCard'
import { ReadinessTrend } from './components/ReadinessTrend'
import { StreakCalendar } from './components/StreakCalendar'
import { TrophyCase } from './components/TrophyCase'
import { useTrainingData } from './useTrainingData'

export function ProgressPage() {
  const { loading, stats, load, rating, readiness, streak, benchmarks, badges, earnedCount } =
    useTrainingData()
  // Recharts animates by default; under reduced motion the chart must simply
  // be there, drawn, on the first frame.
  const reducedMotion = useReducedMotion()

  const hasHistory = stats.sessionCount > 0
  const latestBenchmark = benchmarks[0]

  const paceSeries = stats.intervalTrend.map((point, index) => ({
    index: index + 1,
    date: new Date(point.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
    seconds: Number((point.intervalMs / 1000).toFixed(2)),
  }))

  return (
    <>
      <PageHeader
        title="Progress"
        description="All of this comes from sessions you actually finished. Nothing is typed in by hand."
      />

      {/* The dashboard's own shape, so nothing below it moves when the
          numbers arrive. */}
      {loading && (
        <div className="space-y-5">
          <Skeleton className="h-28 w-full rounded-xl" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-[5.5rem] rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-52 w-full rounded-xl" />
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      )}

      {/* An empty dashboard should still show what it is going to measure —
            otherwise the screen is one card floating above nothing, and the
            player has no idea what logging a session actually buys them. */}
      {!loading && !hasHistory && (
        <div className="space-y-5">
          <EmptyState
            illustration="chart"
            title="Nothing logged yet"
            body="Finish one drill and this page starts working. Nothing here is entered by hand — it is all derived from sessions you actually did."
            action={
              <Button asChild size="lg">
                <Link to="/">Start your first drill</Link>
              </Button>
            }
          />

          <div>
            <h2 className="text-muted-foreground mb-3 text-sm font-semibold tracking-wide uppercase">
              What you will see here
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {[
                {
                  icon: <Flame className="size-4" aria-hidden />,
                  title: 'A weekly streak',
                  body: 'Counted in weeks, not days — missing a Tuesday should not wipe out two months.',
                },
                {
                  icon: <Timer className="size-4" aria-hidden />,
                  title: 'Training load',
                  body: 'How hard you trained, not just how long. It warns you when you speed up too fast.',
                },
                {
                  icon: <TrendingUp className="size-4" aria-hidden />,
                  title: 'Whether you are getting faster',
                  body: 'Average seconds between calls, per session, charted so improvement reads as up.',
                },
                {
                  icon: <Trophy className="size-4" aria-hidden />,
                  title: 'Personal bests and badges',
                  body: 'Per drill, and a trophy case that fills in as you go.',
                },
              ].map((item, index) => (
                <StaggerItem key={item.title} index={index}>
                  <Card className="h-full">
                    <CardContent className="flex h-full gap-3 p-4">
                      <span className="bg-secondary text-muted-foreground grid size-9 shrink-0 place-items-center rounded-lg">
                        {item.icon}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{item.title}</p>
                        <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                          {item.body}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </StaggerItem>
              ))}
            </ul>
          </div>

          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="bg-accent text-accent-foreground grid size-11 shrink-0 place-items-center rounded-xl">
                <Gauge className="size-5" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Or start with a number</p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  The fitness benchmark gives you a score to improve on from day one.
                </p>
              </div>
              <Button asChild size="sm" variant="outline" className="shrink-0">
                <Link to="/benchmark">Take it</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {!loading && hasHistory && (
        <div className="space-y-5">
          <RatingCard rating={rating} />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat
              icon={<Flame className="size-4" />}
              label="Week streak"
              value={<CountUp value={streak.currentStreak} />}
              hint={`best ${streak.longestStreak}`}
            />
            <Stat
              icon={<Timer className="size-4" />}
              label="This week"
              value={<CountUp value={streak.weeklySessionsCount} />}
              hint={streak.weeklySessionsCount === 1 ? 'session' : 'sessions'}
            />
            <Stat
              icon={<LineChartIcon className="size-4" />}
              label="Total time"
              value={
                <CountUp
                  value={stats.totalTrainingSec}
                  format={(seconds) => formatDuration(Math.round(seconds))}
                />
              }
              hint={pluralize(stats.sessionCount, 'session')}
            />
            <Stat
              icon={<Trophy className="size-4" />}
              label="Badges"
              value={
                <>
                  <CountUp value={earnedCount} />/{badges.length}
                </>
              }
              hint="unlocked"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Last 12 weeks</CardTitle>
              <CardDescription>
                One session is enough to make a week count. Rest days do not break it.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StreakCalendar weeks={stats.weekly} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Training load</CardTitle>
              <CardDescription>
                How hard you trained each week, not just how long. Ten hard minutes cost you more
                than thirty easy ones.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <LoadStatusStrip load={load} />

              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.weekly} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
                    <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={AXIS_TICK}
                      tickLine={false}
                      axisLine={false}
                      interval={2}
                    />
                    {/* Wide enough for a four-figure load. Sized for two-digit
                        minutes, the axis silently ate the leading digits. */}
                    <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={48} />
                    <Tooltip {...TOOLTIP_STYLE} />
                    <Bar
                      dataKey="load"
                      name="Load"
                      fill={CHART.primary}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={28}
                      isAnimationActive={!reducedMotion}
                      animationDuration={520}
                      animationEasing="ease-out"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {load.unrated > 0 && (
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {load.unrated === load.sessions
                    ? 'None of your recent sessions have been rated, so these bars assume a moderate effort throughout.'
                    : `${pluralize(load.unrated, 'recent session')} went unrated and ${load.unrated === 1 ? 'was' : 'were'} counted as moderate.`}{' '}
                  Rating one takes a single tap on the summary screen right after you finish.
                </p>
              )}
            </CardContent>
          </Card>

          {readiness.length >= 3 && <ReadinessTrend checks={readiness} />}

          {paceSeries.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pace</CardTitle>
                <CardDescription>
                  Average seconds between calls, per session. The axis is inverted so a rising line
                  means a faster caller — improvement always reads as up.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={paceSeries}
                      margin={{ top: 4, right: 8, bottom: 0, left: -10 }}
                    >
                      <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" tick={AXIS_TICK} tickLine={false} axisLine={false} />
                      <YAxis
                        tick={AXIS_TICK}
                        tickLine={false}
                        axisLine={false}
                        width={58}
                        domain={['auto', 'auto']}
                        // Two decimals: sessions often sit within 0.1s of each
                        // other, and one decimal collapses them to the same tick.
                        tickFormatter={(value: number) => `${value.toFixed(2)}s`}
                        // Faster is better, so improvement should read as up.
                        reversed
                      />
                      <Tooltip {...TOOLTIP_STYLE} />
                      {/* Draws itself left to right, the direction the data
                          runs, so the shape arrives as a story rather than as
                          a finished picture. */}
                      <Line
                        type="monotone"
                        dataKey="seconds"
                        name="Seconds per call"
                        stroke={CHART.rest}
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: CHART.rest, strokeWidth: 0 }}
                        isAnimationActive={!reducedMotion}
                        animationDuration={620}
                        animationEasing="ease-out"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Fitness benchmark</CardTitle>
                <CardDescription>
                  {latestBenchmark
                    ? `Level ${latestBenchmark.levelReached ?? 0} · ${gradeBenchmark(latestBenchmark.levelReached ?? 0).label}`
                    : 'A repeatable number to chase.'}
                </CardDescription>
              </div>
              {latestBenchmark && (
                <span className="tnum shrink-0 text-3xl font-bold">{latestBenchmark.score}</span>
              )}
            </CardHeader>
            <CardContent>
              <Button asChild variant={latestBenchmark ? 'outline' : 'default'} className="w-full">
                <Link to="/benchmark">
                  <Gauge />
                  {latestBenchmark ? 'View history and retest' : 'Take the benchmark'}
                </Link>
              </Button>
            </CardContent>
          </Card>

          {stats.perDrill.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Personal bests</CardTitle>
                <CardDescription>Your best figures for each drill.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="divide-border divide-y">
                  {stats.perDrill.map((drill) => (
                    <li key={drill.drillId} className="py-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="truncate text-sm font-medium">{drill.drillName}</p>
                        <span className="text-muted-foreground shrink-0 text-xs">
                          {pluralize(drill.sessions, 'session')}
                        </span>
                      </div>
                      <div className="text-muted-foreground mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                        <span className="tnum">
                          Best <strong className="text-foreground">{drill.bestCalls}</strong> calls
                        </span>
                        {drill.bestIntervalMs && (
                          <span className="tnum">
                            Fastest{' '}
                            <strong className="text-foreground">
                              {(drill.bestIntervalMs / 1000).toFixed(2)}s
                            </strong>{' '}
                            per call
                          </span>
                        )}
                        <span className="tnum">{formatDuration(drill.totalSec)} total</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Award className="text-primary size-4" aria-hidden />
                Trophy case
              </CardTitle>
              <CardDescription>
                <Badge variant="outline">
                  {earnedCount} of {badges.length} unlocked
                </Badge>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TrophyCase badges={badges} />
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}

function Stat({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
  hint?: string
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
          {icon}
          {label}
        </p>
        <p className="tnum mt-1.5 text-2xl font-bold tracking-tight">{value}</p>
        {hint && <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p>}
      </CardContent>
    </Card>
  )
}
