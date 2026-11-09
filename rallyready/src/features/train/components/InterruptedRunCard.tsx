import { useQueryClient } from '@tanstack/react-query'
import { History, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useRepositories } from '@/lib/data/context'
import {
  clearCheckpoint,
  readCheckpoint,
  sessionFrom,
  type InterruptedRun,
} from '@/lib/training/interrupted'
import { cn, formatCompactDuration } from '@/lib/utils'

/**
 * "The phone closed the app" — and the choice of what to do about it.
 *
 * Shown on Train, where the app reopens from the home screen, and above Start
 * on the runner, where Android puts you back when it reloads a thrown-away
 * tab. Saving goes to the summary, as ending the drill would have.
 */
export function InterruptedRunCard({ className }: { className?: string }) {
  const repositories = useRepositories()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  // Read once: this is storage on the phone, not a query, so it is already
  // there on the first render.
  const [run, setRun] = useState<InterruptedRun | null>(() => readCheckpoint())
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)

  if (!run) return null

  const save = async () => {
    setSaving(true)
    setFailed(false)
    try {
      const { input, metrics } = sessionFrom(run)
      const session = await repositories.sessions.create(input, metrics)
      clearCheckpoint()
      await queryClient.invalidateQueries()
      navigate(`/session/${session.id}`)
    } catch {
      setFailed(true)
      setSaving(false)
    }
  }

  const discard = () => {
    clearCheckpoint()
    setRun(null)
  }

  return (
    <Card level="lead" className={cn('mb-5', className)}>
      <CardContent className="flex items-start gap-3 p-4">
        <span className="bg-secondary grid size-9 shrink-0 place-items-center rounded-xl">
          <History className="text-primary-ink size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Your last drill was cut short</p>
          <p className="text-muted-foreground mt-0.5 text-sm leading-relaxed">
            {/* "14 min", not "14:22", which reads as a time of day. */}
            The phone closed the app {formatCompactDuration(run.input.durationSec)} into{' '}
            {run.input.drillName ?? 'a drill'}. Keep what you did?
          </p>
          {failed && (
            <p role="status" className="text-destructive mt-1 text-xs">
              Could not save it on this phone.
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => void save()} disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              Save it
            </Button>
            <Button size="sm" variant="ghost" onClick={discard} disabled={saving}>
              Don&rsquo;t save
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
