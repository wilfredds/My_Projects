import type { CornerId, CourtLayout } from '@/lib/timer/corners'
import type { DrillMode } from '@/lib/timer/types'

/**
 * Domain types. These are what the UI sees; the shape of a particular backend
 * (Postgres columns, localStorage blobs) never leaks past the repository layer.
 */

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced'
export type Discipline = 'singles' | 'doubles' | 'both'

/** What the player is actually training for; steers the first recommendation. */
export type TrainingGoal = 'stamina' | 'footwork' | 'match-ready' | 'consistency'

export type DrillCategory =
  | 'footwork'
  | 'net'
  | 'rear-court'
  | 'conditioning'
  | 'strength'
  | 'agility'
  | 'plyometric'
  | 'warmup'
  | 'cooldown'

/** How the drill is performed, as opposed to how calls are chosen. */
export type DrillStyle = 'shadow' | 'ghosting' | 'ladder' | 'hiit' | 'custom'

/** Whether the workout needs a court, or can be done in a garage. */
export type DrillLocation = 'court' | 'anywhere'

/** What a program day is for. */
export type ProgramFocus = 'footwork' | 'conditioning' | 'rest' | 'matchplay'

/**
 * One exercise in a conditioning circuit. A drill carrying these runs as a
 * circuit rather than a corner-calling drill.
 */
export interface CircuitStep {
  exerciseSlug: string
  workSec: number
  restSec: number
}

export type SessionSource = 'timer' | 'conditioning' | 'benchmark'

export interface Profile {
  id: string
  displayName: string
  avatarUrl: string | null
  skillLevel: SkillLevel
  primaryDiscipline: Discipline
  goal: TrainingGoal
  /** Whether they can get on a court, which decides which programs suit. */
  courtAccess: DrillLocation
  createdAt: string
}

export interface Drill {
  id: string
  slug: string
  name: string
  category: DrillCategory
  style: DrillStyle
  description: string
  coachingCues: string[]
  commonFaults: string[]
  defaultWorkSec: number
  defaultRestSec: number
  defaultRounds: number
  /** Board layout: 4, 6 or 8 target zones. */
  corners: CourtLayout
  videoUrl: string | null
  isPublic: boolean
  createdBy: string | null

  /* Engine defaults — what the Phase-1 timer needs to run the drill. */
  defaultIntervalMs: number
  defaultCallMode: DrillMode
  /** Subset of the layout to use; null means every zone. */
  enabledCorners: CornerId[] | null
  defaultWarmupSec: number
  defaultCooldownSec: number
  level: SkillLevel

  /* Conditioning (Phase 3) */
  /** Non-null makes this a circuit workout rather than a corner-call drill. */
  circuit: CircuitStep[] | null
  /** How many times the circuit repeats. Ignored when `circuit` is null. */
  circuitRounds: number
  location: DrillLocation
  /** Free-text kit list, e.g. ["agility ladder"]. Empty means nothing needed. */
  equipment: string[]
}

export interface Session {
  id: string
  userId: string | null
  /** Drill slug locally, drill uuid once signed in; opaque to the UI. */
  drillId: string | null
  drillName: string | null
  startedAt: string
  durationSec: number
  roundsCompleted: number
  avgShotIntervalMs: number | null
  notes: string | null
  source: SessionSource
}

export interface NewSession {
  drillId: string | null
  drillName: string | null
  startedAt: Date
  durationSec: number
  roundsCompleted: number
  avgShotIntervalMs: number | null
  notes?: string | null
  source: SessionSource
}

export interface SessionMetric {
  id: string
  sessionId: string
  metricKey: string
  metricValue: number
}

export interface NewSessionMetric {
  metricKey: string
  metricValue: number
}

export type BenchmarkTest = 'b_endurance_style' | 'spider_sprint'

export interface Benchmark {
  id: string
  userId: string | null
  testType: BenchmarkTest
  takenAt: string
  /** The headline number to chase — total corner touches completed. */
  score: number
  /** Highest level completed in full. */
  levelReached: number | null
  raw: Record<string, unknown>
}

export interface NewBenchmark {
  testType: BenchmarkTest
  takenAt: Date
  score: number
  levelReached: number | null
  raw?: Record<string, unknown>
}

/* ------------------------------------------------- Programs (Phase 4) */

export type EnrollmentStatus = 'active' | 'paused' | 'completed' | 'abandoned'

export interface Program {
  id: string
  slug: string
  name: string
  description: string
  totalWeeks: number
  level: SkillLevel
  /** Whether the plan assumes court access. */
  location: DrillLocation
  sessionsPerWeek: number
  isPublic: boolean
  createdBy: string | null
  createdAt: string
}

export interface ProgramDay {
  id: string
  programId: string
  weekNo: number
  /** 1 = Monday … 7 = Sunday. */
  dayNo: number
  title: string
  focus: ProgramFocus
  /**
   * Drills by slug rather than id. Slugs are stable across re-seeding and
   * identical on both backends, where a uuid would have to be resolved twice.
   */
  drillSlugs: string[]
  notes: string | null
}

export interface NewProgram {
  name: string
  description: string
  totalWeeks: number
  level: SkillLevel
  location: DrillLocation
  sessionsPerWeek: number
  isPublic: boolean
}

export interface ProgramEnrollment {
  id: string
  userId: string | null
  programId: string
  startedOn: string
  currentWeek: number
  currentDay: number
  status: EnrollmentStatus
}

/* ------------------------------------------------ Readiness (Phase 6) */

/**
 * The daily check-in, each answer 1 (bad) to 5 (good). Soreness is stored the
 * same way round as the others — 5 means "fresh", not "agony" — so that a
 * higher number always means a better day.
 */
export interface ReadinessAnswers {
  sleep: number
  soreness: number
  energy: number
}

export interface ReadinessCheck extends ReadinessAnswers {
  id: string
  userId: string | null
  /** `YYYY-MM-DD`, local. One check per day; a second one replaces the first. */
  date: string
  createdAt: string
}

export interface NewReadinessCheck extends ReadinessAnswers {
  date: string
}

export interface Streak {
  /** Consecutive weeks containing at least one session. */
  currentStreak: number
  longestStreak: number
  /** ISO date (YYYY-MM-DD) of the most recent session, or null. */
  lastActiveDate: string | null
  /** Sessions logged in the current week. */
  weeklySessionsCount: number
}
