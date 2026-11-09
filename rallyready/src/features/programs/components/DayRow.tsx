import { Activity, Coffee, Dumbbell, LocateFixed, Play, Swords } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import type { Drill, ProgramDay, ProgramFocus } from '@/lib/data/types'
import { cn } from '@/lib/utils'

const FOCUS_ICON = {
  footwork: Activity,
  conditioning: Dumbbell,
  matchplay: Swords,
  rest: Coffee,
} as const

const FOCUS_TINT: Record<ProgramFocus, string> = {
  footwork: 'bg-work/15 text-work-ink',
  conditioning: 'bg-sprint/15 text-sprint-ink',
  matchplay: 'bg-cooldown/15 text-cooldown-ink',
  rest: 'bg-muted text-muted-foreground',
}

const WEEKDAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface DayRowProps {
  day: ProgramDay
  drills: Drill[]
  /** Highlights the enrolment's current position. */
  current?: boolean
  /** Already behind the current position. */
  done?: boolean
  onJump?: () => void
}

export function DayRow({ day, drills, current, done, onJump }: DayRowProps) {
  const Icon = FOCUS_ICON[day.focus]
  const linked = day.drillSlugs
    .map((slug) => drills.find((drill) => drill.slug === slug))
    .filter((drill): drill is Drill => drill !== undefined)

  return (
    <li
      className={cn(
        'flex items-start gap-3 rounded-lg px-2 py-3 transition-colors',
        current && 'bg-accent/60 ring-primary/40 ring-1',
        done && !current && 'opacity-55',
      )}
    >
      <span
        className={cn('grid size-9 shrink-0 place-items-center rounded-lg', FOCUS_TINT[day.focus])}
      >
        <Icon className="size-4" aria-hidden />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-muted-foreground w-8 shrink-0 text-xs font-medium">
            {WEEKDAY[day.dayNo - 1]}
          </span>
          {/* Wraps rather than truncates: two actions sit to the right of this
              column, and on a 360px screen a truncated title reads "Fo…". */}
          <span
            className={cn(
              'text-sm font-semibold text-balance',
              day.focus === 'rest' && 'text-muted-foreground font-medium',
            )}
          >
            {day.title}
          </span>
        </div>
        {linked.length > 0 && (
          <p className="text-muted-foreground mt-0.5 pl-10 text-xs">
            {linked.map((drill) => drill.name).join(' · ')}
          </p>
        )}
        {day.notes && (
          <p className="text-muted-foreground mt-1 pl-10 text-xs leading-relaxed">{day.notes}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center">
        {linked[0] && (
          <Button
            asChild
            size="icon-sm"
            variant={current ? 'default' : 'ghost'}
            title={`Start ${linked[0].name}`}
          >
            <Link to={`/run/${linked[0].slug}`} aria-label={`Start ${linked[0].name}`}>
              <Play className="fill-current" />
            </Link>
          </Button>
        )}
        {onJump && !current && (
          <Button size="icon-sm" variant="ghost" onClick={onJump} title="Make this the current day">
            <LocateFixed />
            <span className="sr-only">
              Jump to week {day.weekNo}, day {day.dayNo}
            </span>
          </Button>
        )}
      </div>
    </li>
  )
}
