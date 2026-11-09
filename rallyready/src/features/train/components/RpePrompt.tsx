import { useQueryClient } from '@tanstack/react-query'
import { Check, Gauge, Loader2 } from 'lucide-react'
import { useState } from 'react'

import { Card, CardContent } from '@/components/ui/card'
import { useRepositories } from '@/lib/data/context'
import { METRIC_RPE, RPE_SCALE, rpeStep, sessionLoad } from '@/lib/data/load'
import { cn } from '@/lib/utils'

/**
 * "How hard was that?", asked once, immediately, in one tap.
 *
 * Timing is the whole design. Effort has to be rated while you can still feel
 * it — ask tomorrow and you get a number invented from how the session sounded
 * rather than how it felt — and it has to cost one tap, because a form stapled
 * to the end of a workout is a form nobody fills in.
 *
 * What it buys is the difference between a training diary and a training log:
 * with an effort rating, twelve brutal minutes and twelve gentle ones stop
 * looking identical, and the app can finally tell whether the week is ramping
 * faster than the body behind it.
 */

interface RpePromptProps {
  sessionId: string
  durationSec: number
  /** The rating already recorded, if the summary is being revisited. */
  initial: number | null
}

/**
 * The effort ramp, borrowed from the phase colours so it reads the same way as
 * the runner does: cool for easy, volt for working, amber and red at the top.
 */
function toneFor(value: number, selected: boolean): string {
  if (!selected) return 'bg-secondary text-secondary-foreground hover:bg-secondary/70'
  if (value <= 3) return 'bg-rest text-rest-foreground'
  if (value <= 6) return 'bg-work text-work-foreground'
  if (value <= 8) return 'bg-sprint text-sprint-foreground'
  return 'bg-destructive text-destructive-foreground'
}

export function RpePrompt({ sessionId, durationSec, initial }: RpePromptProps) {
  const repositories = useRepositories()
  const queryClient = useQueryClient()
  // Derived rather than seeded from the prop: the metrics query only starts
  // once the session has loaded, so `initial` arrives a render *after* this
  // component mounts. Seeding state from it left a session you had already
  // rated looking unrated every time you came back to it.
  const [chosen, setChosen] = useState<number | null>(null)
  const value = chosen ?? initial

  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)

  const choose = async (next: number) => {
    // Painted immediately: the tap has to feel instant, and a write that fails
    // is reported rather than rolled back — re-tapping is the retry.
    setChosen(next)
    setSaving(true)
    setFailed(false)
    try {
      await repositories.sessions.setMetric(sessionId, METRIC_RPE, next)
      await queryClient.invalidateQueries({ queryKey: ['session-metrics', sessionId] })
      await queryClient.invalidateQueries({ queryKey: ['metrics'] })
    } catch {
      setFailed(true)
    } finally {
      setSaving(false)
    }
  }

  const step = value === null ? null : rpeStep(value)

  return (
    <Card className="mb-5">
      <CardContent className="p-5">
        <div className="mb-3 flex items-start gap-3">
          <span className="bg-accent text-accent-foreground grid size-9 shrink-0 place-items-center rounded-xl">
            <Gauge className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">How hard was that?</p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Rate it now, while you can still feel it. This is what turns minutes into training
              load.
            </p>
          </div>
          {saving && <Loader2 className="text-muted-foreground mt-1 size-4 animate-spin" />}
          {!saving && value !== null && !failed && (
            <Check className="text-primary-ink mt-1 size-4 shrink-0" aria-hidden />
          )}
        </div>

        <div
          role="radiogroup"
          aria-label="Rate the effort from 1 to 10"
          className="grid grid-cols-5 gap-1.5 sm:grid-cols-10"
        >
          {RPE_SCALE.map((entry) => (
            <button
              key={entry.value}
              type="button"
              role="radio"
              aria-checked={value === entry.value}
              aria-label={`${entry.value} — ${entry.label}. ${entry.hint}`}
              onClick={() => void choose(entry.value)}
              className={cn(
                'tnum focus-visible:ring-ring grid h-11 place-items-center rounded-lg text-sm font-bold transition-colors focus-visible:ring-2 focus-visible:outline-none',
                toneFor(entry.value, value === entry.value),
              )}
            >
              {entry.value}
            </button>
          ))}
        </div>

        {/* Reserved height, so choosing a rating does not shunt the page. */}
        <div className="mt-3 min-h-[2.5rem]">
          {step ? (
            <p className="text-sm leading-snug">
              <span className="font-semibold">{step.label}.</span>{' '}
              <span className="text-muted-foreground">{step.hint}</span>{' '}
              <span className="text-muted-foreground">
                Load {sessionLoad(durationSec, step.value)}.
              </span>
            </p>
          ) : (
            <p className="text-muted-foreground text-sm leading-snug">
              1 is barely moving. 10 is everything you had.
            </p>
          )}
          {failed && (
            <p className="text-destructive mt-1 text-xs" role="status">
              That did not save. Tap again to retry.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
