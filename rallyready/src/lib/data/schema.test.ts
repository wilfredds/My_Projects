import { describe, expect, it } from 'vitest'

// Read through Vite rather than `node:fs`: the app's tsconfig has no Node
// types, and `?raw` works the same in vitest and in a build.
import schema from '../../../supabase/schema.sql?raw'

import { SEED_DRILLS } from './seed/drills'

/**
 * The Postgres schema has to know about everything the app puts in it.
 *
 * This exists because it did not. `supabase/schema.sql` had two
 * `alter type ... add value` statements moved into the middle of its enum
 * block, which split the block, orphaned an `end if;` and left the whole file
 * failing to parse on its very first statement. Nothing had applied to any
 * database since — so nobody noticed that `drill_category` had also lost track
 * of `strength`, a category added two phases later.
 *
 * A broken schema hides its own drift. This reads the file the way Postgres
 * would and checks the values the app actually uses are declared, so the next
 * category cannot go missing quietly.
 */

/** The file as Postgres reads it: comments are not part of the statement. */
const sql = schema.replace(/--[^\n]*/g, '')

/** The body of every `do $$ ... $$` block, found by scanning rather than by a
 *  greedy regex — the file also contains a function body quoted the same way. */
function doBlocks(): string[] {
  const bodies: string[] = []
  const opener = /\bdo\s+\$\$/gi
  let match: RegExpExecArray | null
  while ((match = opener.exec(sql)) !== null) {
    const from = match.index + match[0].length
    const to = sql.indexOf('$$', from)
    if (to === -1) break
    bodies.push(sql.slice(from, to))
    opener.lastIndex = to + 2
  }
  return bodies
}

/** The values of `create type <name> as enum (...)`, however it is wrapped. */
function enumValues(name: string): string[] {
  const match = new RegExp(`create type ${name} as enum\\s*\\(([^)]*)\\)`, 'i').exec(schema)
  if (!match?.[1]) return []
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1] as string)
}

/** Values appended later for databases that predate them. */
function addedValues(name: string): string[] {
  return [
    ...schema.matchAll(new RegExp(`alter type ${name} add value if not exists '([^']+)'`, 'gi')),
  ].map((m) => m[1] as string)
}

const declared = (name: string) => new Set([...enumValues(name), ...addedValues(name)])

describe('supabase/schema.sql', () => {
  it('closes every branch it opens, in every block', () => {
    /*
     * The bug that started this. Two statements were pasted into the middle of
     * the enum block, splitting it: one half closed early, and the other was
     * left starting with a dangling `end if;`. Postgres rejected the file at
     * its first statement, so no table was ever created.
     */
    expect((schema.match(/\$\$/g) ?? []).length % 2, 'unbalanced $$ quoting').toBe(0)
    const blocks = doBlocks()
    expect(blocks.length, 'no do blocks found — has the file moved?').toBeGreaterThan(0)
    blocks.forEach((block, index) => {
      const thens = (block.match(/\bthen\b/g) ?? []).length
      const ends = (block.match(/\bend if\b/g) ?? []).length
      expect(ends, `block ${index + 1}: ${thens} branches opened, ${ends} closed`).toBe(thens)
    })
  })

  it('keeps `alter type ... add value` out of a transaction block', () => {
    /*
     * Postgres refuses to add an enum value inside a transaction, and a
     * `do $$ ... $$` block is one. These have to be top-level statements.
     */
    for (const [index, block] of doBlocks().entries()) {
      expect(block, `block ${index + 1} adds an enum value inside a transaction`).not.toMatch(
        /alter type .* add value/i,
      )
    }
  })

  it('declares every drill category the app uses', () => {
    const known = declared('drill_category')
    for (const drill of SEED_DRILLS) {
      expect(known.has(drill.category), `drill_category is missing '${drill.category}'`).toBe(true)
    }
  })

  it('declares every call mode, style, level and location the app uses', () => {
    const checks: [string, string[]][] = [
      ['call_mode', SEED_DRILLS.map((d) => d.defaultCallMode)],
      ['drill_style', SEED_DRILLS.map((d) => d.style)],
      ['skill_level', SEED_DRILLS.map((d) => d.level)],
      ['drill_location', SEED_DRILLS.map((d) => d.location)],
    ]
    for (const [name, used] of checks) {
      const known = declared(name)
      expect(known.size, `${name} not found in the schema`).toBeGreaterThan(0)
      for (const value of new Set(used)) {
        expect(known.has(value), `${name} is missing '${value}'`).toBe(true)
      }
    }
  })
})
