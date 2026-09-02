import type { MobilityPose } from '@/lib/data/seed/exercises'

/**
 * The geometry behind every jointed figure the app draws — warm-up movements,
 * stretches and technique swings alike.
 *
 * Pulled out of the component because every single defect in these figures so
 * far has been found by rendering one and squinting at it: a figure floating
 * above the floor, an arrow attached to the faded far-side limb, a racket
 * swinging off the edge of the canvas, and a "land wide" stance that was
 * actually drawn leaning. Squinting does not scale to fifty poses. As plain
 * functions over numbers, the things that matter — feet on the floor, a wide
 * stance actually being wide — can be asserted instead.
 *
 * ## The sign convention
 *
 * Every angle is degrees away from straight down, and **positive always means
 * away from the body's centreline**, on both sides. The mirroring is done here,
 * so a symmetric pose is written with the same number on the left and the
 * right. Writing `legL: -16, legR: 16` does not produce a wide stance; it
 * produces a figure leaning to one side with its feet together.
 *
 * ## Profile poses
 *
 * That mirroring is precisely what makes the default a *front* view, and it is
 * why a glute bridge could not be drawn at all: both legs have to move
 * together, in the plane you are looking through, and mirroring splays them
 * apart instead. `pose.profile` turns the mirroring off — both limbs take the
 * same side — so an angle becomes "degrees forward from straight down" and the
 * body is seen edge-on. The shoulders and hips narrow to almost nothing at the
 * same time, because that is what a torso looks like from the side.
 */

export const VIEW_W = 100
export const VIEW_H = 148
export const GROUND = 132

// Derived from the ground rather than guessed, so a straight leg lands exactly
// on the line instead of floating above it.
export const THIGH = 21
export const SHIN = 21
export const HIP_Y = GROUND - THIGH - SHIN
export const SHOULDER_Y = HIP_Y - 34
export const HEAD_Y = SHOULDER_Y - 14
export const HEAD_R = 8.5

export const SHOULDER_HALF = 11
export const HIP_HALF = 7.5
/** Half-width of a torso seen edge-on. Enough to keep the far limb behind. */
export const PROFILE_HALF = 2.5
export const UPPER_ARM = 15
export const FOREARM = 14

/** Racket dimensions, for the technique swings. */
export const SHAFT = 20
export const HEAD_LONG = 11
export const HEAD_SHORT = 8
/**
 * Side room a swung racket needs beyond the figure's own bounds.
 *
 * Sized from the worst case rather than tuned until the current poses fit: a
 * leaning torso puts the shoulder around x=67, and from there an arm, a shaft
 * and half a racket head add another 60. Guessing low here means a new pose
 * quietly loses its racket off the edge of the canvas.
 */
export const RACKET_MARGIN = 34
/**
 * Breathing room for a bare figure. A forward lean slides the whole upper body
 * sideways — the neck pivots from the hip — so a wall-press stretch with the
 * arms out reaches past the nominal width without any single angle looking
 * extreme. Cheaper to give every figure a margin than to file the corners off
 * the poses that need it.
 */
export const FIGURE_MARGIN = 14

export const marginFor = (racket: 'left' | 'right' | null) =>
  racket ? RACKET_MARGIN : FIGURE_MARGIN

const rad = (deg: number) => (deg * Math.PI) / 180

/**
 * The joints that can hold weight.
 *
 * Grounding used to look only at feet and knees, which is right for every pose
 * you do standing up and wrong for every pose you do on the floor: a push-up is
 * held on the hands, a plank on the elbows, a glute bridge on the shoulders and
 * heels. The head is excluded because nobody trains on their head.
 */
const SUPPORTS = [
  'handL',
  'handR',
  'elbowL',
  'elbowR',
  'shoulderL',
  'shoulderR',
  'hipL',
  'hipR',
  'kneeL',
  'kneeR',
  'footL',
  'footR',
] as const

/** Rotates a point about a pivot. Positive tips the figure forward, onto its front. */
function rotate(point: Point, pivot: Point, deg: number): Point {
  if (deg === 0) return point
  const s = Math.sin(rad(deg))
  const c = Math.cos(rad(deg))
  const dx = point.x - pivot.x
  const dy = point.y - pivot.y
  return { x: pivot.x + dx * c - dy * s, y: pivot.y + dx * s + dy * c }
}

