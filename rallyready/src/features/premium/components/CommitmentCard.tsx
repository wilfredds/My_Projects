import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Check, ShieldCheck, X } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { useRepositories } from '@/lib/data/context'
import {
  creditedEnd,
  daysUntil,
  promiseStatus,
  summarise,
  weeksOf,
  type WeekDelivery,
} from '@/lib/premium/commitment'
import { BUNDLES, isUnlocked } from '@/lib/premium/entitlements'
import { cn, pluralize } from '@/lib/utils'
import { usePremium } from '@/store/premiumStore'

/**
 * The account: what was bought, and what was delivered.
 *
 * Written to be uncomfortable to read when the app has not held up its end.
 * Every number on it is derived from sessions that were actually logged and
 * from the same entitlement function the rest of the app gates on, so there is
 * no way for this screen to claim something the app is quietly refusing.
 *
 * It reports both sides. Weeks the player fell short are shown, and so are
 * weeks premium did not cover — and those are added back to the end date
 * rather than mentioned and forgotten.
 */

const DATE = { day: 'numeric', month: 'short' } as const

/** Below this a run is a tap, not a session. */
const MIN_SESSION_SEC = 120

function WeekStrip({ weeks }: { weeks: WeekDelivery[] }) {
  return (
    <ol className="mt-3 flex flex-wrap gap-1" aria-label="Week by week">
      {weeks.map((week) => (
        <li
          key={week.index}
          title={
            week.state === 'uncovered'
              ? `Week ${week.index}: not covered — credited back`
              : week.state === 'future'
                ? `Week ${week.index}: still to come`
                : `Week ${week.index}: ${week.done} of ${week.asked} sessions`
          }
          className={cn(
            'tnum grid h-7 w-7 place-items-center rounded-md text-[0.65rem] font-bold',
            week.state === 'met' && 'bg-primary text-primary-foreground',
            week.state === 'short' && 'bg-work/25 text-foreground',
            week.state === 'current' && 'border-primary text-foreground border-2',
            week.state === 'future' && 'bg-secondary text-muted-foreground',
            week.state === 'uncovered' && 'bg-destructive/20 text-destructive',
          )}
        >
          {week.state === 'future' ? week.index : week.state === 'uncovered' ? '—' : week.done}
        </li>
      ))}
    </ol>
  )
}

export function CommitmentCard() {
  const premium = usePremium()
  const repositories = useRepositories()

  /*
   * The clock, read once when the card opens.
   *
   * Reading it during render would be impure, and a ticking clock is wrong
   * here anyway: the week you are in and the days you have left must not
   * change under you because something else on the page re-rendered.
   */
  const [now] = useState(() => Date.now())

  const { data: sessions = [] } = useQuery({
    queryKey: ['sessions', 'all'],
    queryFn: () => repositories.sessions.listRecent(500),
  })

  const commitment = premium.commitment
  if (!commitment) return null

  /*
   * What counts as a session towards the block.
   *
   * Anything logged and longer than two minutes. Not "completed", because
   * stopping a drill early on a bad day is a legitimate session and the app
   * has spent this whole feature arguing that the plan should adapt to you.
   * But a run abandoned after twenty seconds is a tap, not training, and
   * counting it would flatter both sides of this account.
   */
  const times = sessions
    .filter((session) => session.durationSec >= MIN_SESSION_SEC)
    .map((session) => new Date(session.startedAt).getTime())
    .filter((at) => Number.isFinite(at))

  const weeks = weeksOf(commitment, times, now, premium.expiresAt ?? commitment.endsAt)
  const account = summarise(weeks, now)
  const endsAt = creditedEnd(commitment, weeks)
  const bundle = BUNDLES.find((entry) => entry.id === commitment.bundleId)
  const promises = promiseStatus(premium.tier, isUnlocked)
  const left = daysUntil(endsAt, now)

  return (
    <Card level="lead" className="mb-6">
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <span className="bg-primary text-primary-foreground grid size-10 shrink-0 place-items-center rounded-xl">
            <ShieldCheck className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="type-eyebrow text-primary">What you bought</p>
            <h2 className="type-headline mt-1 text-xl">{bundle?.name ?? 'Premium'}</h2>
            <p className="text-muted-foreground type-body mt-1">
              Started {new Date(commitment.startedAt).toLocaleDateString(undefined, DATE)} · runs to{' '}
              {new Date(endsAt).toLocaleDateString(undefined, DATE)} ·{' '}
              {left > 0 ? `${pluralize(left, 'day')} left` : 'finished'}
            </p>
          </div>
        </div>

        {/* Their side of it. */}
        <div className="border-border mt-4 border-t pt-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-semibold">
              {account.currentWeek
                ? `Week ${account.currentWeek} of ${account.totalWeeks}`
                : `${pluralize(account.totalWeeks, 'week')}, finished`}
            </p>
            <p className="tnum text-muted-foreground type-meta">
              {account.doneSoFar} of {account.askedSoFar} sessions
            </p>
          </div>
          <WeekStrip weeks={weeks} />
          <p className="text-muted-foreground type-meta mt-2.5 leading-relaxed">
            {account.elapsedWeeks === 0
              ? `The block asks for ${pluralize(commitment.sessionsPerWeek, 'session')} a week. Nothing to report yet.`
              : account.onTrack
                ? 'Everything the block has asked for so far, done.'
                : `${pluralize(account.shortfall, 'session')} behind what the block asked for. Not a judgement — the plan adapts, and the number is here so it is not a surprise.`}
          </p>
        </div>

        {/* Our side of it. */}
        <div className="border-border mt-4 border-t pt-4">
          <p className="text-sm font-semibold">What we said you would get</p>
          <ul className="mt-2 space-y-1.5">
            {promises.map((promise) => (
              <li key={promise.id} className="flex items-start gap-2">
                {promise.live ? (
                  <Check className="text-primary mt-0.5 size-3.5 shrink-0" aria-hidden />
                ) : (
                  <X className="text-destructive mt-0.5 size-3.5 shrink-0" aria-hidden />
                )}
                <span
                  className={cn(
                    'type-meta leading-relaxed',
                    promise.live ? 'text-muted-foreground' : 'text-destructive',
                  )}
                >
                  {promise.name}
                  {!promise.live && ' — not on'}
                </span>
              </li>
            ))}
          </ul>

          {account.uncoveredWeeks > 0 && (
            <p className="border-destructive/40 bg-destructive/10 text-foreground type-meta mt-3 rounded-lg border p-3 leading-relaxed">
              <span className="font-semibold">
                {pluralize(account.uncoveredWeeks, 'week')} of this block was not covered.
              </span>{' '}
              You paid for it and we did not supply it, so it has been added to the end date above.
              You do not have to ask.
            </p>
          )}
        </div>

        <p className="text-muted-foreground type-meta border-border mt-4 border-t pt-4 leading-relaxed">
          Every figure here comes from sessions you actually logged and from the same switches the
          app itself checks — this card cannot claim something the app is refusing you. Your
          history, the drills, the warm-up and the safety features never expire, whatever happens to
          this block.
        </p>
      </CardContent>
    </Card>
  )
}
