import { motion } from 'framer-motion'

import { badgeIcon, TIER_LABEL, TIER_STYLE } from '@/components/badges/badgeVisuals'
import { Card, CardContent } from '@/components/ui/card'
import { badgeBySlug } from '@/lib/data/badges'
import { listItemVariants, rewardVariants, useInitialSafe, useMotionSafe } from '@/lib/motion'
import { cn } from '@/lib/utils'

import { Confetti } from './Confetti'

/**
 * The moment a badge is earned.
 *
 * Shown once, on the screen where the work that earned it was done — a trophy
 * you have to go and look for in a menu is not a reward, it is an inventory.
 * Deciding *whether* this appears is `useRewards`; this file only knows how it
 * looks.
 *
 * The single pass of light across the tile is the `shine` keyframe, which is
 * defined to run exactly once. It must never loop: a badge that keeps glinting
 * turns into a notification dot you learn to ignore.
 */
export function BadgeUnlock({ slugs }: { slugs: string[] }) {
  const reward = useMotionSafe(rewardVariants)
  const item = useMotionSafe(listItemVariants)
  const initial = useInitialSafe('hidden')

  const badges = slugs.map((slug) => badgeBySlug(slug)).filter((badge) => badge !== undefined)
  if (badges.length === 0) return null

  // No `overflow-hidden` on the card: the paper is meant to leave it. The icon
  // tile below keeps its own, because the shine must not.
  return (
    <Card level="lead" className="relative mb-5">
      <Confetti count={18} />
      <CardContent className="relative p-5">
        <p className="text-primary-ink type-eyebrow mb-3">
          {badges.length === 1 ? 'Badge unlocked' : `${badges.length} badges unlocked`}
        </p>
        <ul className="space-y-3">
          {badges.map((badge, index) => {
            const Icon = badgeIcon(badge.icon)
            return (
              <motion.li
                key={badge.slug}
                custom={index}
                variants={item}
                initial={initial}
                animate="visible"
                className="flex items-center gap-3"
              >
                <motion.span
                  variants={reward}
                  initial={initial}
                  animate="visible"
                  className={cn(
                    'relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-2xl',
                    TIER_STYLE[badge.tier],
                  )}
                >
                  <Icon className="size-6" aria-hidden />
                  {/* One pass of light, then gone for good. */}
                  <span className="animate-shine absolute inset-y-0 -left-full w-full bg-white/70" />
                </motion.span>
                <div className="min-w-0">
                  <p className="leading-snug font-semibold">{badge.name}</p>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    {TIER_LABEL[badge.tier]} · {badge.description}
                  </p>
                </div>
              </motion.li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
