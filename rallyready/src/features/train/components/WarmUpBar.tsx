import { Check, Flame, Snowflake } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { isStillWarm, useUiStore } from '@/store/uiStore'

/**
 * The warm-up prompt, sitting directly under the drill it is preparing you for.
 *
 * It disappears once you have actually warmed up, rather than sitting there
 * permanently. A prompt that is always on screen is one you stop seeing, and
 * this is the one piece of advice in the app that prevents an injury rather
 * than improving a shot.
 */
export function WarmUpBar() {
  const lastWarmupAt = useUiStore((state) => state.lastWarmupAt)
  const warm = isStillWarm(lastWarmupAt)

  if (warm) {
    return (
      <div className="text-muted-foreground mb-6 flex items-center justify-between gap-3 px-1 text-xs">
        <span className="inline-flex items-center gap-1.5">
          <Check className="text-primary-ink size-3.5" aria-hidden />
          Warmed up — you are good to go.
        </span>
        <Button asChild variant="ghost" size="sm" className="text-xs">
          <Link to="/run/cooldown-stretch">
            <Snowflake />
            Cool down
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="border-border bg-secondary/30 mb-6 rounded-xl border p-3">
      <div className="flex items-center gap-3">
        <span className="bg-work/15 text-work-ink grid size-9 shrink-0 place-items-center rounded-lg">
          <Flame className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Warm up first</p>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Ankles, hips and shoulders, then something sharp. Five minutes now beats six weeks off.
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button asChild className="flex-1">
          <Link to="/run/warmup-full">Full · 6 min</Link>
        </Button>
        <Button asChild variant="outline" className="flex-1">
          <Link to="/run/warmup-quick">Quick · 3 min</Link>
        </Button>
      </div>
    </div>
  )
}
