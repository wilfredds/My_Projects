import { TECHNIQUE_TOPICS } from '@/lib/data/seed/technique'
import type { DrillCategory, SkillLevel } from '@/lib/data/types'

import type { LibraryEntry } from './entries'

/**
 * "What do you want to get better at?" — the way into the app for someone who
 * does not already know what to look for.
 *
 * The catalogue was a flat list of everything, which works if you already know
 * that a six-corner shadow drill is the thing that fixes your movement. A
 * coach reviewing this put it plainly: a player wants to improve their agility,
 * they tap Agility, and they are shown the drills that do that. Everything
 * below is that idea — a small set of goals a player would recognise, each
 * mapped onto the categories the catalogue already carries.
 *
 * Pure, so the mapping is testable and cannot silently come to point at a
 * category nothing is filed under.
 */

export type FocusId =
  | 'fundamentals'
  | 'footwork'
  | 'agility'
  | 'stamina'
  | 'strength'
  | 'power'
  | 'net'
  | 'rear-court'
  | 'prepare'

export interface FocusArea {
  id: FocusId
  title: string
  /** The player's own words for wanting it — what the card actually says. */
  goal: string
  blurb: string
  categories: DrillCategory[]
  /**
   * Fundamentals is not a category but a hand-picked set: the topics a complete
   * beginner should meet before being handed a drill catalogue at all.
   */
  fundamentalsOnly?: boolean
}

export const FOCUS_AREAS: FocusArea[] = [
  {
    id: 'fundamentals',
    title: 'The basics',
    goal: 'I am new to badminton',
    blurb:
      'How to hold the racket, how to stand, and the four shots everything else is built on. Start here.',
    categories: [],
    fundamentalsOnly: true,
  },
  {
    id: 'footwork',
    title: 'Footwork',
    goal: 'I want to move better',
    blurb:
      'Getting to the shuttle early and getting back. The thing that limits most club players.',
    categories: ['footwork'],
  },
  {
    id: 'agility',
    title: 'Agility',
    goal: 'I want to be quicker',
    blurb: 'Foot speed, direction changes and reacting off the split step.',
    categories: ['agility'],
  },
  {
    id: 'stamina',
    title: 'Stamina',
    goal: 'I want to last three games',
    blurb: 'Interval work on real rally rhythms, so the third game feels like the first.',
    categories: ['conditioning'],
  },
  {
    id: 'strength',
    title: 'Strength',
    goal: 'I want a body that holds up',
    blurb:
      'Push-ups, planks, lunges and calf work. The half of a real session that happens off the court, and the reason the good players can still lunge in the third game.',
    categories: ['strength'],
  },
  {
    id: 'power',
    title: 'Power',
    goal: 'I want a harder smash',
    blurb: 'Jump, land and push. Power comes from the legs and the rotation, not the arm.',
    categories: ['plyometric'],
  },
  {
    id: 'net',
    title: 'Net play',
    goal: 'I want a better net game',
    blurb: 'The lunge, the touch, and the grip changes that make a backhand net shot possible.',
    categories: ['net'],
  },
  {
    id: 'rear-court',
    title: 'Rear court',
    goal: 'I want a stronger overhead',
    blurb: 'Clears, drops and smashes, and the scissor recovery that gets you back afterwards.',
    categories: ['rear-court'],
  },
  {
    id: 'prepare',
    title: 'Warm up & recover',
    goal: 'I want to stay uninjured',
    blurb: 'Six minutes before, five minutes after. The only advice here that prevents an injury.',
    categories: ['warmup', 'cooldown'],
  },
]

export function findFocus(id: string): FocusArea | undefined {
  return FOCUS_AREAS.find((area) => area.id === id)
}

/**
 * The beginner path, in teaching order: how to hold it, how to stand, how to
 * move, then the shots. Declared explicitly rather than taken from the order of
 * the catalogue, because the order is the pedagogy — you cannot usefully learn
 * a smash before you can hold the racket, and a list sorted by title puts
 * "Base, and recovering through it" first.
 */
export const FUNDAMENTAL_ORDER: string[] = [
  'how-to-hold-the-racket',
  'the-backhand-grip',
  'the-ready-stance',
  'the-split-step',
  'base-and-recovery',
  'the-overhead-clear',
  'the-smash',
  'the-low-serve',
  'the-net-lunge',
]

/** Slugs of the topics that make up the beginner path, in reading order. */
export function fundamentalSlugs(): string[] {
  const flagged = new Set(
    TECHNIQUE_TOPICS.filter((topic) => topic.fundamental).map((topic) => topic.slug),
  )
  // The declared order leads; anything flagged but not listed still appears,
  // at the end, so adding a fundamental cannot silently drop it from the path.
  const ordered = FUNDAMENTAL_ORDER.filter((slug) => flagged.has(slug))
  const extra = [...flagged].filter((slug) => !FUNDAMENTAL_ORDER.includes(slug))
  return [...ordered, ...extra]
}

/**
 * Levels are cumulative going up: an advanced player is still allowed to see a
 * beginner drill, because a beginner drill done well is not a beginner's drill.
 * The reverse is not true by default — a beginner shown the whole catalogue is
 * back where they started — but it is a default, not a lock. `showHarder`
 * opens it up, because hiding things permanently is its own kind of insult.
 */
export function withinLevel(
  entryLevel: SkillLevel,
  playerLevel: SkillLevel,
  showHarder = false,
): boolean {
  if (showHarder) return true
  const order: SkillLevel[] = ['beginner', 'intermediate', 'advanced']
  return order.indexOf(entryLevel) <= order.indexOf(playerLevel)
}

export interface FocusFilter {
  level: SkillLevel
  showHarder?: boolean
}

/** Everything filed under a focus area, at or below the player's level. */
export function entriesForFocus(
  entries: LibraryEntry[],
  focus: FocusArea,
  filter: FocusFilter,
): LibraryEntry[] {
  const fundamentals = focus.fundamentalsOnly ? new Set(fundamentalSlugs()) : null

  return entries.filter((entry) => {
    if (fundamentals) {
      // The beginner path ignores the level filter entirely: these are the
      // topics you read *before* you have a level.
      return entry.kind === 'technique' && fundamentals.has(entry.slug)
    }
    if (!focus.categories.includes(entry.category)) return false
    return withinLevel(entry.level, filter.level, filter.showHarder)
  })
}

/**
 * How many entries a focus holds at a given level — what the card on the grid
 * promises. A focus that would open onto an empty list is worth knowing about
 * before the player taps it.
 */
export function countForFocus(
  entries: LibraryEntry[],
  focus: FocusArea,
  filter: FocusFilter,
): number {
  return entriesForFocus(entries, focus, filter).length
}

/**
 * Drills first, then the reading — you came here to train. The beginner path is
 * the exception: it is a syllabus, and its order is the whole point.
 */
export function sortForFocus(entries: LibraryEntry[], focus?: FocusArea): LibraryEntry[] {
  if (focus?.fundamentalsOnly) {
    const order = fundamentalSlugs()
    return [...entries].sort((a, b) => order.indexOf(a.slug) - order.indexOf(b.slug))
  }
  const rank = (entry: LibraryEntry) =>
    entry.kind === 'drill' ? 0 : entry.kind === 'exercise' ? 1 : 2
  const level: Record<SkillLevel, number> = { beginner: 0, intermediate: 1, advanced: 2 }
  return [...entries].sort(
    (a, b) =>
      rank(a) - rank(b) || level[a.level] - level[b.level] || a.title.localeCompare(b.title),
  )
}
