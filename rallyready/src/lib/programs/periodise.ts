import type { DrillLocation, ProgramFocus, SkillLevel } from '@/lib/data/types'

/**
 * Turns a short program specification into a full week-by-week plan.
 *
 * Periodisation is the whole point of a program: training hard for twelve
 * straight weeks is how a returning player gets injured, and training easy for
 * twelve weeks is how they get bored. So the plan alternates loading blocks
 * with deloads, and moves the emphasis from Base (movement quality and volume)
 * through Build (work capacity) to Sharpen (speed and reaction), tapering at
 * the end.
 *
 * Deterministic: the same spec always produces the same plan, which makes it
 * testable and means a published program looks identical to everyone.
 */

export type ProgramPhase = 'base' | 'build' | 'sharpen' | 'deload'

export interface ProgramSpec {
  totalWeeks: number
  /** Training sessions per week during a loading block, 2–6. */
  sessionsPerWeek: number
  level: SkillLevel
  location: DrillLocation
}

export interface PlannedDay {
  weekNo: number
  /** 1 = Monday … 7 = Sunday. */
  dayNo: number
  phase: ProgramPhase
  focus: ProgramFocus
  title: string
  drillSlugs: string[]
  notes: string | null
}

export const PHASE_LABEL: Record<ProgramPhase, string> = {
  base: 'Base',
  build: 'Build',
  sharpen: 'Sharpen',
  deload: 'Deload',
}

export const PHASE_BLURB: Record<ProgramPhase, string> = {
  base: 'Movement quality and volume. Nothing here should feel desperate.',
  build: 'Work capacity. The blocks get longer and the recovery gets shorter.',
  sharpen: 'Speed and reaction. Short, fast, and fully recovered between efforts.',
  deload: 'Back off on purpose. This is where the previous weeks turn into fitness.',
}

const MIN_WEEKS = 4
const MAX_WEEKS = 16

/** Which day numbers carry a session, by how many sessions the week holds. */
const SESSION_DAYS: Record<number, number[]> = {
  2: [2, 5],
  3: [1, 3, 5],
  4: [1, 2, 4, 6],
  5: [1, 2, 3, 5, 6],
  6: [1, 2, 3, 4, 5, 6],
}

/* ------------------------------------------------------------- drill pools */

/** Every pool is ordered easiest first; `phaseSlice` relies on that order. */
interface Pools {
  footwork: string[]
  conditioning: string[]
  speed: string[]
}

/**
 * Off court, the shadow drills that scale down to a small space stand in for
 * the full-court ones — you can ghost a six-corner pattern in a garage at half
 * scale, but you cannot run a rear-court scissor recovery in one.
 *
 * ## Order is the difficulty curve
 *
 * `phaseSlice` gives base and deload weeks the first half of a pool and
 * sharpen weeks the last half, so these are written gentlest first. Putting a
 * plyometric circuit early would hand a returning player jump training in
 * week one under the heading "Easy conditioning".
 *
 * A pool is also the only way a drill reaches somebody following a program.
 * Anything added to the catalogue and left out of here exists solely for
 * people who browse, which is not most people — the rally patterns and the
 * home circuits both sat outside these lists until it was noticed.
 */
const COURT_POOLS: Pools = {
  footwork: [
    'four-corner-footwork',
    'net-footwork',
    'six-corner-shadow',
    'rear-court-scissor',
    'singles-rally-patterns',
    'doubles-rally-patterns',
  ],
  conditioning: [
    'home-full-body',
    'agility-ladder-circuit',
    'match-rhythm-intervals',
    'rally-hiit',
  ],
  speed: [
    'multifeed-shadow',
    'front-court-speed',
    'defence-into-attack',
    'deception-reaction',
    'hold-and-deceive',
    'tabata-shadow',
  ],
}

const ANYWHERE_POOLS: Pools = {
  footwork: ['match-rhythm-intervals', 'rally-hiit'],
  conditioning: [
    'quiet-room-workout',
    'home-full-body',
    'home-court-circuit',
    'skipping-intervals',
    'agility-ladder-circuit',
    'plyometric-power-circuit',
    'home-explosive',
  ],
  speed: ['multifeed-shadow', 'tabata-shadow'],
}

/**
 * Every slug any pool can produce.
 *
 * Exported so a test can check they all resolve to real drills. A typo in a
 * pool does not throw — it produces a program day pointing at nothing, which
 * shows up as a blank session weeks later.
 */
