import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, BookOpen } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Segmented } from '@/components/ui/segmented'
import { useRepositories } from '@/lib/data/context'
import type { SkillLevel } from '@/lib/data/types'
import { buildLibrary } from '@/lib/library/entries'
import { entriesForFocus, findFocus, sortForFocus } from '@/lib/library/focus'
import { pluralize } from '@/lib/utils'
import { useUiStore } from '@/store/uiStore'

import { EntryCard } from '../library/components/EntryCard'
import { LEVEL_LABEL } from './drillLabels'

/**
 * Everything that trains one thing, at the level of the player asking.
 *
 * Ordered drills-first: you arrived here wanting to do something about your
 * agility, so the things you can start are above the things you can read.
 */
export function FocusPage() {
  const { id = '' } = useParams()
  const repositories = useRepositories()
  const focus = findFocus(id)

  const { data: drills = [], isLoading } = useQuery({
    queryKey: ['drills'],
    queryFn: () => repositories.drills.list(),
  })
  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => repositories.profiles.get(),
  })

  const stored = useUiStore((state) => state.browseLevel)
  const setLevel = useUiStore((state) => state.setBrowseLevel)
  // The profile seeds it; once the player picks a level themselves, that wins.
  const level: SkillLevel = stored ?? profile?.skillLevel ?? 'beginner'

  if (!focus) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Nothing to work on here</h1>
        <p className="text-muted-foreground text-sm">
          &ldquo;{id}&rdquo; is not one of the focus areas.
        </p>
        <Button asChild>
          <Link to="/">Back to Train</Link>
        </Button>
      </div>
    )
  }

  const all = buildLibrary(drills)
  const shown = sortForFocus(entriesForFocus(all, focus, { level }), focus)
  const hidden = entriesForFocus(all, focus, { level, showHarder: true }).length - shown.length

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
        <Link to="/">
          <ArrowLeft />
          Train
        </Link>
      </Button>

      <PageHeader title={focus.title} description={focus.blurb} />

      {/* The beginner path is a reading order, not a difficulty band, so it is
          not filtered — you meet these before you have a level at all. */}
      {!focus.fundamentalsOnly && (
        <div className="mb-5">
          <Segmented
            label="Your level"
            value={level}
            options={(['beginner', 'intermediate', 'advanced'] as SkillLevel[]).map((value) => ({
              value,
              label: LEVEL_LABEL[value],
            }))}
            onChange={(next) => setLevel(next as SkillLevel)}
          />
          <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
            {/* Not when the list below is empty: "showing the basics" above
                "nothing here at this level" contradicted itself. */}
            {shown.length === 0
              ? 'Change your level to see what this area holds.'
              : level === 'beginner'
                ? 'Showing the basics only. Move this up when they stop feeling hard.'
                : `Showing everything up to ${LEVEL_LABEL[level].toLowerCase()}.`}
          </p>
        </div>
      )}

      {focus.fundamentalsOnly && (
        <Card className="mb-5">
          <CardContent className="flex items-start gap-3 p-4">
            <BookOpen className="text-primary-ink mt-0.5 size-4 shrink-0" aria-hidden />
            <p className="text-muted-foreground text-sm leading-relaxed">
              <span className="text-foreground font-medium">Read these in order.</span> Each one has
              a diagram you can copy — the grips especially are almost impossible to learn from
              words alone.
            </p>
          </CardContent>
        </Card>
      )}

      {isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}

      {!isLoading && shown.length === 0 && (
        <Card className="mb-5">
          <CardContent className="p-6 text-center">
            <p className="font-medium">Nothing here at this level yet</p>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              {hidden > 0
                ? `There ${hidden === 1 ? 'is' : 'are'} ${pluralize(hidden, 'harder option')} in this area. Move your level up if you are ready for them.`
                : 'Try another area from the Train screen.'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Numbered when it is a syllabus, so "read these in order" is something
          you can see rather than something you are told. */}
      <ol className={focus.fundamentalsOnly ? 'space-y-3' : 'grid gap-3 sm:grid-cols-2'}>
        {shown.map((entry, index) => (
          <li key={entry.id} className={focus.fundamentalsOnly ? 'flex gap-3' : undefined}>
            {focus.fundamentalsOnly && (
              <span
                className="bg-secondary text-muted-foreground mt-1 grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold"
                aria-hidden
              >
                {index + 1}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <EntryCard entry={entry} />
            </div>
          </li>
        ))}
      </ol>

      {hidden > 0 && shown.length > 0 && (
        <p className="text-muted-foreground mt-5 text-center text-xs leading-relaxed">
          {pluralize(hidden, 'harder option')} hidden at this level. Nothing is locked — move your
          level up to see {hidden === 1 ? 'it' : 'them'}.
        </p>
      )}
    </>
  )
}
