import { useQuery } from '@tanstack/react-query'
import { Check, Copy, Loader2, Send } from 'lucide-react'
import { useState } from 'react'
import { useLocation } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Segmented } from '@/components/ui/segmented'
import { Switch } from '@/components/ui/switch'
import { useTrainingProfile } from '@/hooks/useTrainingProfile'
import { backupFilename, buildBackup } from '@/lib/data/backup'
import { useRepositories } from '@/lib/data/context'
import { downloadBlob } from '@/lib/download'
import {
  buildReport,
  isSendable,
  MAX_MESSAGE,
  reportFilename,
  TOPIC_LABEL,
  FEEDBACK_TOPICS,
  type FeedbackDraft,
} from '@/lib/feedback/report'
import { cn } from '@/lib/utils'

/**
 * The way somebody tells you this bit is confusing.
 *
 * There is no server to post to and no analytics in this app, so a report is
 * text handed to the share sheet — which on a club player's phone means
 * Messenger, the app they already have open. Copy and download are the
 * fallbacks for a desktop browser without `navigator.share`, and one of the
 * three always works.
 *
 * Attaching the training history is off by default and stays off unless they
 * turn it on, with the contents spelled out next to the switch. It is their
 * data and they are about to send it to another person.
 */
export function FeedbackDialog({ trigger }: { trigger: React.ReactNode }) {
  const repositories = useRepositories()
  const location = useLocation()
  const training = useTrainingProfile()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<FeedbackDraft>({
    topic: 'confusing',
    rating: null,
    message: '',
  })
  const [includeHistory, setIncludeHistory] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  const { data: sessions = [] } = useQuery({
    queryKey: ['sessions', 'all'],
    queryFn: () => repositories.sessions.listRecent(100_000),
  })

  const update = (patch: Partial<FeedbackDraft>) =>
    setDraft((current) => ({ ...current, ...patch }))

  const compose = async (): Promise<string> => {
    let history: string | undefined
    if (includeHistory) {
      const [profile, all, metrics, benchmarks, readiness] = await Promise.all([
        repositories.profiles.get(),
        repositories.sessions.listRecent(100_000),
        repositories.sessions.listAllMetrics(),
        repositories.benchmarks.list(),
        repositories.readiness.listRecent(100_000),
      ])
      history = JSON.stringify(
        buildBackup({ profile, sessions: all, metrics, benchmarks, readiness }),
      )
    }
    return buildReport(
      draft,
      {
        path: location.pathname,
        build: __APP_BUILD__,
        level: training.level,
        discipline: training.discipline,
        sessions: sessions.length,
        viewport: `${window.innerWidth}×${window.innerHeight}`,
        userAgent: navigator.userAgent,
      },
      history,
    )
  }

  const send = async () => {
    setBusy(true)
    setDone(null)
    try {
      const report = await compose()
      // Share first: it is one tap into the app they already talk to people in.
      if (navigator.share) {
        await navigator.share({ title: 'RallyReady feedback', text: report })
        setDone('Thank you — sent.')
      } else {
        await navigator.clipboard.writeText(report)
        setDone('Copied. Paste it wherever you like.')
      }
    } catch {
      // A cancelled share sheet lands here too, which is not an error worth
      // shouting about — the download is always there.
      setDone(null)
    } finally {
      setBusy(false)
    }
  }

  const saveFile = async () => {
    setBusy(true)
    try {
      const report = await compose()
      downloadBlob(new Blob([report], { type: 'text/plain' }), reportFilename())
      setDone(`Saved as ${includeHistory ? backupFilename() : reportFilename()}.`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setDone(null)
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tell me what is wrong with it</DialogTitle>
          <DialogDescription>
            Anything at all — confusing, broken, boring, too hard. Blunt is more useful than polite.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <Label className="mb-2 block">What is this about?</Label>
            <div className="flex flex-wrap gap-1.5">
              {FEEDBACK_TOPICS.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => update({ topic })}
                  aria-pressed={draft.topic === topic}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                    draft.topic === topic
                      ? 'border-primary bg-accent text-accent-foreground'
                      : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  {TOPIC_LABEL[topic]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="feedback-message" className="mb-2 block">
              What happened?
            </Label>
            <textarea
              id="feedback-message"
              rows={5}
              maxLength={MAX_MESSAGE}
              value={draft.message}
              onChange={(event) => update({ message: event.target.value })}
              placeholder="I opened the rally drill and the calls came too fast to hear the shot…"
              className="border-input bg-background focus-visible:ring-ring w-full rounded-lg border p-3 text-sm leading-relaxed focus-visible:ring-2 focus-visible:outline-none"
            />
          </div>

          <div>
            <Label className="mb-2 block">How was the session?</Label>
            <Segmented
              label="How was the session"
              value={draft.rating ?? 'none'}
              options={[
                { value: 'none', label: 'Skip' },
                { value: 'bad', label: 'Poor' },
                { value: 'ok', label: 'Fine' },
                { value: 'good', label: 'Good' },
              ]}
              onChange={(value) =>
                update({ rating: value === 'none' ? null : (value as FeedbackDraft['rating']) })
              }
            />
          </div>

          <div className="border-border flex items-start gap-3 rounded-lg border p-3">
            <Switch
              id="include-history"
              checked={includeHistory}
              onCheckedChange={setIncludeHistory}
            />
            <div className="min-w-0">
              <Label htmlFor="include-history" className="text-sm font-medium">
                Attach my training history
              </Label>
              <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                The sessions you have logged, so the drills you actually ran can be looked at. No
                name, email or account — there is none of that in this app. Off unless you turn it
                on.
              </p>
            </div>
          </div>

          {done && <p className="text-primary text-sm font-medium">{done}</p>}

          <div className="flex flex-wrap gap-2">
            <Button onClick={send} disabled={!isSendable(draft) || busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Send />}
              Send
            </Button>
            <Button variant="outline" onClick={saveFile} disabled={!isSendable(draft) || busy}>
              {done?.startsWith('Saved') ? <Check /> : <Copy />}
              Save as a file
            </Button>
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Send opens your phone&rsquo;s share sheet — Messenger, email, whatever you use. Nothing
            leaves this device until you pick one.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