export interface Point {
  x: number
  y: number
}

/** Walks `len` from `from` at `deg` off straight-down; `side` mirrors it. */
export function step(from: Point, len: number, deg: number, side: 1 | -1): Point {
  return {
    x: from.x + side * len * Math.sin(rad(deg)),
    y: from.y + len * Math.cos(rad(deg)),
  }
}

export interface Figure {
  head: Point
  neck: Point
  hip: Point
  shoulderL: Point
  shoulderR: Point
  elbowL: Point
  elbowR: Point
  handL: Point
  handR: Point
  hipL: Point
  hipR: Point
  kneeL: Point
  kneeR: Point
  footL: Point
  footR: Point
}

/**
 * Builds the skeleton for a pose. A twist narrows the shoulders, which is how
 * rotation reads in a flat front view — the same trick a comic artist uses.
 */
export function build(pose: MobilityPose): Figure {
  // `lift` is height *above the floor*, never below it — the figure is grounded
  // automatically, so a negative value would only bury it.
  const lift = Math.max(0, pose.lift ?? 0)
  const lean = pose.lean ?? 0
  const twist = pose.twist ?? 0
  const profile = pose.profile === true

  /*
   * Edge-on, the shoulders and hips have no width worth drawing. The sliver
   * that keeps the far limb from hiding exactly behind the near one is added
   * further down, after the body has been tipped over, because it is a drawing
   * convention rather than anatomy.
   */
  const shoulderHalf = profile ? 0 : SHOULDER_HALF * Math.cos(rad(twist))
  const hipHalf = profile ? 0 : HIP_HALF
  /** In profile both limbs swing the same way; face-on they mirror. */
  const far: 1 | -1 = profile ? 1 : -1

  const hip: Point = { x: 50, y: HIP_Y - lift }
  // The torso leans from the hip, so the shoulders and head travel with it.
  const neck = step(hip, HIP_Y - SHOULDER_Y, 180 - lean, 1)
  const head = {
    x: neck.x + (HEAD_Y - SHOULDER_Y) * Math.sin(rad(lean)),
    y: neck.y - (SHOULDER_Y - HEAD_Y),
  }

  const shoulderL: Point = { x: neck.x - shoulderHalf, y: neck.y }
  const shoulderR: Point = { x: neck.x + shoulderHalf, y: neck.y }
  const hipL: Point = { x: hip.x - hipHalf, y: hip.y }
  const hipR: Point = { x: hip.x + hipHalf, y: hip.y }

  const elbowL = step(shoulderL, UPPER_ARM, pose.armL, far)
  const elbowR = step(shoulderR, UPPER_ARM, pose.armR, 1)
  const handL = step(elbowL, FOREARM, pose.armL + (pose.elbowL ?? 0), far)
  const handR = step(elbowR, FOREARM, pose.armR + (pose.elbowR ?? 0), 1)

  const kneeL = step(hipL, THIGH, pose.legL, far)
  const kneeR = step(hipR, THIGH, pose.legR, 1)
  const footL = step(kneeL, SHIN, pose.legL - (pose.kneeL ?? 0), far)
  const footR = step(kneeR, SHIN, pose.legR - (pose.kneeR ?? 0), 1)

  const figure: Figure = {
    head,
    neck,
    hip,
    shoulderL,
    shoulderR,
    elbowL,
    elbowR,
    handL,
    handR,
    hipL,
    hipR,
    kneeL,
    kneeR,
    footL,
    footR,
  }

  /*
   * Tip the whole body over, for anything done on the floor.
   *
   * Applied after every joint, and about the hip, so limb angles stay relative
   * to the torso: `armL: 90` is "arm out perpendicular to the body" whether the
   * figure is standing with it raised in front or lying on it in a plank. Doing
   * it the other way round — baking the rotation into each angle — would mean
   * rewriting every number to change how far over the body leans.
   */
  const ground = pose.ground ?? 0
  if (ground !== 0) {
    const pivot = { ...figure.hip }
    for (const key of Object.keys(figure) as (keyof Figure)[]) {
      figure[key] = rotate(figure[key], pivot, ground)
    }
  }

  /*
   * Stagger the two sides of a profile figure, in screen space.
   *
   * Edge-on the limbs are genuinely on top of each other, so they need pulling
   * apart by a few pixels or the figure looks like it has one arm and one leg.
   * The separation is applied here rather than as a shoulder width because a
   * body-space offset gets rotated with everything else: tip a figure onto its
   * back and the two hips end up stacked *vertically*, which floats the near
   * foot several pixels above a floor the far one is standing on. Horizontal in
   * the drawing is the only direction that reads as "the far side, behind" from
   * every angle.
   */
  if (profile) {
    for (const key of Object.keys(figure) as (keyof Figure)[]) {
      if (key.endsWith('L')) figure[key].x -= PROFILE_HALF
      else if (key.endsWith('R')) figure[key].x += PROFILE_HALF
    }
  }

  /*
   * Stand the figure on the floor.
   *
   * A fixed hip height only works while both legs are straight. Kneel, lunge or
   * squat and whichever part is lowest — a foot, a knee in a half-kneel, a hand
   * in a push-up — has to be the thing that touches the ground, or the figure
   * hovers. Dropping the whole skeleton by however far it misses fixes every
   * pose at once, and makes `lift` mean "off the ground", which is what a hop
   * actually is.
   */
  const lowest = Math.max(...SUPPORTS.map((key) => figure[key].y))
  const shift = GROUND - lift - lowest
  if (shift !== 0) {
    for (const point of Object.values(figure)) point.y += shift
  }

  return figure
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export function blend(from: MobilityPose, to: MobilityPose, t: number): MobilityPose {
  return {
    label: t < 0.5 ? from.label : to.label,
    armL: lerp(from.armL, to.armL, t),
    armR: lerp(from.armR, to.armR, t),
    elbowL: lerp(from.elbowL ?? 0, to.elbowL ?? 0, t),
    elbowR: lerp(from.elbowR ?? 0, to.elbowR ?? 0, t),
    legL: lerp(from.legL, to.legL, t),
    legR: lerp(from.legR, to.legR, t),
    kneeL: lerp(from.kneeL ?? 0, to.kneeL ?? 0, t),
    kneeR: lerp(from.kneeR ?? 0, to.kneeR ?? 0, t),
    twist: lerp(from.twist ?? 0, to.twist ?? 0, t),
    lift: lerp(from.lift ?? 0, to.lift ?? 0, t),
    // Not interpolated: a figure cannot be half in profile, and blending it
    // would swing the far limb across the body mid-transition.
    profile: t < 0.5 ? from.profile : to.profile,
    lean: lerp(from.lean ?? 0, to.lean ?? 0, t),
    ground: lerp(from.ground ?? 0, to.ground ?? 0, t),
  }
}

/**
 * Where the racket head sits, given a hand and the elbow behind it. A racket
 * continues the line of the forearm, which is what makes a swing read as a
 * swing rather than as an arm waving next to an oval.
 */
export function racketHead(
  figure: Figure,
  side: 'left' | 'right',
): { head: Point; angleDeg: number } {
  const hand = side === 'right' ? figure.handR : figure.handL
  const elbow = side === 'right' ? figure.elbowR : figure.elbowL
  const dx = hand.x - elbow.x
  const dy = hand.y - elbow.y
  const length = Math.hypot(dx, dy) || 1
  const ux = dx / length
  const uy = dy / length
  return {
    head: { x: hand.x + ux * SHAFT, y: hand.y + uy * SHAFT },
    // Degrees for an SVG rotate(), which measures clockwise from the +x axis.
    angleDeg: (Math.atan2(uy, ux) * 180) / Math.PI,
  }
}

/**
 * The box a whole sequence needs, so a floor exercise is not drawn small.
 *
 * Every figure used to be drawn in the full 100×148 canvas, which is the right
 * size for somebody standing up and three times too tall for somebody lying on
 * the floor: a push-up occupied the bottom third of its card and the rest was
 * white. Cropping to what the sequence actually uses lets the SVG scale the
 * drawing up to fill the space it was given.
 *
 * Cropped once for the whole sequence rather than per frame, because a box that
 * followed each pose would zoom in and out as the figure moved. The blends
 * between keyframes are sampled too: a limb swinging from one side to the other
 * passes through straight up, which is higher than either end of the movement.
 *
 * Only the top edge moves. The floor and the pose label sit at the bottom and
 * are part of the drawing, and the sides are already close to the figure.
 */
/**
 * Breathing room above the topmost joint.
 *
 * At least the widest half-width in `LIMB_WIDTH`, because a bone is drawn
 * *around* its joints: a horizontal shoulder at the top of a lying figure
 * reaches a chest's half-width above the point the crop was measured from, and
 * would be sliced along its length.
 */
export const FIGURE_PAD = 8
/** Pose label type, in the uncropped canvas, and its baseline above the floor. */
export const LABEL_SIZE = 8.5
export const LABEL_BASELINE = 4

export interface FigureBox {
  viewBox: string
  top: number
  height: number
  labelSize: number
  labelY: number
}

export function figureBox(poses: MobilityPose[], racket: 'left' | 'right' | null): FigureBox {
  const margin = marginFor(racket)
  let highest = GROUND

  const consider = (pose: MobilityPose) => {
    const figure = build(pose)
    for (const point of Object.values(figure)) highest = Math.min(highest, point.y)
    highest = Math.min(highest, figure.head.y - HEAD_R)
    if (racket) highest = Math.min(highest, racketHead(figure, racket).head.y - HEAD_LONG)
  }

  for (let i = 0; i < poses.length; i += 1) {
    const current = poses[i]
    if (!current) continue
    consider(current)
    const next = poses[(i + 1) % poses.length]
    if (!next || poses.length < 2) continue
    for (const t of [0.25, 0.5, 0.75]) consider(blend(current, next, t))
  }

  // Not clamped to the top of the nominal canvas: an overhead clear swings its
  // racket a couple of units past it at the peak of the blend, and did so
  // silently for as long as the box was a fixed 148 tall.
  const top = Math.min(highest - FIGURE_PAD, VIEW_H - 1)
  const height = VIEW_H - top

  /*
   * The label is a caption, and a caption wants to be the same size on every
   * card. Cropping scales up everything in the box, type included, so the type
   * has to come down by the same factor to stay put.
   *
   * Floored at 0.6 because past that point the crop stops making the drawing
   * bigger — a short wide box is scaled to fit the card's *width* instead —
   * and a label that kept shrinking would end up smaller than the one on the
   * card beside it. At the floor, in the card these are drawn in, every label
   * lands within a few tenths of a pixel of every other.
   */
  const labelScale = Math.min(1, Math.max(0.6, height / VIEW_H))

  return {
    viewBox: `${-margin} ${top} ${VIEW_W + margin * 2} ${height}`,
    top,
    height,
    labelSize: LABEL_SIZE * labelScale,
    labelY: VIEW_H - LABEL_BASELINE * labelScale,
  }
}

/** An arrow only where something actually moved — below that it is a smudge. */
export const MIN_TRAVEL = 9

export function travel(from: Point, to: Point): { from: Point; to: Point } | null {
  return Math.hypot(to.x - from.x, to.y - from.y) > MIN_TRAVEL ? { from, to } : null
}

/** The extremity that moved furthest between two keyframes — the one to arrow. */
export function movingPart(a: Figure, b: Figure): { from: Point; to: Point } | null {
  // Near-side limbs are weighted up: they are the ones drawn in full strength,
  // and an arrow hanging off a faded limb reads as belonging to nothing.
  const pairs: [Point, Point, number][] = [
    [a.handR, b.handR, 1.35],
    [a.footR, b.footR, 1.35],
    [a.handL, b.handL, 1],
    [a.footL, b.footL, 1],
  ]
  let best: { from: Point; to: Point } | null = null
  let bestScore = MIN_TRAVEL
  for (const [from, to, weight] of pairs) {
    const score = Math.hypot(to.x - from.x, to.y - from.y) * weight
    if (score > bestScore) {
      bestScore = score
      best = { from, to }
    }
  }
  return best
}

/* ------------------------------------------------------- shape assertions */

/** How far apart the feet are. A wide stance has to be wider than the hips. */
export function footSpread(pose: MobilityPose): number {
  const figure = build(pose)
  return Math.abs(figure.footR.x - figure.footL.x)
}

/** Hip width, the yardstick a stance is measured against. */
export const HIP_SPREAD = HIP_HALF * 2

/** The lowest point of the figure, which should be the floor unless it hops. */
export function lowestY(pose: MobilityPose): number {
  const figure = build(pose)
  return Math.max(...SUPPORTS.map((key) => figure[key].y))
}

/**
 * How horizontal the figure ends up, 0 upright to 1 flat.
 *
 * Measured from the drawing rather than read back off the pose, because the
 * question a floor exercise needs answered is "does this look like someone on
 * the ground" — and a torso that stayed vertical while the legs rotated would
 * pass a check on the input and fail a look at the output.
 */
export function flatness(pose: MobilityPose): number {
  const figure = build(pose)
  const rise = Math.abs(figure.neck.y - figure.hip.y)
  const run = Math.abs(figure.neck.x - figure.hip.x)
  return run / (run + rise || 1)
}

/** Horizontal extent of the drawing, racket included, for canvas sizing. */
export function widestX(pose: MobilityPose, racket: 'left' | 'right' | null): [number, number] {
  const figure = build(pose)
  const xs = Object.values(figure).map((point) => point.x)
  if (racket) {
    const { head } = racketHead(figure, racket)
    xs.push(head.x - HEAD_LONG, head.x + HEAD_LONG)
  }
  return [Math.min(...xs), Math.max(...xs)]
}

/* ------------------------------------------------------------ body volume */

/**
 * Limb thicknesses, as half-widths in canvas units.
 *
 * The figure was drawn for a long time as lines of one constant weight, which
 * is a *stick* man rather than a person: a thigh and a wrist are the same
 * width, there is no chest, and at a glance it reads as a diagram of a diagram.
 * Giving each bone a start and end width costs nothing at runtime — the same
 * joint positions, filled instead of stroked — and is the difference between
 * something you recognise as a body and something you have to decode.
 *
 * Proportioned from the skeleton it is drawn on rather than picked by eye: the
 * torso is 34 long and the thigh 21, so a 7-unit chest half-width is about a
 * fifth of the torso's length, which is roughly a person.
 */
export const LIMB_WIDTH = {
  /** Hip end, chest end. */
  torso: [5.6, 7.2],
  shoulders: [3.1, 3.1],
  hips: [3.6, 3.6],
  upperArm: [3.4, 2.7],
  forearm: [2.6, 2.2],
  thigh: [4.9, 3.5],
  shin: [3.4, 2.7],
} as const

/**
 * A tapered limb as a fillable path: two straight sides and a rounded cap at
 * each end, so joints meet without a seam and nothing needs a stroke.
 *
 * Both caps sweep the same way, and it is sweep-flag 0. Take a bone running
 * left to right and the normal pointing down the screen: the far cap has to go
 * from below the joint, round past its outside edge, to above it — six o'clock
 * to three to twelve — which is counter-clockwise on screen, and SVG's positive
 * sweep direction is clockwise. Get this backwards and each cap curls back
 * inside the limb, the path self-intersects, and the non-zero fill rule punches
 * a white hole at every joint. Which is exactly what it did.
 */
export function limbPath(a: Point, b: Point, halfA: number, halfB: number): string {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = Math.hypot(dx, dy)
  // A zero-length bone still has to draw something, or a joint vanishes.
  if (length < 0.001) {
    const r = Math.max(halfA, halfB)
    return `M ${a.x - r} ${a.y} A ${r} ${r} 0 1 0 ${a.x + r} ${a.y} A ${r} ${r} 0 1 0 ${a.x - r} ${a.y} Z`
  }
  const nx = -dy / length
  const ny = dx / length
  return [
    `M ${a.x + nx * halfA} ${a.y + ny * halfA}`,
    `L ${b.x + nx * halfB} ${b.y + ny * halfB}`,
    `A ${halfB} ${halfB} 0 0 0 ${b.x - nx * halfB} ${b.y - ny * halfB}`,
    `L ${a.x - nx * halfA} ${a.y - ny * halfA}`,
    `A ${halfA} ${halfA} 0 0 0 ${a.x + nx * halfA} ${a.y + ny * halfA}`,
    'Z',
  ].join(' ')
}
