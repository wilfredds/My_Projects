import { describe, expect, it } from 'vitest'

import {
  creditedEnd,
  daysUntil,
  promiseStatus,
  summarise,
  weekCount,
  weeksOf,
  type Commitment,
} from './commitment'
import { isUnlocked, PREMIUM_FEATURES } from './entitlements'

const WEEK = 7 * 86_400_000
const START = Date.UTC(2026, 0, 5) // a Monday

const block = (overrides: Partial<Commitment> = {}): Commitment => ({
  bundleId: 'quarter',
  startedAt: START,
  endsAt: START + 12 * WEEK,
  sessionsPerWeek: 3,
  ...overrides,
})

/** `n` sessions inside week `w` (0-based). */
const inWeek = (w: number, n: number) =>
  Array.from({ length: n }, (_, i) => START + w * WEEK + (i + 1) * 86_400_000)

describe('weekCount', () => {
  it('counts the weeks a block covers', () => {
    expect(weekCount(block())).toBe(12)
    expect(weekCount(block({ endsAt: START + 4 * WEEK }))).toBe(4)
  })

  it('never reports a block with no weeks in it', () => {
    expect(weekCount(block({ endsAt: START }))).toBe(1)
  })
})

describe('weeksOf', () => {
  const now = START + 3 * WEEK + 86_400_000 // partway through week 4

  it('lays the block out one week at a time', () => {
    const weeks = weeksOf(block(), [], now)
    expect(weeks).toHaveLength(12)
    expect(weeks[0]?.index).toBe(1)
    expect(weeks[11]?.index).toBe(12)
  })

  it('marks a finished week met or short against what it asked', () => {
    const weeks = weeksOf(block(), [...inWeek(0, 3), ...inWeek(1, 1)], now)
    expect(weeks[0]?.state).toBe('met')
    expect(weeks[0]?.done).toBe(3)
    expect(weeks[1]?.state).toBe('short')
    expect(weeks[1]?.done).toBe(1)
  })

  it('counts doing more than asked as met, not as something to fix', () => {
    const weeks = weeksOf(block(), inWeek(0, 6), now)
    expect(weeks[0]?.state).toBe('met')
  })

  it('does not judge the week that is still running', () => {
    expect(weeksOf(block(), [], now)[3]?.state).toBe('current')
  })

  it('does not judge a week that has not happened', () => {
    expect(weeksOf(block(), [], now)[8]?.state).toBe('future')
  })

  it('ignores training done before the block was bought', () => {
    // Counting it would be the easiest lie in the file: the block did not
    // deliver work somebody did last month.
    const weeks = weeksOf(block(), [START - 2 * 86_400_000], now)
    expect(weeks.reduce((sum, week) => sum + week.done, 0)).toBe(0)
  })

  it('ignores training done after the block ended', () => {
    const weeks = weeksOf(block(), [START + 40 * WEEK], now)
    expect(weeks.reduce((sum, week) => sum + week.done, 0)).toBe(0)
  })

  it('separates a week we did not supply from a week they skipped', () => {
    // The one state that costs the app rather than blaming the player: they
    // paid for twelve weeks and premium stopped after four.
    const commitment = block()
    const weeks = weeksOf(commitment, [], START + 20 * WEEK, START + 4 * WEEK)
    expect(weeks.slice(0, 4).every((week) => week.state === 'short')).toBe(true)
    expect(weeks.slice(4).every((week) => week.state === 'uncovered')).toBe(true)
  })

  it('treats a block with nothing asked of it as ours too', () => {
    const weeks = weeksOf(block({ sessionsPerWeek: 0 }), [], now)
    expect(new Set(weeks.map((week) => week.state))).toEqual(new Set(['uncovered']))
  })
})

describe('summarise', () => {
  const now = START + 3 * WEEK + 86_400_000

  it('adds up only the weeks that have finished', () => {
    // Judging the week you are standing in would report everybody behind.
    const weeks = weeksOf(block(), [...inWeek(0, 3), ...inWeek(1, 3), ...inWeek(2, 3)], now)
    const s = summarise(weeks, now)
    expect(s.elapsedWeeks).toBe(3)
    expect(s.askedSoFar).toBe(9)
    expect(s.doneSoFar).toBe(9)
    expect(s.shortfall).toBe(0)
    expect(s.onTrack).toBe(true)
    expect(s.currentWeek).toBe(4)
  })

  it('says plainly how far behind somebody is', () => {
    const weeks = weeksOf(block(), [...inWeek(0, 3), ...inWeek(1, 1)], now)
    const s = summarise(weeks, now)
    expect(s.shortfall).toBe(5)
    expect(s.onTrack).toBe(false)
  })

  it('does not treat being ahead as debt', () => {
    const weeks = weeksOf(block(), [...inWeek(0, 9), ...inWeek(1, 9), ...inWeek(2, 9)], now)
    expect(summarise(weeks, now).shortfall).toBe(0)
  })

  it('has no current week once the block is over', () => {
    const after = START + 20 * WEEK
    expect(summarise(weeksOf(block(), [], after), after).currentWeek).toBeNull()
  })

  it('counts the weeks premium did not cover', () => {
    const weeks = weeksOf(block(), [], START + 20 * WEEK, START + 4 * WEEK)
    expect(summarise(weeks, START + 20 * WEEK).uncoveredWeeks).toBe(8)
  })
})

describe('creditedEnd', () => {
  const now = START + 3 * WEEK

  it('leaves a properly planned block alone', () => {
    const commitment = block()
    const weeks = weeksOf(commitment, [], now)
    expect(creditedEnd(commitment, weeks)).toBe(commitment.endsAt)
  })

  it('extends the block by every week premium did not cover', () => {
    const commitment = block()
    const weeks = weeksOf(commitment, [], START + 20 * WEEK, START + 4 * WEEK)
    expect(creditedEnd(commitment, weeks)).toBe(commitment.endsAt + 8 * WEEK)
  })

  it('credits regardless of what the player did with the week', () => {
    // A week we did not supply is a week we did not supply, whether or not
    // they trained anyway.
    const commitment = block()
    const cut = START + 4 * WEEK
    const busy = weeksOf(commitment, inWeek(6, 5), START + 20 * WEEK, cut)
    const idle = weeksOf(commitment, [], START + 20 * WEEK, cut)
    expect(creditedEnd(commitment, busy)).toBe(creditedEnd(commitment, idle))
  })
})

describe('promiseStatus', () => {
  it('reports every promise the upgrade page makes', () => {
    expect(promiseStatus('premium', isUnlocked)).toHaveLength(PREMIUM_FEATURES.length)
  })

  it('reads the real entitlement rather than asserting delivery', () => {
    // The page must not be able to claim a feature is on while the app
    // refuses it, so this goes through the same function the app gates on.
    for (const promise of promiseStatus('premium', isUnlocked)) expect(promise.live).toBe(true)
    for (const promise of promiseStatus('free', isUnlocked)) expect(promise.live).toBe(false)
  })
})

describe('daysUntil', () => {
  it('counts whole days left', () => {
    expect(daysUntil(START + 3 * 86_400_000, START)).toBe(3)
  })

  it('never counts backwards', () => {
    expect(daysUntil(START, START + 10 * 86_400_000)).toBe(0)
  })
})
