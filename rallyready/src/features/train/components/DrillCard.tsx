import { Dumbbell, Home, MapPin, Play } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Pressable } from '@/components/motion/Pressable'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { Drill } from '@/lib/data/types'
import { useTrainingProfile } from '@/hooks/useTrainingProfile'
import { configFromDrill, estimateDurationSec } from '@/lib/timer/plan'
import type { DrillConfig } from '@/lib/timer/plan'
import { formatCompactDuration, pluralize } from '@/lib/utils'

import { CATEGORY_LABEL, LEVEL_LABEL } from '../drillLabels'

interface DrillCardProps {
  drill: Drill
  /** The user's saved setup, if they have one. */
  config?: DrillConfig
}

/**
 * A drill in a list.
 *
 * Two targets, the way a track listing works: the body opens the drill so you
 * can read the cues and adjust it, and the round button starts it immediately.
 * It used to be a full-width solid button per card, which meant six identical
 * accent slabs down one screen and no way to tell the recommended drill from
 * the rest of the catalogue.
 */
export function DrillCard({ drill, config }: DrillCardProps) {
  // Falls back to this player's own settings rather than the drill's raw
  // defaults: a card that says 8 min next to a drill that will run for 13 is
  // worse than no number at all.
  const training = useTrainingProfile()
  const resolved = config ?? configFromDrill(drill, training)
  const isCircuit = drill.circuit !== null && drill.circuit.length > 0
  const Where = drill.location === 'anywhere' ? Home : MapPin

  return (
    <Pressable className="h-full">
      <Card className="hover:border-primary/50 group/card relative h-full transition-colors">
        <CardContent className="flex h-full items-start gap-3 p-4">
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex flex-wrap gap-1.5">
              <Badge>{CATEGORY_LABEL[drill.category]}</Badge>
              <Badge variant="outline">{LEVEL_LABEL[drill.level]}</Badge>
            </div>

            {/* Stretched so the whole card body is the tap target, without
              nesting the play button inside another link. */}
            <h3 className="leading-snug font-semibold">
              <Link to={`/train/${drill.slug}`} className="after:absolute after:inset-0">
                {drill.name}
              </Link>
            </h3>

            <p className="text-muted-foreground mt-1 line-clamp-2 text-sm leading-relaxed">
              {drill.description}
            </p>

            <p className="text-muted-foreground tnum mt-2 flex flex-wrap items-center gap-x-1.5 text-xs">
              <Where className="size-3.5 shrink-0" aria-hidden />
              {formatCompactDuration(estimateDurationSec(resolved))}
              <span aria-hidden>·</span>
              {isCircuit
                ? `${pluralize(drill.circuit?.length ?? 0, 'exercise')} × ${pluralize(drill.circuitRounds, 'round')}`
                : `${drill.corners} zones · ${drill.defaultWorkSec}s / ${drill.defaultRestSec}s × ${drill.defaultRounds}`}
              {drill.equipment.length > 0 && (
                <>
                  <span aria-hidden>·</span>
                  <Dumbbell className="size-3.5 shrink-0" aria-hidden />
                  {drill.equipment.join(', ')}
                </>
              )}
            </p>
          </div>

          {/* Above the stretched link, so it wins the tap it is under. */}
          <Link
            to={`/run/${drill.slug}`}
            aria-label={`Start ${drill.name}`}
            title={`Start ${drill.name}`}
            className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring focus-visible:ring-offset-background relative z-10 grid size-11 shrink-0 place-items-center rounded-full transition-transform active:scale-95 focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            <Play className="size-4 fill-current" aria-hidden />
          </Link>
        </CardContent>
      </Card>
    </Pressable>
  )
}
