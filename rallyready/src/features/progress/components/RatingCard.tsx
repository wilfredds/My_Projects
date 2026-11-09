import { Lock, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { PlayerRating } from '@/lib/coach/rating'
import { MAX_RATING } from '@/lib/coach/rating'
import { cn } from '@/lib/utils'
import { usePremium } from '@/store/premiumStore'

/**
 * One number for how well you are training, and where it came from.
 *
 * The rating itself is free — a number you cannot see is not motivating anyone,
 * and the point of it is that it pulls people back. What Premium buys is the
 * breakdown: which of the five parts is holding you back and what to do about
 * it. That is analysis rather than a scoreboard.
 */
export function RatingCard({ rating }: { rating: PlayerRating }) {
  const premium = usePremium()
  const detailed = premium.has('deep-analytics')

  return (
    <Card className="mb-5">
      <CardContent className="p-5">
        <div className="flex items-center gap-4">
          <Ring value={rating.points} />
          <div className="min-w-0 flex-1">
            <p className="text-muted-foreground type-eyebrow">Training rating</p>
            <p className="text-2xl leading-tight font-bold tracking-tight">{rating.tier.name}</p>
            <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
              {rating.toNextTier === null
                ? rating.tier.blurb
                : `${rating.toNextTier} more to reach the next tier.`}
            </p>
          </div>
        </div>

        {detailed ? (
          <>
            <ul className="mt-4 space-y-2.5">
              {rating.components.map((component) => (
                <li key={component.key}>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                    <span className="font-medium">{component.label}</span>
                    <span className="text-muted-foreground tnum">
                      {component.points}/{component.max}
                    </span>
                  </div>
                  <div className="bg-secondary h-1.5 overflow-hidden rounded-full">
                    <div
                      className="bg-primary h-full rounded-full transition-[width] duration-500"
                      style={{ width: `${(component.points / component.max) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>

            <div className="bg-secondary/60 mt-4 flex items-start gap-2.5 rounded-lg p-3">
              <TrendingUp className="text-primary-ink mt-0.5 size-4 shrink-0" aria-hidden />
              <p className="text-xs leading-relaxed">
                <span className="font-semibold">Biggest gain: {rating.weakest.label}.</span>{' '}
                <span className="text-muted-foreground">{rating.weakest.hint}</span>
              </p>
            </div>
          </>
        ) : (
          <div className="border-border mt-4 rounded-lg border border-dashed p-3">
            <p className="flex items-center gap-2 text-xs font-medium">
              <Lock className="text-muted-foreground size-3.5" aria-hidden />
              Five things make up this number
            </p>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              Premium shows the breakdown and names the one holding you back.
            </p>
            <Button asChild size="sm" variant="outline" className="mt-2.5">
              <Link to="/premium">See the breakdown</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/** The rating as a ring, because a bare number does not read as progress. */
function Ring({ value }: { value: number }) {
  const size = 84
  const stroke = 8
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const filled = Math.min(1, Math.max(0, value / MAX_RATING))

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="stroke-secondary"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className={cn('stroke-primary transition-[stroke-dashoffset] duration-700')}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - filled)}
        />
      </svg>
      <span className="tnum absolute inset-0 grid place-items-center text-xl font-bold tracking-tight">
        {value}
      </span>
    </div>
  )
}
