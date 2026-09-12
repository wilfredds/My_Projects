import { describe, expect, it } from 'vitest'

import { SEED_DRILLS } from './drills'
import { EXERCISES } from './exercises'
import { SEED_PROGRAMS } from './programs'

/**
 * How long a sentence a player has to read.
 *
 * A QA engineer testing this app put it plainly: the instructions were
 * info-heavy and technical, and there was a gap between what the app assumed
 * the reader knew and what they actually understood. The measurable half of
 * that is sentence length — the copy averaged ten words a sentence, which is
 * fine, but the tail ran to thirty-eight, with three ideas chained behind
 * em-dashes. One idea at a time is the rule; this is the part of it a test can
 * hold.
 *
 * Twenty words is the cap, not the target. Nothing here is near it: the
 * average is under ten.
 */
const MAX_WORDS = 20

const sentences = (text: string | null | undefined): string[] =>
  (text ?? '')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)

const words = (sentence: string) => sentence.split(/\s+/).length

/** Every string the app shows a player, with where it came from. */
function copy(): { where: string; text: string }[] {
  const out: { where: string; text: string }[] = []
  const add = (where: string, text: string | null | undefined) => {
    if (text) out.push({ where, text })
  }
  for (const drill of SEED_DRILLS) add(`drill ${drill.slug}`, drill.description)
  for (const program of SEED_PROGRAMS) add(`program ${program.slug}`, program.description)
  for (const exercise of EXERCISES) {
    add(`${exercise.slug} summary`, exercise.summary)
    exercise.cues?.forEach((cue, i) => add(`${exercise.slug} cue ${i + 1}`, cue))
    exercise.faults?.forEach((fault, i) => add(`${exercise.slug} fault ${i + 1}`, fault))
    add(`${exercise.slug} substitute`, exercise.substitute)
    add(`${exercise.slug} reps`, exercise.recommendedReps)
  }
  return out
}

describe('the words a player has to read', () => {
  it('says one thing per sentence', () => {
    const tooLong = copy()
      .flatMap(({ where, text }) => sentences(text).map((sentence) => ({ where, sentence })))
      .filter(({ sentence }) => words(sentence) > MAX_WORDS)
      .map(({ where, sentence }) => `${where}: ${words(sentence)}w — ${sentence}`)
    expect(tooLong, tooLong.join('\n')).toEqual([])
  })

  it('stays well under the cap on average', () => {
    // A cap alone can be met by writing exactly twenty-word sentences. This is
    // the check that the copy is actually short rather than merely legal.
    const all = copy().flatMap(({ text }) => sentences(text))
    const average = all.reduce((total, sentence) => total + words(sentence), 0) / all.length
    expect(all.length).toBeGreaterThan(300)
    expect(average).toBeLessThan(13)
  })

  it('leaves no drill or exercise without a description', () => {
    for (const drill of SEED_DRILLS)
      expect(drill.description?.length, drill.slug).toBeGreaterThan(10)
    for (const exercise of EXERCISES)
      expect(exercise.summary?.length, exercise.slug).toBeGreaterThan(10)
  })
})
