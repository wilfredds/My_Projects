/**
 * The conditioning exercise catalogue (§4 Phase 3).
 *
 * Bundled with the app rather than stored, for the same reason the drills are:
 * this is reference content, not user data, and a circuit has to be runnable
 * in a garage with no signal.
 *
 * The brief asks for short demo clips. Curating vetted video is Phase 5, and
 * inventing links now would plant dead ones — so each exercise instead carries
 * a *schematic* demo the app can draw itself: a footfall pattern for ladder
 * work, and side-view keyframes for everything else. Both animate offline, and
 * for ladder patterns a diagram is arguably clearer than video anyway.
 */

/**
 * `mobility` and `stretch` arrived with the warm-up. They are separated because
 * they belong at opposite ends of a session: mobility work is done warm and
 * moving, stretching is done afterwards and held still. Filing them together
 * would let the library offer a hamstring stretch as a way to warm up.
 */
export type ExerciseKind = 'ladder' | 'plyometric' | 'bodyweight' | 'mobility' | 'stretch'
export type Equipment = 'none' | 'ladder' | 'step'

/**
 * A foot on the ladder diagram. `x` runs across the ladder (-1 fully outside
 * left, ±0.28 inside, +1 outside right); `y` counts cells along it.
 */
export interface FootPose {
  x: number
  y: number
  /** Drawn small and faded — the foot is in the air at this moment. */
  lifted?: boolean
}

export interface FootFrame {
  left: FootPose
  right: FootPose
}

/**
 * A side-view pose, as parameters rather than coordinates, so one renderer
 * draws every exercise.
 */
export interface FigurePose {
  /** 0 standing tall … 1 deep squat. */
  squat: number
  /** 0 grounded … 1 peak of the jump. */
  air: number
  /** 0 legs under you … 1 knees to chest. */
  tuck: number
  /** -1 arms swung back … 1 arms driven forward and up. */
  arms: number
  /** Horizontal split of the feet: 0 together, 1 wide or staggered. */
  split: number
  /**
   * 0 = both legs mirror each other; 1 = a true lunge — front knee stacked
   * over the ankle, trailing knee dropped towards the floor. Without this a
   * lunge just renders as a wide stance.
   */
  lead?: number
  label: string
}

/**
 * A jointed pose, in degrees off straight-down, positive swinging forward.
 *
 * The older `FigurePose` is parametric — squat depth, air, tuck — which suits a
 * jump squat and cannot describe an arm circle or a leg swing at all. Warm-up
 * movements are about limbs travelling through a range, so they are described
 * as angles and drawn as a real skeleton.
 */
export interface MobilityPose {
  label: string
  /** Arm rotation at the shoulder. 0 hangs down, 180 is straight overhead. */
  armL: number
  armR: number
  /** Extra bend at the elbow, degrees. */
  elbowL?: number
  elbowR?: number
  /** Leg rotation at the hip. 0 stands, positive lifts the knee forward. */
  legL: number
  legR: number
  /** Extra bend at the knee, degrees. */
  kneeL?: number
  kneeR?: number
  /** Shoulder rotation for twists, degrees — narrows the shoulders as it turns. */
  twist?: number
  /** Whole-body rise, for heel raises and hops. */
  lift?: number
  /** Forward lean at the hip, degrees. */
  lean?: number
  /**
   * Whole-body rotation away from standing, in degrees, applied *after* every
   * joint angle. 0 stands up; 90 lies face-down on the hands or elbows;
   * -90 lies face-up.
   *
   * This is what lets the same skeleton draw a push-up, a plank and a glute
   * bridge. Because the rotation happens last, every limb angle stays relative
   * to the torso — `armL: 90` is "arm perpendicular to the body" whether you
   * are standing with it out in front or lying on it holding a plank — so the
   * poses read the same way whichever way up the figure is.
   */
  ground?: number
}

export interface Exercise {
  slug: string
  name: string
  kind: ExerciseKind
  equipment: Equipment
  /** One line, shown on the card during the workout. */
  summary: string
  cues: string[]
  faults: string[]
  /** What to do without the kit or the court. */
  substitute: string | null
  /** How much of it to do when practising the exercise on its own. */
  recommendedReps: string
  /** Ladder work only. */
  pattern?: FootFrame[]
  /** Jumps and bodyweight work. */
  poses?: FigurePose[]
  /** Warm-up and stretching, drawn as a jointed skeleton. */
  mobility?: MobilityPose[]
}

/* --------------------------------------------------------------- patterns */

const IN_AND_OUT: FootFrame[] = [
  { left: { x: -0.28, y: 0.5 }, right: { x: 0.28, y: 0.5 } },
  { left: { x: -1, y: 1 }, right: { x: 1, y: 1 } },
  { left: { x: -0.28, y: 1.5 }, right: { x: 0.28, y: 1.5 } },
  { left: { x: -1, y: 2 }, right: { x: 1, y: 2 } },
  { left: { x: -0.28, y: 2.5 }, right: { x: 0.28, y: 2.5 } },
  { left: { x: -1, y: 3 }, right: { x: 1, y: 3 } },
]

const LATERAL_SHUFFLE: FootFrame[] = [
  { left: { x: -0.3, y: -0.4 }, right: { x: 0.3, y: 0.5 } },
  { left: { x: -0.3, y: 0.5 }, right: { x: 0.3, y: 0.5 } },
  { left: { x: -0.3, y: 0.5 }, right: { x: 0.3, y: 1.5 } },
  { left: { x: -0.3, y: 1.5 }, right: { x: 0.3, y: 1.5 } },
  { left: { x: -0.3, y: 1.5 }, right: { x: 0.3, y: 2.5 } },
  { left: { x: -0.3, y: 2.5 }, right: { x: 0.3, y: 2.5 } },
]

const CROSSOVER: FootFrame[] = [
  { left: { x: -0.28, y: 0.5 }, right: { x: 1, y: 0.1 } },
  { left: { x: -1, y: 0.9 }, right: { x: 0.28, y: 0.6 } },
  { left: { x: -0.28, y: 1.5 }, right: { x: 1, y: 1.1 } },
  { left: { x: -1, y: 1.9 }, right: { x: 0.28, y: 1.6 } },
  { left: { x: -0.28, y: 2.5 }, right: { x: 1, y: 2.1 } },
  { left: { x: -1, y: 2.9 }, right: { x: 0.28, y: 2.6 } },
]

const HIGH_KNEES: FootFrame[] = [
  { left: { x: -0.28, y: 0.5 }, right: { x: 0.28, y: 0.2, lifted: true } },
  { left: { x: -0.28, y: 1.2, lifted: true }, right: { x: 0.28, y: 1.5 } },
  { left: { x: -0.28, y: 2.5 }, right: { x: 0.28, y: 2.2, lifted: true } },
  { left: { x: -0.28, y: 3.2, lifted: true }, right: { x: 0.28, y: 3.5 } },
]

/* ------------------------------------------------------------------ poses */

const pose = (
  label: string,
  squat: number,
  air: number,
  tuck: number,
  arms: number,
  split = 0,
  lead = 0,
): FigurePose => ({ label, squat, air, tuck, arms, split, lead })

/**
 * Jointed poses. Only the joints that move need naming, so a movement reads as
 * a short list of what actually changes.
 */
