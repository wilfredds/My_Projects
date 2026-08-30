import { useEffect, useMemo, useState } from 'react'

import type { MobilityPose } from '@/lib/data/seed/exercises'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import {
  blend,
  build,
  marginFor,
  movingPart,
  racketHead,
  travel,
  figureBox,
  GROUND,
  HEAD_LONG,
  HEAD_R,
  HEAD_SHORT,
  VIEW_W,
  type Point,
} from '@/lib/figures/skeleton'
import { cn } from '@/lib/utils'

/**
 * A jointed figure for warm-up movements, stretches and technique swings.
 *
 * The original figure was parametric — squat depth, air, tuck, arm swing — which
 * works for a jump squat and cannot express an arm circle, a leg swing or a
 * torso twist at all. Those came out as a stick man shuffling vaguely, which is
 * worse than no picture.
 *
 * This one is driven by actual joint angles, so a movement is drawn the way it
 * is performed. Two things make it readable rather than merely accurate:
 *
 *  - it interpolates between keyframes, so you see the movement rather than a
 *    slideshow of positions;
 *  - it draws a motion arc on whichever hand or foot travelled furthest since
 *    the last keyframe. On an exercise diagram the arrow is what tells you what
 *    to do; the pose only tells you where to start.
 *
 * The geometry itself lives in `lib/figures/skeleton.ts`, where it can be
 * tested. This file is only the drawing.
 */

const MS_PER_FRAME = 900

interface MobilityDemoProps {
  poses: MobilityPose[]
  animated?: boolean
  /**
   * Puts a racket in that hand. Warm-up movements pass nothing; technique
   * topics pass a side, which is what turns this renderer into a swing
   * diagram without a second copy of the skeleton.
   */
  racket?: 'left' | 'right' | null
  className?: string
}

export function MobilityDemo({
  poses,
  animated = true,
  racket = null,
  className,
}: MobilityDemoProps) {
  const reducedMotion = useReducedMotion()
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    if (!animated || reducedMotion || poses.length < 2) return
    const started = performance.now()
    let frame = 0
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)
      setPhase(((now - started) / MS_PER_FRAME) % poses.length)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [animated, reducedMotion, poses.length])

  const index = Math.floor(phase) % poses.length
  const next = poses[(index + 1) % poses.length] ?? poses[0]!
  const current = poses[index] ?? poses[0]!

  // Hold each keyframe for the first 40% of its slot, then travel to the next.
  // Blending continuously makes the figure look like it is swaying rather than
  // hitting the positions being taught.
  const HOLD = 0.4
  const raw = phase - index
  const t = reducedMotion || !animated ? 0 : raw < HOLD ? 0 : (raw - HOLD) / (1 - HOLD)

  const shown = t === 0 ? current : blend(current, next, t)
  const figure = build(shown)
  const held = racket ? racketHead(figure, racket) : null

  // With a racket in hand the head is the thing that travels, and the thing the
  // player is being taught to move. Arrowing a wrist instead would point at the
  // least interesting part of a smash.
  const fromFigure = build(current)
  const toFigure = build(next)
  const arc = racket
    ? travel(racketHead(fromFigure, racket).head, racketHead(toFigure, racket).head)
    : movingPart(fromFigure, toFigure)

  // Memoised because it builds every keyframe and a few blends, and this
  // component re-renders on every animation frame.
  const box = useMemo(() => figureBox(poses, racket), [poses, racket])
  const margin = marginFor(racket)

  const bone = (a: Point, b: Point, key: string, faded = false) => (
    <line
      key={key}
      x1={a.x}
      y1={a.y}
      x2={b.x}
      y2={b.y}
      className={faded ? 'stroke-foreground/45' : 'stroke-foreground'}
      strokeWidth="4.2"
      strokeLinecap="round"
    />
  )

  return (
    <svg
      // Cropped to what this sequence actually uses, top edge only. A racket
      // adds roughly a forearm's reach sideways and a follow-through swings it
      // well past where a bare hand ever goes, so the box grows outwards for a
      // swing rather than the figure shrinking inside it.
      viewBox={box.viewBox}
      className={cn('h-full w-full', className)}
      role="img"
      aria-label={`Movement demonstration: ${current.label}`}
    >
      <line
        x1={-margin + 12}
        y1={GROUND}
        x2={VIEW_W + margin - 12}
        y2={GROUND}
        className="stroke-court-line"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Motion arc first, so the limbs sit on top of it. */}
      {arc && (
        <g className="stroke-primary fill-primary">
          <path
            d={`M ${arc.from.x} ${arc.from.y} Q ${(arc.from.x + arc.to.x) / 2 + (arc.to.y - arc.from.y) * 0.35} ${
              (arc.from.y + arc.to.y) / 2 - (arc.to.x - arc.from.x) * 0.35
            } ${arc.to.x} ${arc.to.y}`}
            fill="none"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeDasharray="5 4"
            opacity="0.85"
          />
          <circle cx={arc.to.x} cy={arc.to.y} r="3.4" stroke="none" opacity="0.9" />
        </g>
      )}

      {/* Far-side limbs faded, so left and right read apart. */}
      {bone(figure.shoulderL, figure.elbowL, 'ul-l', true)}
      {bone(figure.elbowL, figure.handL, 'fa-l', true)}
      {bone(figure.hipL, figure.kneeL, 'th-l', true)}
      {bone(figure.kneeL, figure.footL, 'sh-l', true)}

      {bone(figure.hip, figure.neck, 'spine')}
      {bone(figure.shoulderL, figure.shoulderR, 'shoulders')}
      {bone(figure.hipL, figure.hipR, 'hips')}

      {bone(figure.shoulderR, figure.elbowR, 'ul-r')}
      {bone(figure.elbowR, figure.handR, 'fa-r')}
      {bone(figure.hipR, figure.kneeR, 'th-r')}
      {bone(figure.kneeR, figure.footR, 'sh-r')}

      {/* Racket last, over the arm holding it. */}
      {held && racket && (
        <g className="stroke-primary">
          <line
            x1={racket === 'right' ? figure.handR.x : figure.handL.x}
            y1={racket === 'right' ? figure.handR.y : figure.handL.y}
            x2={held.head.x}
            y2={held.head.y}
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <ellipse
            cx={held.head.x}
            cy={held.head.y}
            rx={HEAD_LONG}
            ry={HEAD_SHORT}
            className="fill-primary/15 stroke-primary"
            strokeWidth="2.4"
            transform={`rotate(${held.angleDeg} ${held.head.x} ${held.head.y})`}
          />
        </g>
      )}

      <circle cx={figure.head.x} cy={figure.head.y} r={HEAD_R} className="fill-foreground" />

      {/* Keep pose labels to about 22 characters: at this size anything longer
          runs off the canvas, and an SVG has no way to wrap it. The size comes
          from the box rather than a class so that cropping the drawing does not
          also blow the caption up. */}
      <text
        x="50"
        y={box.labelY}
        fontSize={box.labelSize}
        textAnchor="middle"
        className="fill-muted-foreground font-semibold tracking-wide"
      >
        {shown.label.toUpperCase()}
      </text>
    </svg>
  )
}
