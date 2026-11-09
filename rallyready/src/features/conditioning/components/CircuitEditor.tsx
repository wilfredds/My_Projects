import { AlertTriangle, ChevronDown, Dumbbell } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { findExercise } from '@/lib/data/seed/exercises'
import type { Drill } from '@/lib/data/types'
import type { DrillConfig } from '@/lib/timer/plan'
import { cn, formatDuration, pluralize } from '@/lib/utils'

import { ExerciseDemo } from './ExerciseDemo'

/**
 * The setup screen for a conditioning circuit. Caller mode, court layout and
 * shot interval mean nothing here, so those cards are replaced with what does
 * matter: how many rounds, and what each exercise actually is.
 */

interface CircuitEditorProps {
  drill: Drill
  config: DrillConfig
  onChange: (patch: Partial<DrillConfig>) => void
}

export function CircuitEditor({ drill, config, onChange }: CircuitEditorProps) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const steps = config.circuit ?? []
  const perRound = steps.reduce((total, step) => total + step.workSec + step.restSec, 0)

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Rounds</CardTitle>
          <CardDescription>
            How many times through the circuit. Each round is {formatDuration(perRound)}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <Label htmlFor="circuit-rounds">Times through</Label>
              <span className="tnum text-muted-foreground text-sm">
                {pluralize(config.circuitRounds, 'round')}
              </span>
            </div>
            <Slider
              id="circuit-rounds"
              min={1}
              max={6}
              step={1}
              value={[config.circuitRounds]}
              onValueChange={([value]) => onChange({ circuitRounds: value ?? 1 })}
              aria-label="Rounds"
            />
          </div>

          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <Label htmlFor="circuit-cooldown">Cool-down</Label>
              <span className="tnum text-muted-foreground text-sm">{config.cooldownSec}s</span>
            </div>
            <Slider
              id="circuit-cooldown"
              min={0}
              max={300}
              step={15}
              value={[config.cooldownSec]}
              onValueChange={([value]) => onChange({ cooldownSec: value ?? 0 })}
              aria-label="Cool-down"
            />
          </div>

          {drill.equipment.length > 0 && (
            <p className="text-muted-foreground flex items-start gap-2 text-xs leading-relaxed">
              <Dumbbell className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Needs {drill.equipment.join(', ')}. Every exercise below lists what to do without it.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>The circuit</CardTitle>
          <CardDescription>
            {pluralize(steps.length, 'exercise')}, in this order. Tap one for its cues.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="divide-border divide-y">
            {steps.map((step, index) => {
              const exercise = findExercise(step.exerciseSlug)
              if (!exercise) return null
              const isOpen = expanded === step.exerciseSlug

              return (
                <li key={`${step.exerciseSlug}-${index}`} className="py-3 first:pt-0 last:pb-0">
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : step.exerciseSlug)}
                    aria-expanded={isOpen}
                    className="focus-visible:ring-ring flex w-full items-center gap-3 rounded-lg text-left focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <span className="bg-muted grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg">
                      <ExerciseDemo exercise={exercise} animated={false} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="truncate font-semibold">{exercise.name}</span>
                        <span className="text-muted-foreground tnum shrink-0 text-xs">
                          {step.workSec}s / {step.restSec}s
                        </span>
                      </span>
                      <span className="text-muted-foreground mt-0.5 line-clamp-2 block text-xs leading-relaxed">
                        {exercise.summary}
                      </span>
                    </span>
                    <ChevronDown
                      className={cn(
                        'text-muted-foreground size-4 shrink-0 transition-transform',
                        isOpen && 'rotate-180',
                      )}
                      aria-hidden
                    />
                  </button>

                  {isOpen && (
                    <div className="mt-3 space-y-3 pl-1">
                      <div className="bg-muted/60 mx-auto h-44 w-full max-w-[11rem] rounded-lg">
                        <ExerciseDemo exercise={exercise} />
                      </div>
                      <ul className="space-y-2 text-sm leading-relaxed">
                        {exercise.cues.map((cue) => (
                          <li key={cue} className="flex gap-2.5">
                            <span className="bg-primary mt-[0.4375rem] size-1.5 shrink-0 rounded-full" />
                            {cue}
                          </li>
                        ))}
                      </ul>
                      <div>
                        <p className="mb-1.5 flex items-center gap-2 text-xs font-semibold">
                          <AlertTriangle className="text-sprint-ink size-3.5" aria-hidden />
                          Common faults
                        </p>
                        <ul className="text-muted-foreground space-y-1.5 text-xs leading-relaxed">
                          {exercise.faults.map((fault) => (
                            <li key={fault} className="flex gap-2">
                              <span className="bg-sprint/60 mt-[0.375rem] size-1 shrink-0 rounded-full" />
                              {fault}
                            </li>
                          ))}
                        </ul>
                      </div>
                      {exercise.substitute && (
                        <p className="text-muted-foreground text-xs leading-relaxed">
                          <Badge variant="outline" className="mr-1.5">
                            No kit
                          </Badge>
                          {exercise.substitute}
                        </p>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
        </CardContent>
      </Card>
    </>
  )
}