export function pooledSlugs(): string[] {
  const all = [COURT_POOLS, ANYWHERE_POOLS].flatMap((pools) => [
    ...pools.footwork,
    ...pools.conditioning,
    ...pools.speed,
  ])
  return [...new Set(all)]
}

/** A session slot: what the day is for, and which pool to draw from. */
interface Slot {
  focus: ProgramFocus
  pool: keyof Pools | 'matchplay'
  title: string
  notes: string | null
}

const REST: Omit<PlannedDay, 'weekNo' | 'dayNo' | 'phase'> = {
  focus: 'rest',
  title: 'Rest',
  drillSlugs: [],
  notes: 'Walk, stretch, sleep. Rest days are part of the plan, not a gap in it.',
}

/**
 * The shape of a week in each phase, as a repeating pattern of slots. Longer
 * weeks simply take more of the pattern.
 */
const PHASE_SLOTS: Record<ProgramPhase, Slot[]> = {
  base: [
    {
      focus: 'footwork',
      pool: 'footwork',
      title: 'Footwork — technique',
      notes: 'Quality over pace. Stop the block if the movement gets scrappy.',
    },
    {
      focus: 'conditioning',
      pool: 'conditioning',
      title: 'Easy conditioning',
      notes: 'Comfortably hard. You should be able to speak in the rest.',
    },
    {
      focus: 'footwork',
      pool: 'footwork',
      title: 'Footwork — volume',
      notes: 'Add a round rather than adding speed.',
    },
    {
      focus: 'conditioning',
      pool: 'conditioning',
      title: 'Circuit',
      notes: null,
    },
    {
      focus: 'matchplay',
      pool: 'matchplay',
      title: 'Play',
      notes: 'Social games. Play, do not train — this is the fun one.',
    },
    {
      focus: 'footwork',
      pool: 'footwork',
      title: 'Footwork — technique',
      notes: null,
    },
  ],
  build: [
    {
      focus: 'footwork',
      pool: 'footwork',
      title: 'Footwork under load',
      notes: 'Hold your form into the last round. That is the whole session.',
    },
    {
      focus: 'conditioning',
      pool: 'conditioning',
      title: 'Intervals',
      notes: 'Take the full rest. Cutting it short trains the wrong thing.',
    },
    {
      focus: 'footwork',
      pool: 'speed',
      title: 'Reaction work',
      notes: null,
    },
    {
      focus: 'conditioning',
      pool: 'conditioning',
      title: 'Hard conditioning',
      notes: 'The one you will want to skip. Do it anyway.',
    },
    {
      focus: 'matchplay',
      pool: 'matchplay',
      title: 'Match play',
      notes: 'Competitive games. Notice where your movement breaks down first.',
    },
    {
      focus: 'footwork',
      pool: 'footwork',
      title: 'Footwork — volume',
      notes: null,
    },
  ],
  sharpen: [
    {
      focus: 'footwork',
      pool: 'speed',
      title: 'Speed and reaction',
      notes: 'Short and fast. Fully recovered before every block.',
    },
    {
      focus: 'conditioning',
      pool: 'speed',
      title: 'Sharp intervals',
      notes: 'Ten-second efforts. Empty the tank, then take the whole rest.',
    },
    {
      focus: 'matchplay',
      pool: 'matchplay',
      title: 'Match play',
      notes: 'Play as if it counts. This is what the last weeks were for.',
    },
    {
      focus: 'footwork',
      pool: 'footwork',
      title: 'Footwork — crisp',
      notes: 'Cut the volume, keep the pace.',
    },
    {
      focus: 'conditioning',
      pool: 'conditioning',
      title: 'Power circuit',
      notes: null,
    },
    {
      focus: 'footwork',
      pool: 'speed',
      title: 'Reaction work',
      notes: null,
    },
  ],
  deload: [
    {
      focus: 'footwork',
      pool: 'footwork',
      title: 'Easy footwork',
      notes: 'Half the usual rounds. Move well, do not chase the clock.',
    },
    {
      focus: 'matchplay',
      pool: 'matchplay',
      title: 'Play for fun',
      notes: 'No score, no pressure.',
    },
    {
      focus: 'conditioning',
      pool: 'conditioning',
      title: 'Light circuit',
      notes: 'One round fewer than you think you need.',
    },
    {
      focus: 'footwork',
      pool: 'footwork',
      title: 'Easy footwork',
      notes: null,
    },
  ],
}

/* --------------------------------------------------------------- phase map */

function clampWeeks(weeks: number): number {
  if (!Number.isFinite(weeks)) return 8
  return Math.min(MAX_WEEKS, Math.max(MIN_WEEKS, Math.round(weeks)))
}

