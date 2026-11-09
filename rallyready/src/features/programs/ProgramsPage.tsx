import { useQuery } from '@tanstack/react-query'
import { CalendarRange, Home, MapPin, Plus, Users } from 'lucide-react'
import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/PageHeader'
import { Pressable } from '@/components/motion/Pressable'
import { StaggerItem } from '@/components/motion/StaggerItem'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { SkeletonCard } from '@/components/ui/skeleton'
import { useRepositories } from '@/lib/data/context'
import type { Program } from '@/lib/data/types'
import { PHASE_LABEL } from '@/lib/programs/periodise'
import { pluralize } from '@/lib/utils'

import { LEVEL_LABEL } from '../train/drillLabels'
import { useProgramState } from './useProgramState'

export function ProgramsPage() {
  const repositories = useRepositories()
  const { enrollment, program: active, today, progress, loading } = useProgramState()

  const { data: programs = [], isLoading } = useQuery({
    queryKey: ['programs'],
    queryFn: () => repositories.programs.list(),
  })

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => repositories.profiles.get(),
  })

  // Programs that match where the user trains come first — a court plan is
  // useless to someone training in a garage.
  const suits = (program: Program) =>
    !profile || profile.courtAccess === 'court' || program.location === 'anywhere'
  const sorted = [...programs].sort(
    (a, b) => Number(suits(b)) - Number(suits(a)) || a.totalWeeks - b.totalWeeks,
  )

  const mine = sorted.filter((program) => program.createdBy !== null)
  const built = sorted.filter((program) => program.createdBy === null)

  return (
    <>
      <PageHeader
        title="Programs"
        description="Multi-week plans that decide what you train, and when. You just turn up."
        action={
          <Button asChild variant="outline" size="icon" title="Create a program">
            <Link to="/programs/new" aria-label="Create a program">
              <Plus />
            </Link>
          </Button>
        }
      />

      {!loading && enrollment && active && (
        <Card level="lead" className="mb-8">
          <CardContent className="space-y-4 p-5">
            <div>
              <Badge variant="accent" className="mb-2">
                In progress
              </Badge>
              <h2 className="text-xl font-bold tracking-tight">{active.name}</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Week {enrollment.currentWeek} of {active.totalWeeks}
                {today && ` · ${today.title}`}
              </p>
            </div>
            <div className="bg-secondary h-1.5 w-full overflow-hidden rounded-full">
              <div
                className="bg-primary h-full rounded-full transition-[width] duration-500"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <Button asChild size="lg" className="w-full">
              <Link to={`/programs/${active.slug}`}>Open the plan</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <ul className="space-y-3">
          {Array.from({ length: 3 }, (_, index) => (
            <li key={index}>
              <SkeletonCard />
            </li>
          ))}
        </ul>
      )}

      {mine.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold tracking-wide uppercase">Your programs</h2>
          <ul className="space-y-3">
            {mine.map((program, index) => (
              <StaggerItem key={program.id} index={index}>
                <ProgramCard program={program} suits={suits(program)} owned />
              </StaggerItem>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-wide uppercase">
          {mine.length > 0 ? 'Built-in programs' : 'Choose a program'}
        </h2>
        <ul className="space-y-3">
          {built.map((program, index) => (
            <StaggerItem key={program.id} index={index}>
              <ProgramCard program={program} suits={suits(program)} />
            </StaggerItem>
          ))}
        </ul>
      </section>

      <Card className="mt-8">
        <CardContent className="flex items-center gap-4 p-4">
          <div className="bg-accent text-accent-foreground grid size-11 shrink-0 place-items-center rounded-xl">
            <Users className="size-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Write your own</p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Build a plan, then publish it for other players to follow.
            </p>
          </div>
          <Button asChild size="sm" variant="outline" className="shrink-0">
            <Link to="/programs/new">Create</Link>
          </Button>
        </CardContent>
      </Card>
    </>
  )
}

function ProgramCard({
  program,
  suits,
  owned,
}: {
  program: Program
  suits: boolean
  owned?: boolean
}) {
  return (
    <Pressable>
      <Card className="hover:border-primary/50 transition-colors">
        <CardContent className="p-4">
          <Link to={`/programs/${program.slug}`} className="block">
            <div className="mb-2 flex flex-wrap gap-1.5">
              <Badge>{pluralize(program.totalWeeks, 'week')}</Badge>
              <Badge variant="outline">{LEVEL_LABEL[program.level]}</Badge>
              <Badge variant="outline">
                {program.location === 'anywhere' ? (
                  <>
                    <Home className="size-3" aria-hidden />
                    No court
                  </>
                ) : (
                  <>
                    <MapPin className="size-3" aria-hidden />
                    Court
                  </>
                )}
              </Badge>
              {owned && !program.isPublic && <Badge variant="outline">Private</Badge>}
              {owned && program.isPublic && <Badge variant="accent">Published</Badge>}
            </div>
            <h3 className="leading-snug font-semibold">{program.name}</h3>
            <p className="text-muted-foreground mt-1 line-clamp-3 text-sm leading-relaxed">
              {program.description}
            </p>
            <p className="text-muted-foreground mt-2 flex items-center gap-1.5 text-xs">
              <CalendarRange className="size-3.5" aria-hidden />
              {pluralize(program.sessionsPerWeek, 'session')} a week ·{' '}
              {Object.values(PHASE_LABEL).join(' → ')}
            </p>
            {!suits && (
              <p className="text-muted-foreground mt-2 text-xs italic">
                Assumes court access, which your profile says you do not have.
              </p>
            )}
          </Link>
        </CardContent>
      </Card>
    </Pressable>
  )
}
