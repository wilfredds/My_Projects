import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Gauge, Play, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useRepositories } from '@/lib/data/context'
import { BENCHMARK_LEVELS, benchmarkDurationSec, gradeBenchmark } from '@/lib/timer/benchmark'
import { cn, formatDuration } from '@/lib/utils'

import { AXIS_TICK, CHART, TOOLTIP_STYLE } from '../progress/chartTheme'

export function BenchmarkPage() {
  const repositories = useRepositories()

  const { data: benchmarks = [], isLoading } = useQuery({
    queryKey: ['benchmarks'],
    queryFn: () => repositories.benchmarks.list(),
  })

  const latest = benchmarks[0]
  const best = benchmarks.reduce<number>((max, entry) => Math.max(max, entry.score), 0)

  // Oldest first for the chart; the repository returns newest first.
  const series = [...benchmarks].reverse().map((entry) => ({
    date: new Date(entry.takenAt).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
    }),
    score: entry.score,
    level: entry.levelReached ?? 0,
  }))

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-3 mb-3">
        <Link to="/progress">
          <ArrowLeft />
          Progress
        </Link>
      </Button>

      <h1 className="text-3xl font-bold tracking-tight">Fitness benchmark</h1>
      <p className="text-muted-foreground mt-2 max-w-prose text-sm leading-relaxed">
        A fitness test you can repeat and compare. You move between four corners in twelve levels.
        Each level is a little longer than the last, and the rest stays at ten seconds. Stop when
        you cannot keep up. How far you got is your score.
      </p>

      {/*
       * One attempt is one number. Showing "Latest 42" beside "Personal best
       * 42 across 1 attempt" is the same fact twice, dressed as two, and it
       * only starts meaning something on the second attempt.
       */}
      {latest && (
        <div className={cn('mt-6 grid gap-3', benchmarks.length > 1 && 'grid-cols-2')}>
          <Card>
            <CardContent className="p-4">
              <p className="text-muted-foreground text-xs font-medium">
                {benchmarks.length > 1 ? 'Latest score' : 'Your score'}
              </p>
              <p className="tnum mt-1 text-3xl font-bold tracking-tight">{latest.score}</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Level {latest.levelReached ?? 0} · {gradeBenchmark(latest.levelReached ?? 0).label}
              </p>
            </CardContent>
          </Card>
          {benchmarks.length > 1 && (
            <Card>
              <CardContent className="p-4">
                <p className="text-muted-foreground text-xs font-medium">Personal best</p>
                <p className="tnum mt-1 text-3xl font-bold tracking-tight">{best}</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  across {benchmarks.length} attempts
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {series.length > 1 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="text-primary size-4" aria-hidden />
              Score over time
            </CardTitle>
            <CardDescription>Corner touches completed. Higher is fitter.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                  <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={AXIS_TICK} tickLine={false} axisLine={false} />
                  <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={44} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke={CHART.primary}
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: CHART.primary, strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                    name="Score"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card level="lead" className="mt-4">
        <CardContent className="space-y-4 p-5">
          <div className="flex items-start gap-3">
            <div className="bg-background/70 grid size-11 shrink-0 place-items-center rounded-xl">
              <Gauge className="text-primary size-5" aria-hidden />
            </div>
            <div>
              <p className="font-semibold">{latest ? 'Test again' : 'Take your first benchmark'}</p>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                Warm up properly first — the test assumes you are ready to move. Expect it to take
                up to {formatDuration(benchmarkDurationSec())}.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{BENCHMARK_LEVELS} levels</Badge>
            <Badge variant="outline">4 corners</Badge>
            <Badge variant="outline">18s → 30s work</Badge>
            <Badge variant="outline">10s recovery</Badge>
          </div>
          <Button asChild size="xl" className="w-full">
            <Link to="/benchmark/run">
              <Play className="fill-current" />
              {latest ? 'Retest' : 'Start the test'}
            </Link>
          </Button>
        </CardContent>
      </Card>

      {!isLoading && benchmarks.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">History</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-border divide-y">
              {benchmarks.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <Link
                      to={`/benchmark/result/${entry.id}`}
                      className="text-sm font-medium hover:underline"
                    >
                      Level {entry.levelReached ?? 0} ·{' '}
                      {gradeBenchmark(entry.levelReached ?? 0).label}
                    </Link>
                    <p className="text-muted-foreground text-xs">
                      {new Date(entry.takenAt).toLocaleDateString(undefined, {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <span className="tnum shrink-0 text-lg font-bold">{entry.score}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  )
}