function clampSessions(sessions: number): number {
  if (!Number.isFinite(sessions)) return 3
  return Math.min(6, Math.max(2, Math.round(sessions)))
}

/**
 * Every fourth week is a deload, and so is the final week — a taper.
 * The loading weeks left over split into three contiguous blocks, with any
 * remainder going to Base: more base is the safer error for a returning player.
 */
export function phaseByWeek(totalWeeks: number): ProgramPhase[] {
  const weeks = clampWeeks(totalWeeks)
  const isDeload = new Set<number>()
  for (let week = 4; week < weeks; week += 4) isDeload.add(week)
  isDeload.add(weeks)

  const loading: number[] = []
  for (let week = 1; week <= weeks; week++) if (!isDeload.has(week)) loading.push(week)

  const base = Math.ceil(loading.length / 3)
  const build = Math.ceil((loading.length - base) / 2)

  const phases: ProgramPhase[] = []
  for (let week = 1; week <= weeks; week++) {
    if (isDeload.has(week)) {
      phases.push('deload')
      continue
    }
    const index = loading.indexOf(week)
    phases.push(index < base ? 'base' : index < base + build ? 'build' : 'sharpen')
  }
  return phases
}

/* ----------------------------------------------------------------- planner */

/** Deload weeks train one session fewer, never fewer than two. */
function sessionsForWeek(phase: ProgramPhase, sessionsPerWeek: number): number {
  return phase === 'deload' ? Math.max(2, sessionsPerWeek - 1) : sessionsPerWeek
}

function poolsFor(location: DrillLocation): Pools {
  return location === 'anywhere' ? ANYWHERE_POOLS : COURT_POOLS
}

/**
 * Beginners skip the speed pool entirely — reaction work on undeveloped
 * footwork just rehearses bad movement faster.
 */
function resolvePool(slot: Slot, pools: Pools, level: SkillLevel): string[] {
  if (slot.pool === 'matchplay') return []
  if (slot.pool === 'speed' && level === 'beginner') return pools.footwork
  return pools[slot.pool]
}

/**
 * A phase only draws from the part of the pool it has earned: base and deload
 * weeks stay in the gentler half, sharpen weeks in the harder half, and build
 * weeks use the lot. Without this, week one of a base block could hand a
 * returning player a plyometric circuit under the heading "Easy conditioning".
 */
function phaseSlice(pool: string[], phase: ProgramPhase): string[] {
  if (pool.length < 2) return pool
  const half = Math.ceil(pool.length / 2)
  if (phase === 'base' || phase === 'deload') return pool.slice(0, half)
  if (phase === 'sharpen') return pool.slice(pool.length - half)
  return pool
}

export function periodise(spec: ProgramSpec): PlannedDay[] {
  const totalWeeks = clampWeeks(spec.totalWeeks)
  const sessionsPerWeek = clampSessions(spec.sessionsPerWeek)
  const phases = phaseByWeek(totalWeeks)
  const pools = poolsFor(spec.location)

  const days: PlannedDay[] = []
  // Walks the phase's slot pattern across the whole program, so consecutive
  // weeks do not repeat the same session on the same weekday.
  let slotCursor = 0

  for (let weekNo = 1; weekNo <= totalWeeks; weekNo++) {
    const phase = phases[weekNo - 1] ?? 'base'
    const slots = PHASE_SLOTS[phase]
    const count = sessionsForWeek(phase, sessionsPerWeek)
    const sessionDays = SESSION_DAYS[count] ?? SESSION_DAYS[3]!

    for (let dayNo = 1; dayNo <= 7; dayNo++) {
      const slotIndex = sessionDays.indexOf(dayNo)
      if (slotIndex === -1) {
        days.push({ weekNo, dayNo, phase, ...REST })
        continue
      }

      const slot = slots[(slotCursor + slotIndex) % slots.length] as Slot
      const pool = phaseSlice(resolvePool(slot, pools, spec.level), phase)
      const drillSlugs = pool.length > 0 ? [pool[(weekNo + slotIndex) % pool.length] as string] : []

      days.push({
        weekNo,
        dayNo,
        phase,
        focus: slot.focus,
        title: slot.title,
        drillSlugs,
        notes: slot.notes,
      })
    }
    slotCursor += count
  }

  return days
}

/** Sessions (i.e. non-rest days) in a generated plan. */
export function countSessions(days: PlannedDay[]): number {
  return days.filter((day) => day.focus !== 'rest').length
}
