import { periodise } from '@/lib/programs/periodise'

import type { ProgramRepository } from '../ports'
import { daysForProgram, SEED_PROGRAMS } from '../seed/programs'
import { localDateKey } from '../streaks'
import type { EnrollmentStatus, NewProgram, Program, ProgramDay, ProgramEnrollment } from '../types'
import { newId, readJson, STORAGE_KEYS, writeJson } from './storage'

/**
 * Programs on the local backend.
 *
 * Seeded programs generate their days on demand from their own specification —
 * storing 84 rows for a plan that is entirely derivable would be waste. Days
 * are only persisted once a user *edits* one, and then only the overrides.
 */

const loadOwn = () => readJson<Program[]>(STORAGE_KEYS.programs, [])
const loadDayOverrides = () => readJson<Record<string, ProgramDay[]>>(STORAGE_KEYS.programDays, {})
const loadEnrollments = () => readJson<ProgramEnrollment[]>(STORAGE_KEYS.enrollments, [])

function allPrograms(): Program[] {
  return [...loadOwn(), ...SEED_PROGRAMS]
}

function generateDays(program: Program): ProgramDay[] {
  return daysForProgram(program)
}

export const localPrograms: ProgramRepository = {
  async list() {
    return allPrograms()
  },

  async getBySlug(slug) {
    return allPrograms().find((program) => program.slug === slug) ?? null
  },

  async listDays(programId) {
    const program = allPrograms().find((candidate) => candidate.id === programId)
    if (!program) return []

    const generated = generateDays(program)
    const overrides = loadDayOverrides()[programId]
    if (!overrides || overrides.length === 0) return generated

    // Overrides are sparse: only days the author actually changed.
    const byKey = new Map(overrides.map((day) => [`${day.weekNo}-${day.dayNo}`, day]))
    return generated.map((day) => byKey.get(`${day.weekNo}-${day.dayNo}`) ?? day)
  },

  async create(input: NewProgram) {
    const id = newId()
    const program: Program = {
      id,
      // Slugs must be unique and readable; collisions are broken by the id tail.
      slug: `${slugify(input.name)}-${id.slice(0, 6)}`,
      name: input.name,
      description: input.description,
      totalWeeks: input.totalWeeks,
      level: input.level,
      location: input.location,
      sessionsPerWeek: input.sessionsPerWeek,
      isPublic: input.isPublic,
      createdBy: 'local',
      createdAt: new Date().toISOString(),
    }
    writeJson(STORAGE_KEYS.programs, [program, ...loadOwn()])
    return program
  },

  async update(programId, patch) {
    const own = loadOwn()
    const index = own.findIndex((program) => program.id === programId)
    if (index === -1) throw new Error('That program cannot be edited')
    const updated: Program = { ...(own[index] as Program), ...patch }
    own[index] = updated

    // Changing the shape invalidates any edits to days that no longer exist.
    const before = own[index] as Program
    if (patch.totalWeeks !== undefined || patch.sessionsPerWeek !== undefined) {
      const overrides = loadDayOverrides()
      const kept = (overrides[programId] ?? []).filter((day) => day.weekNo <= before.totalWeeks)
      writeJson(STORAGE_KEYS.programDays, { ...overrides, [programId]: kept })
    }

    writeJson(STORAGE_KEYS.programs, own)
    return updated
  },

  async saveDay(day) {
    const overrides = loadDayOverrides()
    const existing = (overrides[day.programId] ?? []).filter(
      (candidate) => !(candidate.weekNo === day.weekNo && candidate.dayNo === day.dayNo),
    )
    writeJson(STORAGE_KEYS.programDays, {
      ...overrides,
      [day.programId]: [...existing, day],
    })
  },

  async remove(programId) {
    writeJson(
      STORAGE_KEYS.programs,
      loadOwn().filter((program) => program.id !== programId),
    )
    const { [programId]: _dropped, ...rest } = loadDayOverrides()
    writeJson(STORAGE_KEYS.programDays, rest)
    writeJson(
      STORAGE_KEYS.enrollments,
      loadEnrollments().filter((enrollment) => enrollment.programId !== programId),
    )
  },

  async activeEnrollment() {
    return loadEnrollments().find((enrollment) => enrollment.status === 'active') ?? null
  },

  async listEnrollments() {
    return loadEnrollments()
  },

  async enroll(programId) {
    // One program at a time: two active plans is two plans nobody follows.
    const existing = loadEnrollments().map((enrollment) =>
      enrollment.status === 'active' ? { ...enrollment, status: 'paused' as const } : enrollment,
    )
    const enrollment: ProgramEnrollment = {
      id: newId(),
      userId: null,
      programId,
      // The player's day, not UTC's: in Manila UTC is a day behind until 8am.
      startedOn: localDateKey(new Date()),
      currentWeek: 1,
      currentDay: 1,
      status: 'active',
    }
    writeJson(STORAGE_KEYS.enrollments, [
      enrollment,
      ...existing.filter((candidate) => candidate.programId !== programId),
    ])
    return enrollment
  },

  async setPosition(enrollmentId, weekNo, dayNo) {
    return patchEnrollment(enrollmentId, { currentWeek: weekNo, currentDay: dayNo })
  },

  async setStatus(enrollmentId, status: EnrollmentStatus) {
    return patchEnrollment(enrollmentId, { status })
  },
}

function patchEnrollment(
  enrollmentId: string,
  patch: Partial<ProgramEnrollment>,
): ProgramEnrollment {
  const all = loadEnrollments()
  const index = all.findIndex((enrollment) => enrollment.id === enrollmentId)
  if (index === -1) throw new Error('Enrolment not found')
  const updated = { ...(all[index] as ProgramEnrollment), ...patch }
  all[index] = updated
  writeJson(STORAGE_KEYS.enrollments, all)
  return updated
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

/** Exposed so the creator can preview a plan before it is saved. */
export function previewDays(input: NewProgram): ReturnType<typeof periodise> {
  return periodise({
    totalWeeks: input.totalWeeks,
    sessionsPerWeek: input.sessionsPerWeek,
    level: input.level,
    location: input.location,
  })
}
