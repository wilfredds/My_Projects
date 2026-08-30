import {
  Activity,
  ArrowUp,
  Dumbbell,
  Footprints,
  Gauge,
  GraduationCap,
  ShieldPlus,
  Target,
  Zap,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { Pressable } from '@/components/motion/Pressable'
import { StaggerItem } from '@/components/motion/StaggerItem'
import { Card, CardContent } from '@/components/ui/card'
import type { LibraryEntry } from '@/lib/library/entries'
import { countForFocus, FOCUS_AREAS, type FocusId } from '@/lib/library/focus'
import type { SkillLevel } from '@/lib/data/types'
import { cn } from '@/lib/utils'

/**
 * "What do you want to work on?" — the way in, in place of a flat catalogue.
 *
 * A list of twelve drills only helps someone who already knows which one fixes
 * their problem. A player knows what they want to be better at, not which drill
 * delivers it, so the app asks the question they can actually answer and does
 * the mapping itself.
 */

const ICON: Record<FocusId, typeof Zap> = {
  fundamentals: GraduationCap,
  footwork: Footprints,
  agility: Gauge,
  stamina: Activity,
  strength: Dumbbell,
  power: Zap,
  net: Target,
  'rear-court': ArrowUp,
  prepare: ShieldPlus,
}

interface FocusGridProps {
  entries: LibraryEntry[]
  level: SkillLevel
}

export function FocusGrid({ entries, level }: FocusGridProps) {
  return (
    <ul className="grid grid-cols-2 gap-3">
      {FOCUS_AREAS.map((focus, index) => {
        const Icon = ICON[focus.id]
        const count = countForFocus(entries, focus, { level })
        // An area can be empty at a beginner's level and full at an advanced
        // one — plyometric power work is deliberately held back. "Nothing here"
        // would read as the app being broken; it is something to grow into.
        const everything = countForFocus(entries, focus, { level, showHarder: true })
        const first = focus.id === 'fundamentals'

        return (
          <StaggerItem key={focus.id} index={index}>
            <Pressable className="h-full">
              {/* The beginner path leads, so it reads as the starting point
                  rather than as one option among eight. */}
              <Card
                level={first ? 'lead' : 'default'}
                className="hover:border-primary/50 h-full transition-colors"
              >
                <CardContent className="h-full p-4">
                  <Link to={`/focus/${focus.id}`} className="flex h-full flex-col gap-1.5">
                    <span
                      className={cn(
                        'mb-1 grid size-9 place-items-center rounded-lg',
                        first
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-muted-foreground',
                      )}
                    >
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="leading-tight font-semibold">{focus.title}</span>
                    <span className="text-muted-foreground text-xs leading-snug">{focus.goal}</span>
                    <span className="text-muted-foreground mt-auto pt-2 text-[0.7rem] font-medium">
                      {count > 0
                        ? `${count} to try`
                        : everything > 0
                          ? 'For later — tap to see'
                          : 'Nothing here yet'}
                    </span>
                  </Link>
                </CardContent>
              </Card>
            </Pressable>
          </StaggerItem>
        )
      })}
    </ul>
  )
}
