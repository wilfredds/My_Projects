import { AnimatePresence, motion } from 'framer-motion'
import { ArrowDown, ArrowUp, Check, HeartPulse, Loader2, Minus, Pencil } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useMotionSafe, valuePopVariants } from '@/lib/motion'
import {
  READINESS_BAND_COPY,
  READINESS_QUESTIONS,
  readinessBand,
  readinessScore,
  type Adjustment,
} from '@/lib/data/readiness'
import type { ReadinessAnswers } from '@/lib/data/types'
import { cn } from '@/lib/utils'

import { useReadiness } from '../useReadiness'

/**
 * The five-second check-in, and the one instruction it produces.
 *
 * This is the piece that makes the app feel coached rather than scheduled. A
 * fixed plan cannot know you slept four hours; a coach looks at you, says
 * "we'll keep it short today", and that judgement is most of what you are
 * paying them for.
 *
 * Three taps and it is done — there is no submit button, because a form with a
 * submit button at the top of the training screen is a form people learn to
 * scroll past. The recommendation that follows is offered, never imposed: the
 * app is allowed an opinion about today, but the player decides.
 */

type Draft = Partial<ReadinessAnswers>

const ADJUSTMENT_ICON: Record<Adjustment, typeof ArrowDown> = {
  lighter: ArrowDown,
  'as-planned': Minus,
  harder: ArrowUp,
}

const ADJUSTMENT_TONE: Record<Adjustment, string> = {
  lighter: 'bg-rest/15 text-rest',
  'as-planned': 'bg-secondary text-secondary-foreground',
  harder: 'bg-work/15 text-work',
}

export function ReadinessCard() {
  const { loading, today, recommendation, applied, save, setApplied } = useReadiness()
  const answerPop = useMotionSafe(valuePopVariants)
  const [draft, setDraft] = useState<Draft>({})
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [failed, setFailed] = useState(false)

  if (loading) return null

  const answer = async (key: keyof ReadinessAnswers, value: number) => {
    const next = { ...draft, [key]: value }
    setDraft(next)
    // Saved the moment the third answer lands: asking someone to fill in three
    // dots and then find a button is four interactions for a three-question
    // form.
    if (next.sleep === undefined || next.soreness === undefined || next.energy === undefined) return

    setSaving(true)
    setFailed(false)
    try {
      await save(next as ReadinessAnswers)
      setEditing(false)
      setDraft({})
    } catch {
      setFailed(true)
    } finally {
      setSaving(false)
    }
  }

  if (today && !editing) {
    const score = readinessScore(today)
    const band = readinessBand(today)
    const copy = READINESS_BAND_COPY[band]
    const Icon = ADJUSTMENT_ICON[recommendation.adjustment]
    const offersChange = recommendation.adjustment !== 'as-planned'

    return (
      <Card className="mb-6">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                'grid size-10 shrink-0 place-items-center rounded-xl',
                ADJUSTMENT_TONE[recommendation.adjustment],
              )}
            >
              <Icon className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{recommendation.headline}</p>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {recommendation.reason}
              </p>
            </div>
            <Button
              size="icon-sm"
              variant="ghost"
              className="shrink-0"
              onClick={() => setEditing(true)}
              title="Change today's check-in"
            >
              <Pencil />
              <span className="sr-only">Change today&rsquo;s check-in</span>
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex min-w-[8rem] flex-1 items-center gap-2">
              <div className="bg-secondary h-1.5 flex-1 overflow-hidden rounded-full">
                <div
                  className={cn(
                    'h-full rounded-full transition-[width] duration-500',
                    band === 'low' ? 'bg-sprint' : band === 'fair' ? 'bg-rest' : 'bg-primary',
                  )}
                  style={{ width: `${Math.max(4, score)}%` }}
                />
              </div>
              <span className="text-muted-foreground shrink-0 text-xs font-medium">
                {copy.label}
              </span>
            </div>

            {offersChange && (
              <Button
                size="sm"
                variant={applied ? 'default' : 'outline'}
                onClick={() => setApplied(!applied)}
                aria-pressed={applied}
                className="shrink-0"
              >
                {applied ? <Check /> : <Icon />}
                {applied
                  ? 'Applied to today'
                  : recommendation.adjustment === 'lighter'
                    ? 'Lighten today'
                    : 'Add a round'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mb-6">
      <CardContent className="p-5">
        <div className="mb-4 flex items-start gap-3">
          <span className="bg-accent text-accent-foreground grid size-10 shrink-0 place-items-center rounded-xl">
            <HeartPulse className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">How are you today?</p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Three taps. The session adjusts to the answer instead of to the calendar.
            </p>
          </div>
          {saving && <Loader2 className="text-muted-foreground mt-1 size-4 animate-spin" />}
        </div>

        <div className="space-y-3">
          {READINESS_QUESTIONS.map((question) => {
            const chosen = draft[question.key] ?? (editing ? today?.[question.key] : undefined)
            return (
              <div key={question.key}>
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <p className="text-sm font-medium">{question.prompt}</p>
                  <AnimatePresence mode="wait" initial={false}>
                    {chosen !== undefined && (
                      <motion.span
                        key={chosen}
                        variants={answerPop}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="text-muted-foreground shrink-0 text-xs font-medium"
                      >
                        {question.scale[chosen - 1]}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
                <div
                  role="radiogroup"
                  aria-label={question.prompt}
                  className="grid grid-cols-5 gap-1.5"
                >
                  {question.scale.map((label, index) => {
                    const value = index + 1
                    const selected = chosen === value
                    return (
                      <button
                        key={label}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        /* The button reads "3"; naming it only "Rough" makes
                           it unreachable by voice control, which is the one
                           input method somebody with wrecked legs might be
                           using. The number comes first because it is what is
                           on the screen (WCAG 2.5.3), the word after it
                           because a bare number means nothing spoken aloud. */
                        aria-label={`${question.prompt} ${value}, ${label}`}
                        disabled={saving}
                        onClick={() => void answer(question.key, value)}
                        className={cn(
                          'focus-visible:ring-ring h-10 rounded-lg text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60',
                          selected
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary text-muted-foreground hover:bg-secondary/70',
                        )}
                      >
                        {/* The number carries the scale; the word above names
                            whichever one is chosen, so five labels do not have
                            to fit across a phone. */}
                        {value}
                      </button>
                    )
                  })}
                </div>
                {/* Which end is good, before the first tap rather than after
                    it. A bare row of 1–5 is unanswerable until you have already
                    guessed, and half of those guesses are backwards. */}
                <div
                  className="text-muted-foreground mt-1 flex justify-between text-[0.65rem]"
                  aria-hidden
                >
                  <span>{question.scale[0]}</span>
                  <span>{question.scale[4]}</span>
                </div>
              </div>
            )
          })}
        </div>

        {failed && (
          <p className="text-destructive mt-3 text-xs" role="status">
            That did not save. Tap an answer again to retry.
          </p>
        )}

        {editing && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-3"
            onClick={() => {
              setEditing(false)
              setDraft({})
            }}
          >
            Cancel
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
