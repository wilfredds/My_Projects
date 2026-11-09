import type { RallyReadyClient } from '@/lib/supabase/client'
import { periodise } from '@/lib/programs/periodise'

import type { ProgramRepository } from '../ports'
import { localDateKey } from '../streaks'
import type { EnrollmentStatus, NewProgram, Program, ProgramDay, ProgramEnrollment } from '../types'
import type { ProgramDayRow, ProgramEnrollmentRow, ProgramRow } from './database.types'

/**
 * Programs on the signed-in backend.
 *
 * Unlike the local adapter, days are written out as rows: a published program
 * has to look identical to every reader, so it cannot be regenerated from a
 * spec that the author might later edit.
 */

function toProgram(row: ProgramRow): Program {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    totalWeeks: row.total_weeks,
    level: row.level,
    location: row.location,
    sessionsPerWeek: row.sessions_per_week,
    isPublic: row.is_public,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }
}

function toDay(row: ProgramDayRow): ProgramDay {
  return {
    id: row.id,
    programId: row.program_id,
    weekNo: row.week_no,
    dayNo: row.day_no,
    title: row.title,
    focus: row.focus,
    drillSlugs: row.drill_slugs ?? [],
    notes: row.notes,
  }
}

function toEnrollment(row: ProgramEnrollmentRow): ProgramEnrollment {
  return {
    id: row.id,
    userId: row.user_id,
    programId: row.program_id,
    startedOn: row.started_on,
    currentWeek: row.current_week,
    currentDay: row.current_day,
    status: row.status,
  }
}

function fail(context: string, error: { message: string } | null): void {
  if (error) throw new Error(`${context}: ${error.message}`)
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'program'
  )
}

export function createSupabasePrograms(
  client: RallyReadyClient,
  userId: string,
): ProgramRepository {
  /** Writes a freshly-periodised plan for a program, replacing any existing one. */
  async function writeGeneratedDays(program: Program): Promise<void> {
    const { error: clearError } = await client
      .from('program_days')
      .delete()
      .eq('program_id', program.id)
    fail('Could not replace the program plan', clearError)

    const days = periodise({
      totalWeeks: program.totalWeeks,
      sessionsPerWeek: program.sessionsPerWeek,
      level: program.level,
      location: program.location,
    })

    const { error } = await client.from('program_days').insert(
      days.map((day) => ({
        program_id: program.id,
        week_no: day.weekNo,
        day_no: day.dayNo,
        title: day.title,
        focus: day.focus,
        drill_slugs: day.drillSlugs,
        notes: day.notes,
      })),
    )
    fail('Could not save the program plan', error)
  }

  return {
    async list() {
      // RLS limits this to public programs plus the user's own.
      const { data, error } = await client.from('programs').select('*').order('total_weeks')
      fail('Could not load programs', error)
      return (data ?? []).map(toProgram)
    },

    async getBySlug(slug) {
      const { data, error } = await client
        .from('programs')
        .select('*')
        .eq('slug', slug)
        .maybeSingle()
      fail('Could not load program', error)
      return data ? toProgram(data) : null
    },

    async listDays(programId) {
      const { data, error } = await client
        .from('program_days')
        .select('*')
        .eq('program_id', programId)
        .order('week_no')
        .order('day_no')
      fail('Could not load the program plan', error)
      return (data ?? []).map(toDay)
    },

    async create(input: NewProgram) {
      const { data, error } = await client
        .from('programs')
        .insert({
          slug: `${slugify(input.name)}-${Math.random().toString(36).slice(2, 8)}`,
          name: input.name,
          description: input.description,
          total_weeks: input.totalWeeks,
          level: input.level,
          location: input.location,
          sessions_per_week: input.sessionsPerWeek,
          is_public: input.isPublic,
          created_by: userId,
        })
        .select('*')
        .single()
      fail('Could not create program', error)
      if (!data) throw new Error('Could not create program: no row returned')

      const program = toProgram(data)
      await writeGeneratedDays(program)
      return program
    },

    async update(programId, patch) {
      const { data, error } = await client
        .from('programs')
        .update({
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.description !== undefined ? { description: patch.description } : {}),
          ...(patch.totalWeeks !== undefined ? { total_weeks: patch.totalWeeks } : {}),
          ...(patch.level !== undefined ? { level: patch.level } : {}),
          ...(patch.location !== undefined ? { location: patch.location } : {}),
          ...(patch.sessionsPerWeek !== undefined
            ? { sessions_per_week: patch.sessionsPerWeek }
            : {}),
          ...(patch.isPublic !== undefined ? { is_public: patch.isPublic } : {}),
        })
        .eq('id', programId)
        .select('*')
        .single()
      fail('Could not update program', error)
      if (!data) throw new Error('Could not update program: no row returned')

      const program = toProgram(data)
      // Changing the shape invalidates the plan, so regenerate it.
      const reshaped =
        patch.totalWeeks !== undefined ||
        patch.sessionsPerWeek !== undefined ||
        patch.level !== undefined ||
        patch.location !== undefined
      if (reshaped) await writeGeneratedDays(program)
      return program
    },

    async saveDay(day) {
      const { error } = await client.from('program_days').upsert(
        {
          program_id: day.programId,
          week_no: day.weekNo,
          day_no: day.dayNo,
          title: day.title,
          focus: day.focus,
          drill_slugs: day.drillSlugs,
          notes: day.notes,
        },
        { onConflict: 'program_id,week_no,day_no' },
      )
      fail('Could not save the day', error)
    },

    async remove(programId) {
      const { error } = await client.from('programs').delete().eq('id', programId)
      fail('Could not delete program', error)
    },

    async activeEnrollment() {
      const { data, error } = await client
        .from('program_enrollments')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle()
      fail('Could not load enrolment', error)
      return data ? toEnrollment(data) : null
    },

    async listEnrollments() {
      const { data, error } = await client
        .from('program_enrollments')
        .select('*')
        .eq('user_id', userId)
      fail('Could not load enrolments', error)
      return (data ?? []).map(toEnrollment)
    },

    async enroll(programId) {
      // One program at a time: two active plans is two plans nobody follows.
      const { error: pauseError } = await client
        .from('program_enrollments')
        .update({ status: 'paused' })
        .eq('user_id', userId)
        .eq('status', 'active')
      fail('Could not pause the previous program', pauseError)

      const { data, error } = await client
        .from('program_enrollments')
        .upsert(
          {
            user_id: userId,
            program_id: programId,
            // The player's day, not UTC's: in Manila UTC is a day behind until 8am.
            started_on: localDateKey(new Date()),
            current_week: 1,
            current_day: 1,
            status: 'active' as const,
          },
          { onConflict: 'user_id,program_id' },
        )
        .select('*')
        .single()
      fail('Could not enrol', error)
      if (!data) throw new Error('Could not enrol: no row returned')
      return toEnrollment(data)
    },

    async setPosition(enrollmentId, weekNo, dayNo) {
      const { data, error } = await client
        .from('program_enrollments')
        .update({ current_week: weekNo, current_day: dayNo })
        .eq('id', enrollmentId)
        .select('*')
        .single()
      fail('Could not update progress', error)
      if (!data) throw new Error('Could not update progress: no row returned')
      return toEnrollment(data)
    },

    async setStatus(enrollmentId, status: EnrollmentStatus) {
      const { data, error } = await client
        .from('program_enrollments')
        .update({ status })
        .eq('id', enrollmentId)
        .select('*')
        .single()
      fail('Could not update the program status', error)
      if (!data) throw new Error('Could not update the program status: no row returned')
      return toEnrollment(data)
    },
  }
}
