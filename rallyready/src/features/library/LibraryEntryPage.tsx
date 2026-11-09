import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  Home,
  Lightbulb,
  MapPin,
  Play,
  Repeat,
  SlidersHorizontal,
  Users,
} from 'lucide-react'
import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useRepositories } from '@/lib/data/context'
import { findExercise } from '@/lib/data/seed/exercises'
import { findTechniqueTopic } from '@/lib/data/seed/technique'

import { TechniqueFigurePanel } from './components/TechniqueFigure'
import { buildLibrary, findEntry, KIND_LABEL, type LibraryKind } from '@/lib/library/entries'

import { ExerciseDemo } from '../conditioning/components/ExerciseDemo'
import { CATEGORY_LABEL, LEVEL_LABEL } from '../train/drillLabels'
import { EntryCard } from './components/EntryCard'

export function LibraryEntryPage() {
  const { kind = '', slug = '' } = useParams()
  const repositories = useRepositories()

  const { data: drills = [], isLoading } = useQuery({
    queryKey: ['drills'],
    queryFn: () => repositories.drills.list(),
  })

  const library = useMemo(() => buildLibrary(drills), [drills])
  const entry = findEntry(library, `${kind}/${slug}`)

  if (isLoading) return <p className="text-muted-foreground text-sm">Loading…</p>

  if (!entry) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Not in the library</h1>
        <p className="text-muted-foreground text-sm">
          That entry does not exist, or it has been renamed.
        </p>
        <Button asChild>
          <Link to="/library">Back to the Library</Link>
        </Button>
      </div>
    )
  }

  const topic = entry.kind === 'technique' ? findTechniqueTopic(entry.slug) : undefined
  const exercise = entry.kind === 'exercise' ? findExercise(entry.slug) : undefined
  const related = entry.relatedIds
    .map((id) => findEntry(library, id))
    .filter((candidate) => candidate !== undefined)

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-3 mb-3">
        <Link to="/library">
          <ArrowLeft />
          Library
        </Link>
      </Button>

      <div className="mb-5">
        <Badge variant="accent" className="mb-2">
          {KIND_LABEL[entry.kind as LibraryKind]}
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight text-balance">{entry.title}</h1>
        <p className="text-muted-foreground mt-2 leading-relaxed">{entry.summary}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge>{CATEGORY_LABEL[entry.category]}</Badge>
          <Badge variant="outline">{LEVEL_LABEL[entry.level]}</Badge>
          <Badge variant="outline">
            {entry.minutes} min{entry.kind === 'technique' ? ' read' : ''}
          </Badge>
          {entry.practiceMode === 'partner' ? (
            <Badge variant="outline">
              <Users className="size-3" aria-hidden />
              Needs a partner
            </Badge>
          ) : entry.location === 'anywhere' ? (
            <Badge variant="outline">
              <Home className="size-3" aria-hidden />
              No court
            </Badge>
          ) : (
            <Badge variant="outline">
              <MapPin className="size-3" aria-hidden />
              Court
            </Badge>
          )}
        </div>
      </div>

      {entry.runSlug && (
        <div className="mb-6 flex gap-2">
          <Button asChild size="xl" className="flex-1">
            <Link to={`/run/${entry.runSlug}`}>
              <Play className="fill-current" />
              {entry.kind === 'technique' ? 'Drill it' : 'Start'}
            </Link>
          </Button>
          <Button asChild variant="outline" size="xl">
            <Link to={`/train/${entry.runSlug}`} aria-label="Adjust the settings first">
              <SlidersHorizontal />
            </Link>
          </Button>
        </div>
      )}

      {exercise && (
        <Card className="mb-5">
          <CardContent className="p-5">
            {/* Height-capped: the ladder diagram is 1.5× as tall as it is wide,
                and left to fill the width it swallows a phone screen whole. */}
            <div className="mx-auto h-56 w-full max-w-xs sm:h-64">
              <ExerciseDemo exercise={exercise} />
            </div>
            {exercise.substitute && (
              <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                <span className="text-foreground font-medium">No kit? </span>
                {exercise.substitute}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Above the prose, because a grip or a swing is a picture first and a
          paragraph second — which is exactly the feedback that put it here. */}
      {topic?.diagram && (
        <Card className="mb-5">
          <CardContent className="p-5">
            <div className="mx-auto w-full max-w-xs">
              <TechniqueFigurePanel diagram={topic.diagram} />
            </div>
            <p className="text-muted-foreground mt-3 text-center text-xs leading-relaxed">
              {topic.diagram.kind === 'grip'
                ? `${topic.diagram.grip.faceNote}. Drawn right-handed — mirror it if you play left.`
                : 'Drawn right-handed — mirror it if you play left.'}
            </p>
          </CardContent>
        </Card>
      )}

      {topic?.sections.map((section) => (
        <section key={section.heading} className="mb-6">
          <h2 className="mb-2 text-lg font-semibold tracking-tight">{section.heading}</h2>
          {section.body.map((paragraph) => (
            <p key={paragraph} className="text-muted-foreground mb-3 leading-relaxed">
              {paragraph}
            </p>
          ))}
        </section>
      ))}

      {entry.recommendedReps && (
        <Card className="mb-5">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="bg-accent text-accent-foreground grid size-11 shrink-0 place-items-center rounded-xl">
              <Repeat className="size-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">How much</p>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {entry.recommendedReps}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mb-5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="text-primary-ink size-4" aria-hidden />
            Coaching cues
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-2.5 text-sm leading-relaxed">
            {entry.cues.map((cue) => (
              <li key={cue} className="flex gap-2.5">
                <span className="bg-primary mt-[0.4375rem] size-1.5 shrink-0 rounded-full" />
                {cue}
              </li>
            ))}
          </ul>
          <div className="border-border border-t pt-4">
            <p className="mb-2.5 flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="text-sprint-ink size-4" aria-hidden />
              Common faults
            </p>
            <ul className="text-muted-foreground space-y-2 text-sm leading-relaxed">
              {entry.faults.map((fault) => (
                <li key={fault} className="flex gap-2.5">
                  <span className="bg-sprint/60 mt-[0.4375rem] size-1.5 shrink-0 rounded-full" />
                  {fault}
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Rendered only when a curator has vetted a clip; see seed/technique.ts. */}
      {entry.reference && (
        <Card className="mb-5">
          <CardContent className="p-5">
            <p className="mb-1 text-sm font-semibold">Watch it</p>
            <a
              href={entry.reference.url}
              target="_blank"
              rel="noreferrer noopener"
              className="text-primary-ink inline-flex items-center gap-1.5 text-sm hover:underline"
            >
              {entry.reference.title}
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
            <p className="text-muted-foreground mt-1 text-xs">{entry.reference.source}</p>
          </CardContent>
        </Card>
      )}

      {related.length > 0 && (
        <section aria-labelledby="related">
          <h2 id="related" className="mb-3 text-sm font-semibold tracking-wide uppercase">
            {entry.kind === 'technique' ? 'Drills that train this' : 'Related'}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {related.map((candidate) => (
              <li key={candidate.id}>
                <EntryCard entry={candidate} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
