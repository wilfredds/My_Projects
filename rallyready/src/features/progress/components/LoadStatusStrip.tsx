import { AlertTriangle, ArrowDownRight, ArrowUpRight, Check, Hourglass } from 'lucide-react'

import { LOAD_STATUS_COPY, loadHeadroom, type LoadStatus, type LoadSummary } from '@/lib/data/load'
import { cn } from '@/lib/utils'

/**
 * How this week compares to the month behind it, in one line.
 *
 * The number underneath is the acute:chronic workload ratio — this week's load
 * against the recent weekly average. It is the closest thing amateur sport has
 * to an early warning for overuse injury, and it is exactly the thing a solo
 * player has nobody to spot for them. Withheld entirely until there is a month
 * of history, because before that it says "spike" to everyone who has just
 * started, which is both wrong and the fastest way to teach someone to ignore
 * a warning.
 */

const TONE: Record<LoadStatus, { icon: typeof Check; className: string }> = {
  settling: { icon: Hourglass, className: 'bg-secondary text-muted-foreground' },
  detraining: { icon: ArrowDownRight, className: 'bg-rest/15 text-rest' },
  steady: { icon: Check, className: 'bg-work/15 text-work' },
  building: { icon: ArrowUpRight, className: 'bg-sprint/15 text-sprint' },
  spiking: { icon: AlertTriangle, className: 'bg-destructive/15 text-destructive' },
}

export function LoadStatusStrip({ load }: { load: LoadSummary }) {
  const copy = LOAD_STATUS_COPY[load.status]
  const { icon: Icon, className } = TONE[load.status]
  const headroom = loadHeadroom(load)

  return (
    <div className="border-border rounded-xl border p-3.5">
      <div className="flex items-start gap-3">
        <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg', className)}>
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{copy.label}</p>
          <p className="text-muted-foreground text-xs leading-relaxed">{copy.blurb}</p>
        </div>
      </div>

      {/* Rolling seven-day windows, said out loud — the bars below this are
          calendar weeks, and two different "weeks" in one card is how a number
          stops being believed. */}
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Figure label="Last 7 days" value={String(load.last7)} />
        <Figure label="Previous 7" value={String(load.previous7)} />
        <Figure
          label={load.ratio === null ? 'Compared' : 'vs your usual'}
          value={load.ratio === null ? '—' : `${load.ratio.toFixed(2)}×`}
        />
      </dl>

      {headroom !== null && load.status !== 'spiking' && (
        <p className="text-muted-foreground mt-2.5 text-xs leading-relaxed">
          {headroom > 0
            ? `You have room for about ${Math.round(headroom / 7)} more hard minutes a day this week. After that it counts as a big jump.`
            : 'You have done enough for this week. Anything more is a jump, not a repeat.'}
        </p>
      )}
    </div>
  )
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    // Full height with the number pushed to the bottom, so a label that wraps
    // to two lines on a narrow phone does not leave one figure sitting lower
    // than the two beside it.
    <div className="bg-secondary/50 flex h-full flex-col justify-between rounded-lg px-2 py-2">
      <dt className="text-muted-foreground text-[0.65rem] font-medium tracking-wide uppercase">
        {label}
      </dt>
      <dd className="tnum mt-0.5 text-lg font-bold tracking-tight">{value}</dd>
    </div>
  )
}
