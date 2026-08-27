import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Gauge, Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { pageVariants, useInitialSafe, useMotionSafe } from '@/lib/motion'
import { useRepositories } from '@/lib/data/context'
import { BENCHMARK_LEVELS, gradeBenchmark } from '@/lib/timer/benchmark'
import { formatDuration } from '@/lib/utils'

export function BenchmarkResultPage() {
  const { id = '' } = useParams()
  const repositories = useRepositories()
  const variants = useMotionSafe(pageVariants)
  const initial = useInitialSafe('hidden')

  const { data: benchmark, isLoading } = useQuery({
    queryKey: ['benchmark', id],
    queryFn: () => repositories.benchmarks.getById(id),
  })

  const { data: history = [] } = useQuery({
    queryKey: ['benchmarks'],
    queryFn: () => repositories.benchmarks.list(),
  })

  if (isLoading) return <p className="text-muted-foreground text-sm">Loading result…</p>

  if (!benchmark) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Result not found</h1>
        <Button asChild>
          <Link to="/benchmark">Back to the benchmark</Link>
        </Button>
      </div>
    )
  }

  const level = benchmark.levelReached ?? 0
  const grade = gradeBenchmark(level)
  const raw = benchmark.raw as { durationSec?: number; finishedAllLevels?: boolean }

  // The most recent attempt before this one, for the comparison line.
  const previous = history
    .filter((entry) => entry.id !== benchmark.id && entry.takenAt < benchmark.takenAt)
    .sort((a, b) => b.takenAt.localeCompare(a.takenAt))[0]
  const delta = previous ? benchmark.score - previous.score : null

  return (
    <motion.div
      variants={variants}
      initial={initial}
      animate="visible"
      className="mx-auto max-w-lg"
    >
      <div className="mb-7 text-center">
        <div className="bg-accent text-accent-foreground mx-auto mb-4 grid size-16 place-items-center rounded-2xl">
          <Gauge className="size-8" aria-hidden />
        </div>
        <p className="text-muted-foreground type-eyebrow text-xs">Your score</p>
        <p className="tnum text-[clamp(4rem,20vw,7rem)] leading-none font-extrabold tracking-tighter">
          {benchmark.score}
        </p>
        <p className="mt-2 text-lg font-semibold">
          Level {level} of {BENCHMARK_LEVELS} · {grade.label}
        </p>
        <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm leading-relaxed">
          {raw.finishedAllLevels
            ? 'You completed every level. There is nothing left in this test to beat except your own corner count.'
            : grade.description}
        </p>
      </div>

      {delta !== null && (
        <Card className="mb-4">
          <CardContent className="flex items-center gap-3 p-4">
            <div
              className={`grid size-10 shrink-0 place-items-center rounded-xl ${
                delta > 0
                  ? 'bg-work/15 text-work'
                  : delta < 0
                    ? 'bg-rest/15 text-rest'
                    : 'bg-secondary'
              }`}
            >
              {delta > 0 ? (
                <TrendingUp className="size-5" aria-hidden />
              ) : delta < 0 ? (
                <TrendingDown className="size-5" aria-hidden />
              ) : (
                <Minus className="size-5" aria-hidden />
              )}
            </div>
            <div>
              <p className="font-semibold">
                {delta > 0
                  ? `Up ${delta} on your last test`
                  : delta < 0
                    ? `Down ${Math.abs(delta)} on your last test`
                    : 'Exactly level with your last test'}
              </p>
              <p className="text-muted-foreground text-sm">
                Previous: {previous?.score} on{' '}
                {previous && new Date(previous.takenAt).toLocaleDateString()}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs font-medium">Corners covered</p>
            <p className="tnum mt-1 text-2xl font-bold">{benchmark.score}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs font-medium">Time on the test</p>
            <p className="tnum mt-1 text-2xl font-bold">{formatDuration(raw.durationSec ?? 0)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg" className="sm:flex-1">
          <Link to="/progress">See my progress</Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="sm:flex-1">
          <Link to="/benchmark">Benchmark history</Link>
        </Button>
      </div>

      <p className="text-muted-foreground mt-6 text-center text-xs leading-relaxed">
        Retest every four to six weeks. Testing more often mostly measures how fresh you are.
      </p>
    </motion.div>
  )
}
