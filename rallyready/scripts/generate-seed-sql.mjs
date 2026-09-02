/**
 * Regenerates the drill seed block inside supabase/schema.sql from the
 * bundled TypeScript catalogue.
 *
 *   node --experimental-strip-types scripts/generate-seed-sql.mjs
 *   (or: npm run seed:sql)
 *
 * The client ships the catalogue so a fresh install works offline, and Postgres
 * needs the same rows. Maintaining both by hand drifts — it already did once —
 * so the TypeScript file is the source of truth and the SQL is derived from it.
 *
 * Node strips the types itself; the catalogue is plain data with a single
 * type-only import, so there is nothing to transpile.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SCHEMA = join(ROOT, 'supabase', 'schema.sql')
const START = '-- >>> generated from src/lib/data/seed/drills.ts — do not edit by hand'
const END = '-- <<< end generated drill seed'

const { SEED_DRILLS } = await import('../src/lib/data/seed/drills.ts')

const quote = (value) => `'${String(value).replace(/'/g, "''")}'`
const textArray = (values) =>
  values.length === 0 ? `'{}'` : `array[\n      ${values.map(quote).join(',\n      ')}\n    ]`
const jsonOrNull = (value) => (value === null ? 'null' : `${quote(JSON.stringify(value))}::jsonb`)

const COLUMNS = [
  'slug',
  'name',
  'category',
  'mode',
  'description',
  'coaching_cues',
  'common_faults',
  'default_work_sec',
  'default_rest_sec',
  'default_rounds',
  'corners',
  'default_interval_ms',
  'default_call_mode',
  'enabled_corners',
  'default_warmup_sec',
  'default_cooldown_sec',
  'level',
  'discipline',
  'pattern_ids',
  'is_public',
  'circuit',
  'circuit_rounds',
  'location',
  'equipment',
]

function row(drill) {
  return `(
  ${quote(drill.slug)}, ${quote(drill.name)}, ${quote(drill.category)}, ${quote(drill.style)},
  ${quote(drill.description)},
  ${textArray(drill.coachingCues)},
  ${textArray(drill.commonFaults)},
  ${drill.defaultWorkSec}, ${drill.defaultRestSec}, ${drill.defaultRounds}, ${drill.corners},
  ${drill.defaultIntervalMs}, ${quote(drill.defaultCallMode)},
  ${drill.enabledCorners === null ? 'null' : textArray(drill.enabledCorners)},
  ${drill.defaultWarmupSec}, ${drill.defaultCooldownSec}, ${quote(drill.level)},
  ${quote(drill.discipline)}, ${textArray(drill.patternIds)}, ${drill.isPublic},
  ${jsonOrNull(drill.circuit)}, ${drill.circuitRounds}, ${quote(drill.location)},
  ${textArray(drill.equipment)}
)`
}

const updates = COLUMNS.filter((column) => column !== 'slug')
  .map((column) => `  ${column.padEnd(20)} = excluded.${column}`)
  .join(',\n')

const sql = `${START}
insert into public.drills (
  ${COLUMNS.join(', ')}
) values
${SEED_DRILLS.map(row).join(',\n')}
on conflict (slug) do update set
${updates};
${END}`

/* ------------------------------------------------------------- programs */

const { SEED_PROGRAMS, daysForProgram } = await import('../src/lib/data/seed/programs.ts')

const PROGRAM_START = '-- >>> generated program seed from src/lib/data/seed/programs.ts — do not edit'
const PROGRAM_END = '-- <<< end generated program seed'

const programRows = SEED_PROGRAMS.map(
  (program) => `(
  ${quote(program.slug)}, ${quote(program.name)},
  ${quote(program.description)},
  ${program.totalWeeks}, ${quote(program.level)}, ${quote(program.location)},
  ${program.sessionsPerWeek}, ${program.isPublic}
)`,
).join(',\n')

/**
 * Days are looked up through the program's slug rather than carrying a uuid,
 * so the seed stays valid however many times it is re-run.
 */
const dayRows = SEED_PROGRAMS.flatMap((program) =>
  daysForProgram(program).map(
    (day) => `(
  (select id from public.programs where slug = ${quote(program.slug)}),
  ${day.weekNo}, ${day.dayNo}, ${quote(day.title)}, ${quote(day.focus)},
  ${textArray(day.drillSlugs)}, ${day.notes === null ? 'null' : quote(day.notes)}
)`,
  ),
).join(',\n')

const programSql = `${PROGRAM_START}
insert into public.programs (
  slug, name, description, total_weeks, level, location, sessions_per_week, is_public
) values
${programRows}
on conflict (slug) do update set
  name              = excluded.name,
  description       = excluded.description,
  total_weeks       = excluded.total_weeks,
  level             = excluded.level,
  location          = excluded.location,
  sessions_per_week = excluded.sessions_per_week,
  is_public         = excluded.is_public;

insert into public.program_days (
  program_id, week_no, day_no, title, focus, drill_slugs, notes
) values
${dayRows}
on conflict (program_id, week_no, day_no) do update set
  title       = excluded.title,
  focus       = excluded.focus,
  drill_slugs = excluded.drill_slugs,
  notes       = excluded.notes;
${PROGRAM_END}`

/* --------------------------------------------------------------- splice */

function splice(source, start, end, replacement) {
  const startAt = source.indexOf(start)
  const endAt = source.indexOf(end)
  if (startAt === -1 || endAt === -1) {
    throw new Error(`Could not find the marker "${start}" in ${SCHEMA}`)
  }
  return source.slice(0, startAt) + replacement + source.slice(endAt + end.length)
}

let schema = readFileSync(SCHEMA, 'utf8')
schema = splice(schema, START, END, sql)
schema = splice(schema, PROGRAM_START, PROGRAM_END, programSql)
writeFileSync(SCHEMA, schema)

const dayCount = SEED_PROGRAMS.reduce((total, p) => total + daysForProgram(p).length, 0)
console.log(
  `wrote ${SEED_DRILLS.length} drills, ${SEED_PROGRAMS.length} programs ` +
    `and ${dayCount} program days into supabase/schema.sql`,
)
