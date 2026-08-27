import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2, Save, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Segmented } from '@/components/ui/segmented'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { useRepositories } from '@/lib/data/context'
import type { DrillLocation, NewProgram, SkillLevel } from '@/lib/data/types'
import { countSessions, periodise, PHASE_LABEL, phaseByWeek } from '@/lib/programs/periodise'
import { cn, pluralize } from '@/lib/utils'

/**
 * Create or edit a program.
 *
 * You describe the shape — length, sessions a week, level, where you train —
 * and the plan is periodised from that. Hand-placing 84 days is not a thing
 * anyone would finish, and a plan assembled by hand tends not to periodise at
 * all. Individual days can still be retitled afterwards from the detail screen.
 */
export function ProgramBuilderPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const repositories = useRepositories()
  const queryClient = useQueryClient()
  const editing = Boolean(slug)

  const { data: existing, isLoading } = useQuery({
    queryKey: ['program', slug],
    queryFn: () => repositories.programs.getBySlug(slug ?? ''),
    enabled: editing,
  })

  const [draft, setDraft] = useState<NewProgram | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Derived during render so switching programs never shows stale fields.
  const form: NewProgram = draft ?? {
    name: existing?.name ?? '',
    description: existing?.description ?? '',
    totalWeeks: existing?.totalWeeks ?? 8,
    level: existing?.level ?? 'intermediate',
    location: existing?.location ?? 'court',
    sessionsPerWeek: existing?.sessionsPerWeek ?? 3,
    isPublic: existing?.isPublic ?? false,
  }

  const update = (patch: Partial<NewProgram>) => setDraft({ ...form, ...patch })

  if (editing && isLoading) {
    return <p className="text-muted-foreground text-sm">Loading…</p>
  }

  if (editing && existing && existing.createdBy === null) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">This program cannot be edited</h1>
        <p className="text-muted-foreground text-sm">
          Built-in programs are read-only. Create your own to change the plan.
        </p>
        <Button asChild>
          <Link to="/programs/new">Create a program</Link>
        </Button>
      </div>
    )
  }

  const preview = periodise({
    totalWeeks: form.totalWeeks,
    sessionsPerWeek: form.sessionsPerWeek,
    level: form.level,
    location: form.location,
  })
  const phases = phaseByWeek(form.totalWeeks)

  const save = async () => {
    if (form.name.trim().length < 3) {
      setError('Give the program a name of at least three characters.')
      return
    }
    setError(null)
    setSaving(true)
    try {
      const saved =
        editing && existing
          ? await repositories.programs.update(existing.id, form)
          : await repositories.programs.create(form)
      await queryClient.invalidateQueries({ queryKey: ['programs'] })
      await queryClient.invalidateQueries({ queryKey: ['program-days'] })
      navigate(`/programs/${saved.slug}`, { replace: true })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save the program.')
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!existing) return
    if (!window.confirm(`Delete "${existing.name}"? This cannot be undone.`)) return
    await repositories.programs.remove(existing.id)
    await queryClient.invalidateQueries({ queryKey: ['programs'] })
    navigate('/programs', { replace: true })
  }

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-3 mb-3">
        <Link to="/programs">
          <ArrowLeft />
          Programs
        </Link>
      </Button>

      <h1 className="mb-6 text-3xl font-bold tracking-tight">
        {editing ? 'Edit program' : 'New program'}
      </h1>

      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>About</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="program-name" className="mb-1.5 block">
                Name
              </Label>
              <input
                id="program-name"
                value={form.name}
                maxLength={80}
                onChange={(event) => update({ name: event.target.value })}
                placeholder="Eight Weeks Back"
                className="border-input bg-background focus-visible:ring-ring placeholder:text-muted-foreground h-11 w-full rounded-lg border px-3 text-base focus-visible:ring-2 focus-visible:outline-none"
              />
            </div>
            <div>
              <Label htmlFor="program-description" className="mb-1.5 block">
                Description
              </Label>
              <textarea
                id="program-description"
                value={form.description}
                maxLength={400}
                rows={3}
                onChange={(event) => update({ description: event.target.value })}
                placeholder="Who is it for, and what will it do for them?"
                // `text-base`, like every other field: iOS zooms the whole
                // page in when a focused input is under 16px, and it does not
                // zoom back out.
                className="border-input bg-background focus-visible:ring-ring placeholder:text-muted-foreground w-full resize-y rounded-lg border p-3 text-base focus-visible:ring-2 focus-visible:outline-none"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Shape</CardTitle>
            <CardDescription>
              The plan is periodised from these. Change one and the whole thing rebuilds.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <Label htmlFor="program-weeks">Length</Label>
                <span className="tnum text-muted-foreground text-sm">
                  {pluralize(form.totalWeeks, 'week')}
                </span>
              </div>
              <Slider
                id="program-weeks"
                min={4}
                max={16}
                step={1}
                value={[form.totalWeeks]}
                onValueChange={([value]) => update({ totalWeeks: value ?? 8 })}
                aria-label="Length in weeks"
              />
            </div>

            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <Label htmlFor="program-sessions">Sessions a week</Label>
                <span className="tnum text-muted-foreground text-sm">{form.sessionsPerWeek}</span>
              </div>
              <Slider
                id="program-sessions"
                min={2}
                max={6}
                step={1}
                value={[form.sessionsPerWeek]}
                onValueChange={([value]) => update({ sessionsPerWeek: value ?? 3 })}
                aria-label="Sessions per week"
              />
              <p className="text-muted-foreground mt-2 text-xs">
                Deload weeks automatically train one session fewer.
              </p>
            </div>

            <div>
              <Label className="mb-2 block">Level</Label>
              <Segmented
                label="Level"
                value={form.level}
                options={[
                  { value: 'beginner', label: 'Beginner' },
                  { value: 'intermediate', label: 'Club' },
                  { value: 'advanced', label: 'Competitive' },
                ]}
                onChange={(value) => update({ level: value as SkillLevel })}
              />
            </div>

            <div>
              <Label className="mb-2 block">Where</Label>
              <Segmented
                label="Where the program is trained"
                layout="stacked"
                value={form.location}
                options={[
                  { value: 'court', label: 'On court', hint: 'Uses the full court' },
                  { value: 'anywhere', label: 'Anywhere', hint: 'No court needed' },
                ]}
                onChange={(value) => update({ location: value as DrillLocation })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              {pluralize(countSessions(preview), 'session')} across{' '}
              {pluralize(form.totalWeeks, 'week')}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="flex flex-wrap gap-1.5">
              {phases.map((phase, index) => (
                <li
                  key={index}
                  className={cn(
                    'rounded-md px-2 py-1 text-[0.625rem] font-semibold',
                    phase === 'deload'
                      ? 'bg-rest/15 text-rest'
                      : phase === 'sharpen'
                        ? 'bg-sprint/15 text-sprint'
                        : phase === 'build'
                          ? 'bg-work/20 text-work'
                          : 'bg-muted text-muted-foreground',
                  )}
                  title={`Week ${index + 1}: ${PHASE_LABEL[phase]}`}
                >
                  {index + 1} · {PHASE_LABEL[phase]}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start justify-between gap-4 p-5">
            <div>
              <Label htmlFor="program-public">Publish publicly</Label>
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                Anyone using RallyReady can find and follow it. You can unpublish at any time.
              </p>
            </div>
            <Switch
              id="program-public"
              checked={form.isPublic}
              onCheckedChange={(value) => update({ isPublic: value })}
            />
          </CardContent>
        </Card>

        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}

        {editing && existing && (
          <Button variant="ghost" className="text-destructive" onClick={() => void remove()}>
            <Trash2 />
            Delete this program
          </Button>
        )}
      </div>

      <div className="bg-background/90 sticky bottom-[calc(3.25rem+env(safe-area-inset-bottom,0px))] z-30 -mx-4 mt-6 border-t px-4 py-3 backdrop-blur md:bottom-0">
        <Button size="xl" className="w-full" onClick={() => void save()} disabled={saving}>
          {saving ? <Loader2 className="animate-spin" /> : <Save />}
          {editing ? 'Save changes' : 'Create program'}
        </Button>
        {!editing && (
          <p className="text-muted-foreground mt-2 text-center text-xs">
            <Badge variant="outline" className="mr-1.5">
              Note
            </Badge>
            Editing the shape later rebuilds the plan and discards day-level edits.
          </p>
        )}
      </div>
    </>
  )
}