const mob = (label: string, p: Partial<MobilityPose> = {}): MobilityPose => ({
  label,
  armL: 8,
  armR: 8,
  legL: 4,
  legR: 4,
  ...p,
})

/* -------------------------------------------------------------- catalogue */

export const EXERCISES: Exercise[] = [
  {
    slug: 'ladder-in-out',
    name: 'In and out',
    kind: 'ladder',
    equipment: 'ladder',
    summary: 'Two feet in the cell, two feet out astride it. Straight up the ladder.',
    cues: [
      'Stay on the balls of your feet — heels never touch down.',
      'Small, fast steps. The ladder rewards frequency, not stride length.',
      'Arms drive as if you were running; they set the rhythm for the feet.',
      'Look up the ladder, not down at it.',
    ],
    faults: [
      'Watching your feet, which drops the chest and slows everything down.',
      'Landing flat and heavy instead of springing off the forefoot.',
      'Widening the "out" step so far that the next "in" step is a lunge.',
    ],
    substitute: 'No ladder? Chalk or tape eight 40cm squares, or just imagine the rungs.',
    recommendedReps:
      '4 lengths of the ladder, walking back between each. Stop when the feet get heavy.',
    pattern: IN_AND_OUT,
  },
  {
    slug: 'ladder-lateral-shuffle',
    name: 'Lateral shuffle',
    kind: 'ladder',
    equipment: 'ladder',
    summary: 'Side-on to the ladder. Lead foot in, trail foot follows, move along.',
    cues: [
      'Stay side-on the whole way — the hips never turn to face the ladder.',
      'Push off the trailing foot rather than reaching with the lead one.',
      'Keep a low, athletic base; this is the shape you defend a smash in.',
      'Come back the other way so both sides lead.',
    ],
    faults: [
      'Crossing the feet, which is a different drill and a rolled ankle waiting.',
      'Standing up tall between cells and losing the loaded position.',
      'Only ever leading with the same foot.',
    ],
    substitute: 'Tape a line of squares, or shuffle between two markers about 4m apart.',
    recommendedReps: '3 lengths leading with each foot, walking back between each.',
    pattern: LATERAL_SHUFFLE,
  },
  {
    slug: 'ladder-crossover',
    name: 'Crossover',
    kind: 'ladder',
    equipment: 'ladder',
    summary: 'One foot in, the other crosses over behind. The classic icky shuffle.',
    cues: [
      'The crossing foot goes over and in front, not around the back.',
      'Rotate through the hips, not the shoulders.',
      'Build the rhythm slowly before you chase speed — this one rewards patience.',
    ],
    faults: [
      'Turning the whole body instead of letting the hips rotate underneath.',
      'Rushing before the pattern is automatic, and tangling the feet.',
    ],
    substitute: 'Tape or chalk works fine. This pattern is about coordination, not the kit.',
    recommendedReps: '3 lengths in each direction. Slow it down until the pattern is right.',
    pattern: CROSSOVER,
  },
  {
    slug: 'ladder-high-knees',
    name: 'High knees',
    kind: 'ladder',
    equipment: 'ladder',
    summary: 'One foot per cell, knees driven high, as fast as you can hold form.',
    cues: [
      'Drive the knee to hip height; the foot follows the knee.',
      'Ground contact should be almost silent and almost instant.',
      'Stay tall — chest up, hips forward, no leaning back.',
    ],
    faults: [
      'Leaning back to get the knees up, which stalls the whole drill.',
      'Slowing the cadence to get the knees higher. Cadence wins.',
    ],
    substitute: 'Run them on the spot with a marker line, or over eight taped squares.',
    recommendedReps: '4 lengths, flat out, with a full walk back. This one is a sprint.',
    pattern: HIGH_KNEES,
  },

  {
    slug: 'plyo-jump-squat',
    name: 'Jump squats',
    kind: 'plyometric',
    equipment: 'none',
    summary: 'Squat to about parallel, drive up and out of the floor, land soft.',
    cues: [
      'Sit back into the hips before you jump — this is not a bounce.',
      'Swing the arms up as you drive; they are worth height for free.',
      'Land through the whole foot and absorb straight into the next rep.',
      'Knees track over the toes, never inside them.',
    ],
    faults: [
      'Landing stiff-legged, which turns a power drill into an impact drill.',
      'Getting shallower every rep as fatigue arrives.',
      'Letting the knees collapse inwards on landing.',
    ],
    substitute: null,
    recommendedReps: '3 rounds of 8–10, fully recovered between rounds.',
    poses: [
      pose('Load', 0.85, 0, 0, -0.8, 0.35),
      pose('Drive', 0.1, 0.75, 0, 1, 0.25),
      pose('Land', 0.6, 0, 0, -0.2, 0.35),
    ],
  },
  {
    slug: 'plyo-tuck-jump',
    name: 'Tuck jumps',
    kind: 'plyometric',
    equipment: 'none',
    summary: 'Jump from a quarter squat and pull both knees to your chest.',
    cues: [
      'Jump first, tuck second. Tucking early costs you height.',
      'Pull the knees up rather than reaching the chest down.',
      'Land in the same square metre you left from.',
    ],
    faults: [
      'Folding at the waist to meet the knees, which is not the same movement.',
      'Drifting forwards rep by rep until you are travelling across the room.',
    ],
    substitute: 'Swap for jump squats if the ceiling is low or the knees are complaining.',
    recommendedReps: '3 rounds of 6–8. Quality drops fast; stop the round when it does.',
    poses: [
      pose('Dip', 0.55, 0, 0, -0.7, 0.2),
      pose('Tuck', 0.15, 1, 1, 0.5, 0.1),
      pose('Land', 0.5, 0, 0, -0.1, 0.25),
    ],
  },
  {
    slug: 'plyo-split-jump',
    name: 'Split jumps',
    kind: 'plyometric',
    equipment: 'none',
    summary: 'Lunge, jump, swap legs in the air, land in the opposite lunge.',
    cues: [
      'This is the scissor action from a jump smash — treat it like technique.',
      'Back knee tracks down, not forward over the toes.',
      'Land on the whole front foot and absorb before the next jump.',
      'Chest stays up throughout; the torso does not pitch forward.',
    ],
    faults: [
      'Shortening the lunge as you tire so the legs barely swap.',
      'Crashing the back knee into the floor.',
    ],
    substitute: 'Step back into the lunge instead of jumping if the knees need a break.',
    recommendedReps: '3 rounds of 10 (5 each leg), landing softly every time.',
    poses: [
      pose('Lunge', 0.8, 0, 0, -0.5, 1, 1),
      pose('Swap', 0.15, 0.8, 0.2, 0.8, 0.3),
      pose('Land', 0.8, 0, 0, -0.3, 1, 1),
    ],
  },
  {
    slug: 'plyo-lateral-bound',
    name: 'Lateral bounds',
    kind: 'plyometric',
    equipment: 'none',
    summary: 'Push sideways off one leg, land on the other, hold the landing a beat.',
    cues: [
      'This is the push that gets you to a wide net shot. Drive sideways, not up.',
      'Land on one leg and stick it for a beat before bounding back.',
      'Let the hip and knee bend absorb the landing — do not fight it.',
    ],
    faults: [
      'Bouncing straight back without controlling the landing.',
      'Jumping upwards instead of across.',
    ],
    substitute: 'Shorten the bound in a tight space. Distance is adjustable, quality is not.',
    recommendedReps: '3 rounds of 10 (5 each side), holding the landing for a beat.',
    poses: [
      pose('Load', 0.75, 0, 0, -0.6, 0.6),
      pose('Bound', 0.25, 0.5, 0, 0.7, 1),
      pose('Stick', 0.7, 0, 0, 0, 0.8, 0.6),
    ],
  },
  {
    slug: 'plyo-step-jump',
    name: 'Step jumps',
    kind: 'plyometric',
    equipment: 'step',
    summary: 'Jump up onto a low step or box, stand tall, step back down.',
    cues: [
      'Step down, never jump down — the landing is where injuries come from.',
      'Land quietly on the box with soft knees and the whole foot on it.',
      'Pick a height you can clear comfortably when tired, not when fresh.',
    ],
    faults: [
      'Choosing a box that is too high and scraping the shins.',
      'Jumping back down to save time.',
    ],
    substitute: 'No box? Jump squats train the same drive without the trip hazard.',
    recommendedReps: '3 rounds of 8–10, stepping down rather than jumping down.',
    poses: [
      pose('Load', 0.8, 0, 0, -0.8, 0.3),
      pose('Up', 0.2, 0.65, 0.35, 0.9, 0.2),
      pose('Stand', 0.15, 0.2, 0, 0.1, 0.2),
    ],
  },

  {
    slug: 'shadow-lunge',
    name: 'Net lunges',
    kind: 'bodyweight',
    equipment: 'none',
    summary: 'Alternating forward lunges with a shadow net shot at full reach.',
    cues: [
      'Racket leg leads and the racket arm reaches with it.',
      'Drive back out with the front leg — the back leg is a brake.',
      'Knee over the ankle, chest up, eyes forward.',
    ],
    faults: [
      'Letting the front knee travel past the toes.',
      'Standing up out of the lunge before pushing back.',
    ],
    substitute: null,
    recommendedReps: '3 rounds of 30 seconds, alternating corners.',
    poses: [
      pose('Ready', 0.3, 0, 0, 0.2, 0.2),
      pose('Lunge', 0.85, 0, 0, 1, 1, 1),
      pose('Recover', 0.5, 0, 0, 0.5, 0.55, 0.5),
    ],
  },
  {
    slug: 'core-plank-reach',
    name: 'Plank shoulder taps',
    kind: 'bodyweight',
    equipment: 'none',
    summary: 'High plank, tap the opposite shoulder, keep the hips still.',
    cues: [
      'Widen the feet — a wider base makes the hips easier to keep level.',
      'Move slowly. The point is resisting rotation, not counting taps.',
      'Squeeze the glutes and brace as if about to take a hit to the stomach.',
    ],
    faults: [
      'Rocking the hips side to side, which removes the entire challenge.',
      'Racing through the taps.',
    ],
    substitute: 'Drop to your knees and keep the hips level rather than sagging.',
    recommendedReps: '3 rounds of 30–40 seconds, hips level throughout.',
    poses: [
      pose('Plank', 0.95, 0, 0.15, -0.35, 0.7),
      pose('Tap', 0.95, 0, 0.15, 0.85, 0.7),
      pose('Return', 0.95, 0, 0.15, -0.35, 0.7),
    ],
  },

  /* ------------------------------------------------------------- strength */

  /*
   * Bodyweight strength.
   *
   * This is the half of a real session that happens off the court, and until
   * now the catalogue barely had it: four ladder patterns, five jumps, ten
   * mobility drills, and for strength a single lunge and a single plank. Watch
   * any club train and between court reps they are on the floor doing exactly
   * this.
   *
   * Chosen for badminton rather than for a gym. The lunge is the sport's
   * signature movement, so single-leg work outranks two-legged work; the smash
   * is a rotation, so the core work is anti-rotation and anti-extension rather
   * than sit-ups; landing from a jump smash is what wrecks ankles, so the
   * calves get their own slot. Nothing here needs equipment, because the whole
   * app assumes a garage.
   *
   * Every one carries a substitute. "Do fewer" is not a scaling strategy —
   * somebody who cannot do a push-up needs a different push-up, not three of
   * the wrong one.
   */
  {
    slug: 'str-push-up',
    name: 'Push-ups',
    kind: 'bodyweight',
    equipment: 'none',
    summary: 'Hands under the shoulders, body in one line, chest to within a fist of the floor.',
    cues: [
      'Hands under the shoulders, elbows tracking back at about 45°, not flared to the sides.',
      'Squeeze the glutes. A push-up is a moving plank — the hips must not lead or sag.',
      'Lower under control for two counts, push back up in one.',
      'Full lockout at the top; that last few degrees is where the shoulder gets its strength.',
    ],
    faults: [
      'Hips sagging, which turns the effort into a lower-back exercise.',
      'Elbows flared straight out to the sides — the fastest route to a sore shoulder.',
      'Half-repetitions: stopping a foot above the floor and calling it a rep.',
    ],
    substitute: 'Hands on a chair, a step or a wall. The higher the hands, the easier it gets.',
    recommendedReps: '3 sets of 8–15, or 40 seconds of quality work.',
    mobility: [
      mob('Top', { ground: 71, armL: 85, armR: 85, legL: 10, legR: 10 }),
      mob('Chest down', {
        ground: 81,
        armL: 60,
        armR: 60,
        elbowL: 110,
        elbowR: 110,
        legL: 8,
        legR: 8,
      }),
      mob('Drive up', { ground: 71, armL: 85, armR: 85, legL: 10, legR: 10 }),
    ],
  },
  {
    slug: 'str-knee-push-up',
    name: 'Knee push-ups',
    kind: 'bodyweight',
    equipment: 'none',
    summary: 'The same push-up from the knees, so the line from head to knee stays straight.',
    cues: [
      'Knees, hips and shoulders in one line — the shortcut is bending at the hip.',
      'Hands still under the shoulders, elbows still tracking back.',
      'Pad the knees with a towel if the floor is hard.',
      'Move to full push-ups one repetition at a time, not all at once.',
    ],
    faults: [
      'Hinging at the hip so only the shoulders travel.',
      'Hands creeping forward, which loads the shoulder instead of the chest.',
    ],
    substitute: null,
    recommendedReps: '3 sets of 10–15, held in a straight line throughout.',
    mobility: [
      mob('Top', { ground: 66, armL: 90, armR: 90, legL: 25, legR: 25, kneeL: 80, kneeR: 80 }),
      mob('Chest down', {
        ground: 74,
        armL: 62,
        armR: 62,
        elbowL: 100,
        elbowR: 100,
        legL: 22,
        legR: 22,
        kneeL: 80,
        kneeR: 80,
      }),
      mob('Drive up', { ground: 66, armL: 90, armR: 90, legL: 25, legR: 25, kneeL: 80, kneeR: 80 }),
    ],
  },
  {
    slug: 'str-plank',
    name: 'Forearm plank',
    kind: 'bodyweight',
    equipment: 'none',
    summary: 'Elbows under the shoulders, one straight line from head to heels, and hold.',
    cues: [
      'Elbows directly under the shoulders, forearms flat.',
      'Tuck the tailbone slightly and brace as if about to take a punch.',
      'Push the floor away — the upper back should be flat, not collapsed between the shoulders.',
      'Breathe. Holding your breath makes 30 seconds feel like a minute and trains nothing extra.',
    ],
    faults: [
      'Hips high, turning it into a rest.',
      'Hips low, turning it into a lower-back squeeze.',
      'Holding until failure every time. Quality beats duration here.',
    ],
    substitute: 'Drop to the knees, or put the elbows on a chair seat and angle the body up.',
    recommendedReps: '3 holds of 30–45 seconds, stopping while the line is still good.',
    mobility: [
      mob('Set the line', {
        ground: 81,
        armL: 100,
        armR: 100,
        elbowL: 75,
        elbowR: 75,
        legL: 8,
        legR: 8,
      }),
      mob('Brace and hold', {
        ground: 81,
        armL: 100,
        armR: 100,
        elbowL: 75,
        elbowR: 75,
        legL: 8,
        legR: 8,
      }),
    ],
  },
  {
    slug: 'str-side-plank',
    name: 'Side plank',
    kind: 'bodyweight',
    equipment: 'none',
    summary: 'On one forearm, hips stacked and lifted. The side of the body that holds a lunge.',
    cues: [
      'Elbow under the shoulder, feet stacked or staggered for a wider base.',
      'Drive the bottom hip up until the body is one line from head to feet.',
      'Top arm reaching for the ceiling keeps the chest open.',
      'Both sides, equal time — the racket side is almost always the stronger one.',
    ],
    faults: [
      'Hips sinking towards the floor as the hold goes on.',
      'Rolling the chest towards the floor instead of stacking the shoulders.',
      'Doing one side and forgetting the other.',
    ],
    substitute: 'Bend the bottom knee and rest it on the floor for a shorter lever.',
    recommendedReps: '2 holds of 20–30 seconds each side.',
    /*
     * No diagram on purpose.
     *
     * The figure renderer draws a front view. A side plank is defined by the
     * body being edge-on to the viewer, which a front view cannot show without
     * looking like somebody lying diagonally. A wrong diagram is worse than
     * none, so this ships on its cues.
     */
  },
  {
    slug: 'str-glute-bridge',
    name: 'Glute bridges',
    kind: 'bodyweight',
    equipment: 'none',
    summary: 'On your back, heels close, drive the hips up until the body is a ramp.',
    cues: [
      'Heels a hand-span from your backside, toes lightly lifted to keep the load in the glutes.',
      'Squeeze the glutes first, then lift — do not arch the lower back to get higher.',
      'Pause for a full second at the top. The pause is the exercise.',
      'This is the hip drive behind every jump smash.',
    ],
    faults: [
      'Arching the lower back instead of extending the hip.',
      'Pushing through the toes, which hands the work to the quads.',
      'Bouncing up and down with no pause.',
    ],
    substitute: null,
    recommendedReps: '3 sets of 12–15 with a one-second squeeze at the top.',
    /*
     * No diagram on purpose.
     *
     * The figure renderer draws a front view. A side plank is defined by being
     * edge-on to the viewer, which a front view can only draw as somebody
     * lying diagonally. Ships on its cues.
     */
  },
  {
    slug: 'str-dead-bug',
    name: 'Dead bugs',
    kind: 'bodyweight',
    equipment: 'none',
    summary: 'On your back, opposite arm and leg reaching away while the lower back stays down.',
    cues: [
      'Press the lower back into the floor before you move, and keep it there.',
      'Opposite arm and leg, slowly, only as far as you can go without the back lifting.',
      'Exhale as the limbs reach away.',
      'If the back lifts, you have found your range. Stop short of it.',
    ],
    faults: [
      'Racing, which is how the lower back arches without you noticing.',
      'Reaching further than the core can hold, which trains the back rather than the core.',
    ],
    substitute: 'Move one limb at a time until holding the back down is easy.',
    recommendedReps: '3 sets of 8 slow repetitions each side.',
    mobility: [
      mob('Ready', {
        ground: -88,
        armL: 88,
        armR: 88,
        legL: 84,
        legR: 84,
        kneeL: 88,
        kneeR: 88,
      }),
      mob('Reach away', {
        ground: -88,
        armL: 88,
        armR: 150,
        legL: 30,
        legR: 84,
        kneeL: 20,
        kneeR: 88,
      }),
      mob('Back to centre', {
        ground: -88,
        armL: 88,
        armR: 88,
        legL: 84,
        legR: 84,
        kneeL: 88,
        kneeR: 88,
      }),
    ],
  },
  {
    slug: 'str-superman',
    name: 'Supermans',
    kind: 'bodyweight',
    equipment: 'none',
    summary: 'Face down, lift the chest and the thighs together. The back half of the body.',
    cues: [
      'Look at the floor, not forward — the neck follows the spine.',
      'Lift the chest and the thighs at the same time, and hold for a second.',
      'Squeeze the glutes rather than cranking the lower back.',
      'Small range done well beats a big range done with a shrug.',
    ],
    faults: [
      'Craning the neck up, which is where the ache the next day comes from.',
      'Lifting only the arms and calling it done.',
    ],
    substitute: 'Lift the opposite arm and leg only, alternating.',
    recommendedReps: '3 sets of 10 with a one-second hold at the top.',
    /*
     * No diagram on purpose.
     *
     * The figure renderer draws a front view. Lying face down with the chest
     * and thighs lifted is a shallow side-view arc, and a front view flattens
     * it into a horizontal smudge. Ships on its cues.
     */
  },
  {
    slug: 'str-bird-dog',
    name: 'Bird dogs',
    kind: 'bodyweight',
    equipment: 'none',
    summary: 'On hands and knees, opposite arm and leg out straight, hips level.',
    cues: [
      'Hands under the shoulders, knees under the hips.',
      'Reach the arm forward and the opposite leg back until both are level with the body.',
      'Hips stay square — imagine a glass of water balanced on your lower back.',
      'Two seconds out, two seconds back.',
    ],
    faults: [
      'Twisting the hips open as the leg goes back.',
      'Lifting the leg higher than the body, which is just a back arch.',
    ],
    substitute: 'Arm only, then leg only, before combining them.',
    recommendedReps: '3 sets of 8 each side, held two seconds.',
    mobility: [
      mob('Set', {
        ground: 66,
        armL: 90,
        armR: 90,
        legL: 25,
        legR: 25,
        kneeL: 80,
        kneeR: 80,
      }),
      mob('Reach', {
        ground: 66,
        armL: 90,
        armR: 138,
        legL: 25,
        legR: -8,
        kneeL: 80,
        kneeR: 4,
      }),
      mob('Return', {
        ground: 66,
        armL: 90,
        armR: 90,
        legL: 25,
        legR: 25,
        kneeL: 80,
        kneeR: 80,
      }),
    ],
  },
  {
    slug: 'str-squat',
    name: 'Bodyweight squats',
    kind: 'bodyweight',
    equipment: 'none',
    summary: 'Feet shoulder width, sit down between the hips, chest up, drive through the floor.',
    cues: [
      'Feet a little wider than the hips, toes turned out a touch.',
      'Sit back and down together; the knees travel forward over the toes, which is fine.',
      'Chest up and heels down — if the heels lift, go less deep for now.',
      'Stand all the way up and squeeze the glutes at the top.',
    ],
    faults: [
      'Knees collapsing inwards on the way up.',
      'Heels lifting, which usually means going deeper than the ankles allow yet.',
      'Rounding the lower back at the bottom.',
    ],
    substitute: 'Squat down to a chair and stand back up, touching lightly rather than sitting.',
    recommendedReps: '3 sets of 15–20, or 45 seconds at a steady tempo.',
    mobility: [
      mob('Stand', { legL: 8, legR: 8, armL: 10, armR: 10 }),
      mob('Sit down', {
        legL: 20,
        legR: 20,
        kneeL: 88,
        kneeR: 88,
        armL: 74,
        armR: 74,
        elbowL: 14,
        elbowR: 14,
        lean: 14,
      }),
      mob('Drive up', { legL: 8, legR: 8, armL: 10, armR: 10 }),
    ],
  },
  {
    slug: 'str-split-squat',
    name: 'Split squats',
    kind: 'bodyweight',
    equipment: 'none',
    summary: 'One foot forward, one back, drop the back knee towards the floor. The lunge, loaded.',
    cues: [
      'A long stride: front shin roughly vertical at the bottom.',
      'Drop straight down, not forward — the back knee travels towards the floor.',
      'Weight through the whole front foot, chest tall.',
      'This is the single-leg strength every badminton lunge is paid for out of.',
    ],
    faults: [
      'Too short a stride, which turns it into a knee-forward grind.',
      'Leaning over the front thigh.',
      'Doing far more repetitions on the stronger leg.',
    ],
    substitute: 'Hold a wall or a chair with one hand for balance until the pattern is steady.',
    recommendedReps: '3 sets of 8–12 each leg.',
    mobility: [
      mob('Split stance', { legL: 26, legR: 22, kneeL: 12, kneeR: 14, armL: 14, armR: 14 }),
      mob('Knee down', {
        legL: 30,
        legR: 40,
        kneeL: 74,
        kneeR: 96,
        armL: 26,
        armR: 26,
        lean: 8,
      }),
      mob('Drive up', { legL: 26, legR: 22, kneeL: 12, kneeR: 14, armL: 14, armR: 14 }),
    ],
  },
  {
    slug: 'str-reverse-lunge',
    name: 'Reverse lunges',
    kind: 'bodyweight',
    equipment: 'none',
    summary: 'Step back, drop the knee, drive back to standing. The recovery step, trained.',
    cues: [
      'Step back far enough that the front shin stays vertical.',
      'Drop the back knee to just above the floor.',
      'Push through the front heel to return — that is the recovery you make after every lunge on court.',
      'Alternate legs, or finish all of one side then the other.',
    ],
    faults: [
      'A short step back, which puts the whole load on the front knee.',
      'Bouncing the back knee off the floor.',
    ],
    substitute: 'Hold a wall for balance, or shorten the range until it is controlled.',
    recommendedReps: '3 sets of 10 each leg.',
    mobility: [
      mob('Stand tall', { legL: 6, legR: 6, armL: 10, armR: 10 }),
      mob('Step back', {
        legL: 20,
        legR: 36,
        kneeL: 42,
        kneeR: 78,
        armL: 30,
        armR: 18,
        lean: 6,
      }),
      mob('Drive back', { legL: 6, legR: 6, armL: 10, armR: 10 }),
    ],
  },
  {
    slug: 'str-calf-raise',
    name: 'Calf raises',
    kind: 'bodyweight',
    equipment: 'none',
    summary: 'Up onto the toes, hold, and lower slowly. The ankles that survive landing.',
    cues: [
      'All the way up onto the balls of the feet, then a one-second hold at the top.',
      'Lower over three slow counts — the lowering is what builds the tendon.',
      'Keep the ankles tracking straight; do not roll out to the little toes.',
      'Single leg once both legs feel easy.',
    ],
    faults: [
      'Bouncing, which trains nothing and irritates the achilles.',
      'Half a range at the top.',
    ],
    substitute: 'Hold a wall for balance; that changes nothing about the work the calf does.',
    recommendedReps: '3 sets of 15–20, three seconds down each time.',
    mobility: [
      mob('Down', { legL: 5, legR: 5, armL: 8, armR: 8 }),
      mob('Up on the toes', { legL: 5, legR: 5, armL: 10, armR: 10, lift: 18 }),
      mob('Slow lower', { legL: 5, legR: 5, armL: 9, armR: 9, lift: 7 }),
    ],
  },
  {
    slug: 'str-wall-sit',
    name: 'Wall sit',
    kind: 'bodyweight',
    equipment: 'none',
    summary: 'Back flat to a wall, thighs parallel to the floor, and stay there.',
    cues: [
      'Slide down until the thighs are parallel and the knees are over the ankles.',
      'Whole back flat against the wall, hands off the thighs.',
      'Breathe steadily. This is the burn a long rally feels like.',
      'Come out of it before the knees start shaking, not after.',
    ],
    faults: [
      'Resting the hands on the thighs, which takes a third of the load away.',
      'Sitting too high to make the time.',
    ],
    substitute: 'Sit higher — anywhere above parallel still works, and it is honest.',
    recommendedReps: '3 holds of 30–60 seconds.',
    mobility: [
      mob('Slide down', {
        legL: 30,
        legR: 30,
        kneeL: 90,
        kneeR: 90,
        armL: 34,
        armR: 34,
        elbowL: 10,
        elbowR: 10,
      }),
      mob('Hold', {
        legL: 34,
        legR: 34,
        kneeL: 94,
        kneeR: 94,
        armL: 30,
        armR: 30,
        elbowL: 8,
        elbowR: 8,
      }),
    ],
  },
  {
    slug: 'str-russian-twist',
    name: 'Seated twists',
    kind: 'bodyweight',
    equipment: 'none',
    summary: 'Sit back on the tailbone, feet light, rotate the ribs from side to side.',
    cues: [
      'Lean back until you feel the stomach switch on, then stop there.',
      'Turn the ribs and the shoulders, not just the arms.',
      'Chest stays lifted; the moment the back rounds, sit up taller.',
      'The smash is a rotation, and this is where the rotation comes from.',
    ],
    faults: [
      'Waving the hands side to side while the torso stays still.',
      'Rounding the lower back and rocking.',
    ],
    substitute: 'Keep the heels on the floor, or sit more upright.',
    recommendedReps: '3 sets of 20 total turns, slow and controlled.',
    /*
     * No diagram on purpose.
     *
     * The figure renderer draws a front view. Sitting back on the tailbone with
     * the knees up is a side-view shape, and rotating a front view put the
     * figure in mid-air. Ships on its cues.
     */
  },

  /* ------------------------------------------------- warm-up: raise the heart rate */

  {
    slug: 'mob-march',
    name: 'March on the spot',
    kind: 'mobility',
    equipment: 'none',
    summary: 'Easy marching, knees to hip height, arms swinging naturally.',
    cues: [
      'Start genuinely easy. This is the first minute of the day for your legs.',
      'Land on the ball of the foot, not the heel.',
      'Let the arms swing — the shoulders need warming as much as the legs.',
      'Build the pace gradually across the block rather than starting fast.',
    ],
    faults: [
      'Going hard immediately, which defeats the point of a raise phase.',
      'Stiff arms pinned to the sides.',
    ],
    substitute: 'Walk briskly on the spot if the knees are cold or complaining.',
    recommendedReps: '45–60 seconds, building from easy to brisk.',
    mobility: [
      mob('Left knee up', { legL: 78, kneeL: 85, armR: 42, elbowR: 60, armL: -28 }),
      mob('Down', { legL: 4, legR: 4, armL: 8, armR: 8 }),
      mob('Right knee up', { legR: 78, kneeR: 85, armL: 42, elbowL: 60, armR: -28 }),
      mob('Down', { legL: 4, legR: 4, armL: 8, armR: 8 }),
    ],
  },
  {
    slug: 'mob-side-shuffle',
    name: 'Side shuffle',
    kind: 'mobility',
    equipment: 'none',
    summary: 'Low shuffle a few steps each way, staying in a ready position.',
    cues: [
      'Stay low the whole way — this is the stance you will play in.',
      'Feet never cross. Push off the trailing foot.',
      'Two or three steps each direction is plenty in a small space.',
      'Chest up, hands in front, as if waiting to receive.',
    ],
    faults: [
      'Bobbing up and down between steps instead of staying low.',
      'Crossing the feet, which is the habit you are trying not to build.',
    ],
    substitute: 'Shuffle on the spot, one step each way, if the room is tight.',
    recommendedReps: '45 seconds, changing direction every two or three steps.',
    mobility: [
      mob('Load left', {
        legL: 34,
        legR: 26,
        kneeL: 26,
        kneeR: 34,
        lift: -6,
        armL: 34,
        armR: 34,
        elbowL: 55,
        elbowR: 55,
      }),
      mob('Push across', {
        legL: 14,
        legR: 14,
        kneeL: 30,
        kneeR: 30,
        lift: -8,
        armL: 34,
        armR: 34,
        elbowL: 55,
        elbowR: 55,
      }),
      mob('Load right', {
        legL: 26,
        legR: 34,
        kneeL: 34,
        kneeR: 26,
        lift: -6,
        armL: 34,
        armR: 34,
        elbowL: 55,
        elbowR: 55,
      }),
      mob('Push back', {
        legL: 14,
        legR: 14,
        kneeL: 30,
        kneeR: 30,
        lift: -8,
        armL: 34,
        armR: 34,
        elbowL: 55,
        elbowR: 55,
      }),
    ],
  },

  /* --------------------------------------------- warm-up: mobilise the joints */

  {
    slug: 'mob-ankle-rolls',
    name: 'Ankle rolls and calf pumps',
    kind: 'mobility',
    equipment: 'none',
    summary: 'Circle each ankle both ways, then rise onto the toes and lower.',
    cues: [
      'Ankles first — they take the landing on every single lunge you will do.',
      'Full circles, slowly, both directions on each foot.',
      'Then ten slow calf raises, all the way up and all the way down.',
      'Hold a wall if balance is the limiting factor rather than the ankle.',
    ],
    faults: [
      'Rushing the circles so the joint never reaches end of range.',
      'Bouncing the calf raises instead of controlling them down.',
    ],
    substitute: null,
    recommendedReps: '30 seconds: ten circles each ankle, then ten calf raises.',
    mobility: [
      mob('Heels down', { legL: 6, legR: 6, lift: 0 }),
      mob('Rise onto toes', { legL: 6, legR: 6, lift: 9, armL: 16, armR: 16 }),
      mob('Hold', { legL: 6, legR: 6, lift: 10, armL: 18, armR: 18 }),
      mob('Lower slowly', { legL: 6, legR: 6, lift: 2 }),
    ],
  },
  {
    slug: 'mob-leg-swings-front',
    name: 'Leg swings, front to back',
    kind: 'mobility',
    equipment: 'none',
    summary: 'Hold something steady and swing one leg forwards and back, relaxed.',
    cues: [
      'Swing from the hip with a loose leg — do not force the height.',
      'Range grows over the set. The first swings should be small.',
      'Keep the torso upright rather than folding forward to gain height.',
      'Ten each leg is enough.',
    ],
    faults: [
      'Kicking hard for maximum height on the first rep.',
      'Twisting the lower back to swing higher.',
    ],
    substitute: 'Hold a wall or a chair back if balance is awkward.',
    recommendedReps: '30 seconds, ten swings each leg.',
    mobility: [
      mob('Swing forward', { legR: 62, legL: 6, armL: 46, elbowL: 20 }),
      mob('Through the middle', { legR: 4, legL: 4, armL: 46, elbowL: 20 }),
      mob('Swing back', { legR: -46, legL: 2, armL: 46, elbowL: 20, lean: 6 }),
      mob('Through the middle', { legR: 4, legL: 4, armL: 46, elbowL: 20 }),
    ],
  },
  {
    slug: 'mob-leg-swings-side',
    name: 'Leg swings, side to side',
    kind: 'mobility',
    equipment: 'none',
    summary: 'Same idea across the body — this is the direction badminton actually uses.',
    cues: [
      'Across the body and out, relaxed, from the hip.',
      'This one matters: almost every court movement is sideways.',
      'Stay square to the front — let the leg move, not the hips.',
      'Ten each leg.',
    ],
    faults: [
      'Rotating the whole body instead of moving at the hip.',
      'Going for range before the joint is warm.',
    ],
    substitute: 'Hold a wall for balance and reduce the range.',
    recommendedReps: '30 seconds, ten swings each leg.',
    mobility: [
      mob('Across the body', { legR: -38, legL: 2, armL: 62, armR: 62 }),
      mob('Through the middle', { legR: 2, legL: 2, armL: 62, armR: 62 }),
      mob('Out to the side', { legR: 54, legL: 2, armL: 62, armR: 62 }),
      mob('Through the middle', { legR: 2, legL: 2, armL: 62, armR: 62 }),
    ],
  },
  {
    slug: 'mob-hip-openers',
    name: 'Hip openers',
    kind: 'mobility',
    equipment: 'none',
    summary: 'Knee to chest, then open it out to the side. Alternate legs, walking or on the spot.',
    cues: [
      'Knee up and hug it briefly, then open the knee out to the side and step down.',
      'Slow and deliberate — this is the joint that does the lunging.',
      'Stand tall throughout; do not lean back to lift the knee higher.',
      'Five each side.',
    ],
    faults: [
      'Rushing so the hip never actually reaches its range.',
      'Leaning backwards to fake a higher knee.',
    ],
    substitute: null,
    recommendedReps: '30 seconds, five each side.',
    mobility: [
      mob('Knee up', { legR: 74, kneeR: 90, armR: 40, elbowR: 70 }),
      mob('Open the gate', { legR: 58, kneeR: 88, twist: 16, armR: 52, elbowR: 60 }),
      mob('Step down', { legR: 10, kneeR: 12, armR: 12 }),
      mob('Tall', { legL: 4, legR: 4 }),
    ],
  },
  {
    slug: 'mob-arm-circles',
    name: 'Arm circles and shoulder rolls',
    kind: 'mobility',
    equipment: 'none',
    summary: 'Big circles forwards and back, then loose shoulder rolls.',
    cues: [
      'Big, slow circles — ten forwards, ten backwards.',
      'The racket shoulder does every overhead you play. Do not skip it.',
      'Finish with loose shoulder rolls to settle everything down.',
      'Stay relaxed; this is not a strength exercise.',
    ],
    faults: [
      'Small, tense circles that never reach overhead.',
      'Shrugging the shoulders up towards the ears.',
    ],
    substitute: null,
    recommendedReps: '30 seconds: ten circles each way, then shoulder rolls.',
    mobility: [
      mob('Arms down', { armR: 0, armL: 0 }),
      mob('Forward and up', { armR: 92, armL: 92 }),
      mob('Overhead', { armR: 176, armL: 176 }),
      mob('Behind and round', { armR: 268, armL: 268 }),
    ],
  },
  {
    slug: 'mob-torso-twists',
    name: 'Torso twists',
    kind: 'mobility',
    equipment: 'none',
    summary: 'Feet planted, rotate the upper body side to side with loose arms.',
    cues: [
      'Rotate from the middle of the back, not the lower back.',
      'Let the arms hang and follow — do not swing them for momentum.',
      'Hips stay facing forward while the shoulders turn.',
      'Smooth and controlled, no bouncing at the end of the turn.',
    ],
    faults: [
      'Whipping round using arm momentum, which strains rather than warms.',
      'Turning the hips with the shoulders, which removes the rotation.',
    ],
    substitute: null,
    recommendedReps: '30 seconds of slow, controlled rotations.',
    mobility: [
      mob('Turn left', { twist: -42, armL: 58, armR: 30, elbowL: 40, elbowR: 55 }),
      mob('Centre', { twist: 0, armL: 40, armR: 40, elbowL: 45, elbowR: 45 }),
      mob('Turn right', { twist: 42, armL: 30, armR: 58, elbowL: 55, elbowR: 40 }),
      mob('Centre', { twist: 0, armL: 40, armR: 40, elbowL: 45, elbowR: 45 }),
    ],
  },

  /* ------------------------------------ warm-up: potentiate, badminton-specific */

  {
    slug: 'mob-split-steps',
    name: 'Shadow split-steps',
    kind: 'mobility',
    equipment: 'none',
    summary: 'Small hops landing wide and loaded, as if your opponent were about to strike.',
    cues: [
      'Land wide, low, on the balls of the feet — knees soft.',
      'Absorb the landing. You are loading a spring, not jumping a rope.',
      'Push off immediately in a random direction after each landing.',
      'This is the single most transferable thing in the whole warm-up.',
    ],
    faults: [
      'Hopping high instead of landing wide and low.',
      'Landing with the feet together, which gives nothing to push against.',
    ],
    substitute: null,
    recommendedReps: '30 seconds of continuous split-steps and pushes.',
    mobility: [
      mob('Ready', {
        legL: 16,
        legR: 16,
        kneeL: 10,
        kneeR: 10,
        armL: 40,
        armR: 40,
        elbowL: 60,
        elbowR: 60,
      }),
      mob('Hop', {
        legL: 10,
        legR: 10,
        kneeL: 16,
        kneeR: 16,
        lift: 11,
        armL: 28,
        armR: 28,
        elbowL: 50,
        elbowR: 50,
      }),
      mob('Land wide and low', {
        legL: 42,
        legR: 42,
        kneeL: 22,
        kneeR: 22,
        armL: 48,
        armR: 48,
        elbowL: 50,
        elbowR: 50,
        lean: 10,
      }),
      mob('Push off', {
        legL: 38,
        legR: 24,
        kneeL: 16,
        kneeR: 20,
        armL: 46,
        armR: 28,
        elbowL: 40,
        elbowR: 55,
        lean: 6,
      }),
    ],
  },
  {
    slug: 'mob-corner-walk',
    name: 'Half-pace corner movement',
    kind: 'mobility',
    equipment: 'none',
    summary: 'Move to each corner at roughly half speed, with the proper footwork.',
    cues: [
      'Half pace, full technique. Chassé to the sides, lunge to the net.',
      'Recover through your base every time — build the habit while it is easy.',
      'Turn the hips before travelling to the rear corners.',
      'If a corner feels tight, spend an extra rep there rather than pushing it.',
    ],
    faults: [
      'Going full speed, which is a drill and not a warm-up.',
      'Skipping the recovery because it is "only a warm-up".',
    ],
    substitute: 'No court? Move to four imagined corners in whatever space you have.',
    recommendedReps: '45 seconds, covering every corner at least twice.',
    mobility: [
      mob('Ready at base', {
        legL: 12,
        legR: 12,
        kneeL: 18,
        kneeR: 18,
        armL: 40,
        armR: 40,
        elbowL: 60,
        elbowR: 60,
      }),
      mob('Chassé across', {
        legL: 30,
        legR: 22,
        kneeL: 26,
        kneeR: 30,
        lift: -6,
        armL: 44,
        armR: 34,
        elbowL: 45,
        elbowR: 55,
      }),
      mob('Lunge to the net', {
        legL: 34,
        legR: 58,
        kneeL: 12,
        kneeR: 62,
        lift: -12,
        lean: 16,
        armR: 74,
        elbowR: 25,
        armL: -34,
      }),
      mob('Push back to base', {
        legL: 18,
        legR: 20,
        kneeL: 22,
        kneeR: 26,
        lift: -4,
        armL: 40,
        armR: 40,
        elbowL: 60,
        elbowR: 60,
      }),
    ],
  },
  {
    slug: 'mob-shadow-swings',
    name: 'Shadow swings',
    kind: 'mobility',
    equipment: 'none',
    summary: 'Overhead, drop and net swings with no shuttle, building to full speed.',
    cues: [
      'Start slow and small, finish at close to full speed.',
      'Full rotation through the body on the overheads, not arm-only swings.',
      'Mix them: clear, drop, a couple of net shots, a backhand.',
      'Racket in hand if you have one — the weight changes the movement.',
    ],
    faults: [
      'Swinging hard from the first rep with a cold shoulder.',
      'Arm-only swings, which warm up the one joint most likely to complain.',
    ],
    substitute: 'No racket to hand? The pattern still works empty-handed.',
    recommendedReps: '30 seconds, building from easy to sharp.',
    mobility: [
      mob('Racket up', { armR: 128, elbowR: 62, armL: 96, twist: 22, legR: -8 }),
      mob('Reach back', { armR: 168, elbowR: 88, armL: 118, twist: 34, lean: -8, legR: -12 }),
      mob('Contact overhead', { armR: 186, elbowR: 6, armL: 60, twist: -6, lift: 5 }),
      mob('Follow through', { armR: 78, elbowR: 34, armL: 12, twist: -28, lean: 10 }),
    ],
  },

  /* ------------------------------------------------------------ cool-down */

  {
    slug: 'cool-walk',
    name: 'Walk it off',
    kind: 'stretch',
    equipment: 'none',
    summary: 'Easy walking or marching while your breathing comes back down.',
    cues: [
      'Keep moving — stopping dead after hard work is what makes you feel faint.',
      'Breathe in through the nose, out slowly through the mouth.',
      'Shake the arms and legs out as you go.',
      'You should be able to hold a conversation by the end of this.',
    ],
    faults: [
      'Sitting straight down the moment the timer stops.',
      'Rushing this so you can get to the stretching.',
    ],
    substitute: null,
    recommendedReps: '60 seconds, until your breathing has settled.',
    poses: [pose('Step', 0.1, 0, 0.15, 0.3, 0.3, 0.6), pose('Step', 0.1, 0, 0.15, -0.3, 0.3, -0.6)],
    mobility: [
      mob('Step', { legL: 34, kneeL: 26, legR: -22, armR: 26, armL: -18 }),
      mob('Through', { legL: 4, legR: 4, armL: 6, armR: 6 }),
      mob('Step', { legR: 34, kneeR: 26, legL: 22, armL: 26, armR: -18 }),
      mob('Breathe out', { legL: 4, legR: 4, armL: 10, armR: 10 }),
    ],
  },
  {
    slug: 'cool-calf-stretch',
    name: 'Calf stretch',
    kind: 'stretch',
    equipment: 'none',
    summary: 'Back leg straight, heel pressed down, leaning into a wall.',
    cues: [
      'Back heel stays flat on the floor — that is the whole stretch.',
      'Hold steadily. No bouncing.',
      'Then bend the back knee slightly to reach the lower calf too.',
      'Roughly 20 seconds each side.',
    ],
    faults: ['Letting the back heel lift, which stretches nothing.', 'Bouncing to push deeper.'],
    substitute: 'Use a step edge, or press against any wall.',
    recommendedReps: '45 seconds, about 20 each side.',
    mobility: [
      mob('Split the stance', {
        legL: 34,
        legR: 22,
        kneeR: 30,
        lean: 14,
        armL: 78,
        armR: 78,
        elbowL: 20,
        elbowR: 20,
      }),
      mob('Press the heel down', {
        legL: 38,
        legR: 26,
        kneeR: 36,
        lean: 20,
        armL: 82,
        armR: 82,
        elbowL: 14,
        elbowR: 14,
      }),
      mob('Hold', {
        legL: 38,
        legR: 26,
        kneeR: 36,
        lean: 20,
        armL: 82,
        armR: 82,
        elbowL: 14,
        elbowR: 14,
      }),
      mob('Bend the back knee', {
        legL: 32,
        legR: 24,
        kneeL: 22,
        kneeR: 32,
        lean: 18,
        armL: 80,
        armR: 80,
        elbowL: 16,
        elbowR: 16,
      }),
    ],
  },
  {
    slug: 'cool-quad-stretch',
    name: 'Quad stretch',
    kind: 'stretch',
    equipment: 'none',
    summary: 'Heel to backside, knees together, standing tall.',
    cues: [
      'Keep the knees level with each other — do not let the knee drift out.',
      'Squeeze the glute on the stretching side and stand tall.',
      'Hold a wall for balance rather than wobbling through it.',
      'Roughly 20 seconds each side.',
    ],
    faults: [
      'Arching the lower back to pull the heel higher.',
      'Letting the knee swing forward, which loses the hip flexor entirely.',
    ],
    substitute: 'Lie on your side if standing balance is the problem.',
    recommendedReps: '45 seconds, about 20 each side.',
    mobility: [
      mob('Stand tall', { legL: 2, legR: 2, armL: 62, elbowL: 30 }),
      mob('Heel to backside', {
        legR: -18,
        kneeR: 132,
        armR: -42,
        elbowR: 74,
        armL: 62,
        elbowL: 30,
      }),
      mob('Knees together, hold', {
        legR: -8,
        kneeR: 140,
        armR: -34,
        elbowR: 78,
        armL: 62,
        elbowL: 30,
      }),
      mob('Squeeze the glute', {
        legR: -14,
        kneeR: 138,
        armR: -38,
        elbowR: 76,
        armL: 62,
        elbowL: 30,
      }),
    ],
  },
  {
    slug: 'cool-hamstring-stretch',
    name: 'Hamstring stretch',
    kind: 'stretch',
    equipment: 'none',
    summary: 'One heel forward, toes up, hinge at the hips with a flat back.',
    cues: [
      'Hinge from the hips, not by rounding the spine.',
      'Front leg straight but not locked, toes pulled up.',
      'Chest towards the toes rather than nose towards the knee.',
      'Roughly 20 seconds each side.',
    ],
    faults: [
      'Rounding the back, which moves the stretch into the spine.',
      'Locking the knee out hard.',
    ],
    substitute: 'Sit and reach towards one foot at a time if standing is awkward.',
    recommendedReps: '45 seconds, about 20 each side.',
    mobility: [
      mob('Heel forward', { legR: 26, legL: 10, kneeL: 16, lean: 6 }),
      mob('Hinge at the hips', { legR: 30, legL: 12, kneeL: 22, lean: 34, armR: 54, armL: 54 }),
      mob('Chest towards the toes', {
        legR: 32,
        legL: 12,
        kneeL: 24,
        lean: 46,
        armR: 62,
        armL: 62,
      }),
      mob('Hold, flat back', { legR: 32, legL: 12, kneeL: 24, lean: 44, armR: 60, armL: 60 }),
    ],
  },
  {
    slug: 'cool-hip-flexor-stretch',
    name: 'Hip flexor stretch',
    kind: 'stretch',
    equipment: 'none',
    summary: 'Half-kneeling lunge, hips pushed gently forward, tall through the chest.',
    cues: [
      'Tuck the pelvis under before you push forward — otherwise you just arch.',
      'Squeeze the glute on the kneeling side.',
      'Every lunge you did today shortened these. This is the one to keep.',
      'Roughly 20 seconds each side.',
    ],
    faults: [
      'Arching the lower back instead of tucking the pelvis.',
      'Pushing so far forward that the front knee collapses inward.',
    ],
    substitute: 'Kneel on something soft, or do it standing in a split stance.',
    recommendedReps: '45 seconds, about 20 each side.',
    mobility: [
      mob('Half kneel', { legR: 62, kneeR: 96, legL: 30, kneeL: 128, armL: 16, armR: 16 }),
      mob('Tuck the pelvis', {
        legR: 64,
        kneeR: 98,
        legL: 34,
        kneeL: 130,
        lean: -7,
        armL: 20,
        armR: 20,
      }),
      mob('Ease forward', {
        legR: 72,
        kneeR: 104,
        legL: 40,
        kneeL: 134,
        lean: -9,
        armL: 24,
        armR: 24,
      }),
      mob('Hold, chest tall', {
        legR: 70,
        kneeR: 102,
        legL: 38,
        kneeL: 132,
        lean: -8,
        armL: 22,
        armR: 22,
      }),
    ],
  },
  {
    slug: 'cool-shoulder-stretch',
    name: 'Shoulder and chest stretch',
    kind: 'stretch',
    equipment: 'none',
    summary: 'Arm across the body, then a doorway or clasped-hands chest opener.',
    cues: [
      'Arm across the chest, pull gently above the elbow, not on the joint.',
      'Then open the chest — hands clasped behind you, or a doorway.',
      'Breathe out as you settle into each one.',
      'Roughly 20 seconds each.',
    ],
    faults: [
      'Pulling on the elbow joint itself.',
      'Skipping the racket shoulder because it feels fine right now.',
    ],
    substitute: null,
    recommendedReps: '45 seconds across both stretches.',
    mobility: [
      mob('Arm across', { armR: 74, elbowR: -58, armL: 54, elbowL: 34 }),
      mob('Pull above the elbow', { armR: 82, elbowR: -70, armL: 60, elbowL: 40 }),
      mob('Hold', { armR: 82, elbowR: -70, armL: 60, elbowL: 40 }),
      mob('Open the chest', { armR: -48, armL: -48, elbowR: 18, elbowL: 18, lean: -6 }),
    ],
  },
]

export function findExercise(slug: string): Exercise | undefined {
  return EXERCISES.find((exercise) => exercise.slug === slug)
}
