import { useQuery } from '@tanstack/react-query'
import { Dumbbell, Home, VolumeX } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useRepositories } from '@/lib/data/context'
import { isConditioning, isPrepOrRecovery } from '@/lib/data/seed/drills'
import type { Drill } from '@/lib/data/types'
import { useTodayAdjustment } from '@/hooks/useTodayAdjustment'
import { useTrainingProfile } from '@/hooks/useTrainingProfile'
import { configForToday } from '@/lib/data/readiness'
import { configFromDrill, estimateDurationSec } from '@/lib/timer/plan'
import { factsFor, groupWorkouts, SPACE_LABEL } from '@/lib/training/workouts'
import { cn, formatCompactDuration, pluralize } from '@/lib/utils'
import { useDrillConfigStore } from '@/store/drillConfigStore'

/**
 * Every workout in one place, sorted by what a home player needs to know.
 *
 * The catalogue was reachable only as a tab beside the court drills, listed by
 * name and duration — which answers the wrong question first. Somebody in a
 * bedroom at eleven at night needs to know whether a session fits the floor
 * they have and whether it will wake the house, and only then how long it is.
 * So those two facts lead every card, and both are filters.
 */
export function WorkoutsPage() {
  const repositories = useRepositories()
  const training = useTrainingProfile()
  const adjustment = useTodayAdjustment()
  const overrides = useDrillConfigStore((state) => state.overrides)
  const [smallSpace, setSmallSpace] = useState(false)
  const [quietOnly, setQuietOnly] = useState(false)

  const { data: drills = [], isLoading } = useQuery({
    queryKey: ['drills'],
    queryFn: () => repositories.drills.list(),
  })

  const workouts = drills.filter((drill) => isConditioning(drill) || isPrepOrRecovery(drill))
  const groups = groupWorkouts(workouts, { smallSpace, quietOnly })
  const hidden = workouts.length - groups.reduce((sum, entry) => sum + entry.drills.length, 0)

  const minutesFor = (drill: Drill) =>
    estimateDurationSec(
      configForToday(overrides[drill.slug] ?? configFromDrill(drill, training), drill, adjustment),
    )

  return (
    <>
      <PageHeader
        title="Workouts"
        description="Everything off the court, in one place. Most of it needs nothing but you and the floor."
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <FilterChip active={smallSpace} onClick={() => setSmallSpace(!smallSpace)} icon={Home}>
          Fits a small room
        </FilterChip>
        <FilterChip active={quietOnly} onClick={() => setQuietOnly(!quietOnly)} icon={VolumeX}>
          Quiet
        </FilterChip>
      </div>

      {isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}

      {!isLoading && groups.length === 0 && (
        <Card>
          <CardContent className="p-5">
            <p className="text-sm font-medium">Nothing matches both filters.</p>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              Turn one off — there is always something you can do in a small room, and always
              something you can do quietly, but not always both at once.
            </p>
          </CardContent>
        </Card>
      )}

      {groups.map(({ group, drills: inGroup }) => (
        <section key={group.id} className="mb-8">
          <h2 className="text-base font-semibold">{group.title}</h2>
          <p className="text-muted-foreground mt-0.5 mb-3 text-sm leading-relaxed">{group.blurb}</p>
          <ul className="space-y-2">
            {inGroup.map((drill) => (
              <li key={drill.slug}>
                <WorkoutCard drill={drill} minutes={minutesFor(drill)} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      {hidden > 0 && (
        <p className="text-muted-foreground mb-6 text-xs">
          {pluralize(hidden, 'workout')} hidden by the filters above.
        </p>
      )}
    </>
  )
}

function FilterChip({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: typeof Home
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        // 40px tall rather than the 34 this used to be: these two chips are the
        // whole point of the screen, and they get tapped by somebody halfway
        // through a workout with a shaking hand.
        'focus-visible:ring-ring inline-flex min-h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none',
        active
          ? 'border-primary bg-accent text-accent-foreground'
          : 'border-border text-muted-foreground hover:text-foreground',
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {children}
    </button>
  )
}

function WorkoutCard({ drill, minutes }: { drill: Drill; minutes: number }) {
  const facts = factsFor(drill)

  return (
    // `relative` is load-bearing: the stretched link below is positioned
    // against the nearest positioned ancestor, and without one here it covered
    // the whole page — including the filter chips, which then could not be
    // tapped at all.
    <Card className="hover:border-primary/40 relative transition-colors">
      <CardContent className="p-4">
        <Link to={`/train/${drill.slug}`} className="focus-visible:outline-none">
          <span className="absolute inset-0" aria-hidden />
          <p className="font-semibold">{drill.name}</p>
        </Link>
        <p className="text-muted-foreground mt-1 line-clamp-2 text-sm leading-relaxed">
          {drill.description}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">{formatCompactDuration(minutes)}</Badge>
          <Badge variant="outline">{SPACE_LABEL[facts.space]}</Badge>
          {facts.quiet && (
            <Badge variant="outline">
              <VolumeX className="size-3" aria-hidden />
              Quiet
            </Badge>
          )}
          {facts.exercises > 0 && (
            <Badge variant="outline">
              <Dumbbell className="size-3" aria-hidden />
              {pluralize(facts.exercises, 'exercise')}
            </Badge>
          )}
          {facts.equipment.map((item) => (
            <Badge key={item} variant="outline">
              {item}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
