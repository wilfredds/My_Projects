import { describe, expect, it } from 'vitest'
import { SEED_DRILLS, isPrepOrRecovery } from '@/lib/data/seed/drills'
import { configFromDrill, estimateDurationSec } from '@/lib/timer/plan'

import {
  configForToday,
  autoRegulate,
  clampAnswer,
  READINESS_QUESTIONS,
  hasRedFlag,
  readinessBand,
  readinessScore,
  weakestAnswer,
} from './readiness'
import type { ReadinessAnswers } from './types'

const answers = (sleep: number, soreness: number, energy: number): ReadinessAnswers => ({
  sleep,
  soreness,
  energy,
})

describe('readinessScore', () => {
  it('runs 0 to 100 across the scale', () => {
    expect(readinessScore(answers(1, 1, 1))).toBe(0)
    expect(readinessScore(answers(3, 3, 3))).toBe(50)
    expect(readinessScore(answers(5, 5, 5))).toBe(100)
  })

  it('treats a bad answer as bad whichever question it came from', () => {
    expect(readinessScore(answers(1, 5, 5))).toBe(readinessScore(answers(5, 5, 1)))
  })

  it('survives junk answers rather than producing NaN', () => {
    expect(readinessScore(answers(Number.NaN, 9, -4))).toBe(readinessScore(answers(3, 5, 1)))
  })
})

describe('clampAnswer', () => {
  it('holds answers inside the scale', () => {
    expect(clampAnswer(0)).toBe(1)
    expect(clampAnswer(6)).toBe(5)
    expect(clampAnswer(3.4)).toBe(3)
  })
})

describe('readinessBand', () => {
  it('splits into beat up, serviceable and ready', () => {
    expect(readinessBand(answers(2, 2, 2))).toBe('low') // 25
    expect(readinessBand(answers(3, 3, 2))).toBe('fair') // 42
    expect(readinessBand(answers(3, 3, 3))).toBe('fair') // 50
    expect(readinessBand(answers(4, 5, 5))).toBe('good') // 92
  })

  it('drops to beat up on any single bottom answer, however good the rest', () => {
    // Slept well, decent energy, legs destroyed: scores 50, and is not a day to
    // go and do repeated lunging.
    expect(readinessScore(answers(5, 1, 3))).toBe(50)
    expect(readinessBand(answers(5, 1, 3))).toBe('low')
    expect(hasRedFlag(answers(5, 1, 3))).toBe(true)
    expect(hasRedFlag(answers(2, 2, 2))).toBe(false)
  })
})

describe('weakestAnswer', () => {
  it('names the answer dragging the score down', () => {
    expect(weakestAnswer(answers(2, 5, 4))).toBe('sleep')
    expect(weakestAnswer(answers(5, 1, 4))).toBe('soreness')
    expect(weakestAnswer(answers(5, 4, 2))).toBe('energy')
  })

  it('breaks a tie on the first question rather than throwing', () => {
    expect(weakestAnswer(answers(2, 2, 2))).toBe('sleep')
  })
})

describe('autoRegulate', () => {
  it('leaves the session alone when nothing has been asked and load is normal', () => {
    expect(autoRegulate({ answers: null, load: 'steady' }).adjustment).toBe('as-planned')
  })

  it('backs off on a workload spike even with no check-in', () => {
    const result = autoRegulate({ answers: null, load: 'spiking' })
    expect(result.adjustment).toBe('lighter')
    expect(result.scale).toBeLessThan(1)
  })

  it('backs off when the player is beat up', () => {
    const result = autoRegulate({ answers: answers(1, 2, 2), load: 'steady' })
    expect(result.adjustment).toBe('lighter')
    expect(result.reason).toContain('slept badly')
  })

  it('names soreness rather than sleep when the legs are the problem', () => {
    const result = autoRegulate({ answers: answers(5, 1, 3), load: 'steady' })
    expect(result.adjustment).toBe('lighter')
    expect(result.reason).toContain('sore')
  })

  it('still backs off on a spike when the player feels great', () => {
    const result = autoRegulate({ answers: answers(5, 5, 5), load: 'spiking' })
    expect(result.adjustment).toBe('lighter')
  })

  it('offers more only when feel and workload both agree', () => {
    expect(autoRegulate({ answers: answers(5, 5, 5), load: 'steady' }).adjustment).toBe('harder')
    expect(autoRegulate({ answers: answers(5, 5, 5), load: 'building' }).adjustment).toBe(
      'as-planned',
    )
    expect(autoRegulate({ answers: answers(3, 3, 3), load: 'steady' }).adjustment).toBe(
      'as-planned',
    )
  })

  it('scales up when it says to push and down when it says to ease', () => {
    expect(autoRegulate({ answers: answers(5, 5, 5), load: 'steady' }).scale).toBeGreaterThan(1)
    expect(autoRegulate({ answers: answers(1, 1, 1), load: 'steady' }).scale).toBeLessThan(1)
    expect(autoRegulate({ answers: answers(3, 3, 3), load: 'steady' }).scale).toBe(1)
  })

  it('always produces something to show the user', () => {
    for (const load of ['settling', 'detraining', 'steady', 'building', 'spiking'] as const) {
      for (const score of [1, 3, 5]) {
        const result = autoRegulate({ answers: answers(score, score, score), load })
        expect(result.headline.length).toBeGreaterThan(0)
        expect(result.reason.length).toBeGreaterThan(0)
      }
    }
  })
})

describe('READINESS_QUESTIONS', () => {
  it('labels every point on every scale', () => {
    expect(READINESS_QUESTIONS).toHaveLength(3)
    for (const question of READINESS_QUESTIONS) {
      expect(question.scale).toHaveLength(5)
      expect(question.scale.every((label) => label.length > 0)).toBe(true)
    }
  })
})

describe('the settings a drill actually runs with today', () => {
  const drill = SEED_DRILLS.find((d) => d.slug === 'six-corner-shadow')!
  const warmUp = SEED_DRILLS.find((d) => isPrepOrRecovery(d))!
  const config = configFromDrill(drill, { level: 'intermediate', discipline: 'singles' })

  it('is the drill as configured when nothing was accepted', () => {
    expect(configForToday(config, drill, null)).toBe(config)
  })

  it('is shorter once the player accepts a lighter day', () => {
    /*
     * The runner has always scaled this. Every screen that quoted a duration
     * did not, so a card promised eight minutes and the drill ran six — the
     * one number mismatch only a returning player could ever see, because it
     * needs the daily check-in.
     */
    const lighter = configForToday(config, drill, 'lighter')
    expect(estimateDurationSec(lighter)).toBeLessThan(estimateDurationSec(config))
  })

  it('is longer on a good day', () => {
    expect(estimateDurationSec(configForToday(config, drill, 'harder'))).toBeGreaterThan(
      estimateDurationSec(config),
    )
  })

  it('never shortens a warm-up or a cool-down', () => {
    // A shorter warm-up is not a lighter session, it is a worse one.
    const prep = configFromDrill(warmUp, { level: 'intermediate', discipline: 'singles' })
    expect(configForToday(prep, warmUp, 'lighter')).toBe(prep)
    expect(configForToday(prep, warmUp, 'harder')).toBe(prep)
  })
})
