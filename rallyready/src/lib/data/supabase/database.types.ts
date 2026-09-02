import type { CornerId } from '@/lib/timer/corners'
import type { DrillMode } from '@/lib/timer/types'
import type {
  CircuitStep,
  EnrollmentStatus,
  ProgramFocus,
  DrillCategory,
  DrillLocation,
  DrillStyle,
  SessionSource,
  SkillLevel,
  Discipline,
  TrainingGoal,
} from '../types'

/**
 * Hand-maintained mirror of the Phase-1 tables in `supabase/schema.sql`.
 *
 * Typing the client this way means a column rename breaks the build instead of
 * silently returning undefined at runtime. Regenerate with the Supabase CLI
 * (`supabase gen types typescript`) if you prefer; the shape is the same.
 */

export interface ProfileRow {
  id: string
  display_name: string
  avatar_url: string | null
  skill_level: SkillLevel
  primary_discipline: Discipline
  goal: TrainingGoal
  court_access: DrillLocation
  created_at: string
}

export interface DrillRow {
  id: string
  slug: string
  name: string
  category: DrillCategory
  mode: DrillStyle
  description: string
  coaching_cues: string[]
  common_faults: string[]
  default_work_sec: number
  default_rest_sec: number
  default_rounds: number
  corners: number
  video_url: string | null
  is_public: boolean
  created_by: string | null
  default_interval_ms: number
  default_call_mode: DrillMode
  discipline: Discipline | null
  pattern_ids: string[] | null
  enabled_corners: CornerId[] | null
  default_warmup_sec: number
  default_cooldown_sec: number
  level: SkillLevel
  circuit: CircuitStep[] | null
  circuit_rounds: number
  location: DrillLocation
  equipment: string[]
  created_at: string
}

export interface SessionRow {
  id: string
  user_id: string
  drill_id: string | null
  drill_name: string | null
  started_at: string
  duration_sec: number
  rounds_completed: number
  avg_shot_interval_ms: number | null
  notes: string | null
  source: SessionSource
  created_at: string
}

export interface SessionMetricRow {
  id: string
  session_id: string
  metric_key: string
  metric_value: number
}

export interface ReadinessCheckRow {
  id: string
  user_id: string
  /** `YYYY-MM-DD`; unique per user, so a second answer upserts the first. */
  date: string
  created_at: string
  sleep: number
  soreness: number
  energy: number
}

export interface ProgramRow {
  id: string
  slug: string
  name: string
  description: string
  total_weeks: number
  level: SkillLevel
  location: DrillLocation
  sessions_per_week: number
  is_public: boolean
  created_by: string | null
  created_at: string
}

export interface ProgramDayRow {
  id: string
  program_id: string
  week_no: number
  day_no: number
  title: string
  focus: ProgramFocus
  drill_slugs: string[]
  notes: string | null
}

export interface ProgramEnrollmentRow {
  id: string
  user_id: string
  program_id: string
  started_on: string
  current_week: number
  current_day: number
  status: EnrollmentStatus
  created_at: string
}

export interface BenchmarkRow {
  id: string
  user_id: string
  test_type: 'b_endurance_style' | 'spider_sprint'
  taken_at: string
  score: number
  level_reached: number | null
  raw: Record<string, unknown>
}

export interface BadgeRow {
  id: string
  slug: string
  name: string
  description: string
  icon: string
  tier: string
  created_at: string
}

export interface UserBadgeRow {
  id: string
  user_id: string
  badge_id: string
  awarded_at: string
}

export interface StreakRow {
  id: string
  user_id: string
  current_streak: number
  longest_streak: number
  last_active_date: string | null
  weekly_sessions_count: number
  updated_at: string
}

/**
 * Collapses an intersection into a plain object type. postgrest-js requires
 * every table shape to be assignable to `Record<string, unknown>`, and an
 * intersection (`Omit<…> & { … }`) does not get an implicit index signature —
 * flattening it does.
 */
type Flatten<T> = { [K in keyof T]: T[K] }

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Flatten<Row>
  Insert: Flatten<Insert>
  Update: Flatten<Update>
  Relationships: []
}

export interface Database {
  public: {
    Tables: {
      profiles: Table<ProfileRow, Omit<ProfileRow, 'created_at'> & { created_at?: string }>
      drills: Table<DrillRow>
      sessions: Table<
        SessionRow,
        Omit<SessionRow, 'id' | 'created_at'> & { id?: string; created_at?: string }
      >
      session_metrics: Table<SessionMetricRow, Omit<SessionMetricRow, 'id'> & { id?: string }>
      readiness_checks: Table<
        ReadinessCheckRow,
        Omit<ReadinessCheckRow, 'id' | 'created_at'> & { id?: string; created_at?: string }
      >
      programs: Table<
        ProgramRow,
        Omit<ProgramRow, 'id' | 'created_at'> & { id?: string; created_at?: string }
      >
      program_days: Table<ProgramDayRow, Omit<ProgramDayRow, 'id'> & { id?: string }>
      program_enrollments: Table<
        ProgramEnrollmentRow,
        Omit<ProgramEnrollmentRow, 'id' | 'created_at'> & { id?: string; created_at?: string }
      >
      benchmarks: Table<BenchmarkRow, Omit<BenchmarkRow, 'id'> & { id?: string }>
      badges: Table<BadgeRow>
      user_badges: Table<
        UserBadgeRow,
        Omit<UserBadgeRow, 'id' | 'awarded_at'> & { id?: string; awarded_at?: string }
      >
      streaks: Table<
        StreakRow,
        Omit<StreakRow, 'id' | 'updated_at'> & { id?: string; updated_at?: string }
      >
    }
    Views: Record<never, never>
    Functions: Record<never, never>
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
}
