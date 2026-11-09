import { describe, expect, it } from 'vitest'

import { phaseByWeek } from './periodise'
import { whyToday } from './why'

describe('whyToday', () => {
  it('names the block and the position in the plan', () => {
    const why = whyToday({ totalWeeks: 8, currentWeek: 1, focus: 'footwork' })
    expect(why?.phase).toBe('base')
    expect(why?.label).toBe('Base week 1 of 8')
    expect(why?.purpose.length).toBeGreaterThan(0)
  })

  it('agrees with the periodiser about every week of a plan', () => {
    const phases = phaseByWeek(12)
    phases.forEach((phase, index) => {
      const why = whyToday({ totalWeeks: 12, currentWeek: index + 1, focus: 'footwork' })
      expect(why?.phase).toBe(phase)
    })
  })

  it('calls the last week the final one rather than another easy week', () => {
    const why = whyToday({ totalWeeks: 8, currentWeek: 8, focus: 'footwork' })
    expect(why?.label).toBe('Final week — the last of 8')
    expect(why?.ahead).toBeNull()
  })

  it('points at the next deload so a hard block reads as finite', () => {
    // Week 4 of any plan is a deload, so week 2 has two hard weeks left.
    const why = whyToday({ totalWeeks: 12, currentWeek: 2, focus: 'footwork' })
    expect(why?.ahead).toContain('Week 4')
  })

  it('says so plainly when the let-up is next week', () => {
    const why = whyToday({ totalWeeks: 12, currentWeek: 3, focus: 'conditioning' })
    expect(why?.ahead).toBe('Next week backs off — hold on until then.')
  })

  it('tells a deload week when normal service resumes', () => {
    const why = whyToday({ totalWeeks: 12, currentWeek: 4, focus: 'footwork' })
    expect(why?.phase).toBe('deload')
    expect(why?.ahead).toBe('Back to full training in week 5.')
  })

  it('explains a rest day as part of the plan rather than a gap in it', () => {
    const why = whyToday({ totalWeeks: 8, currentWeek: 2, focus: 'rest' })
    expect(why?.purpose).toContain('Rest is a session')
  })

  it('holds a week outside the plan to the plan', () => {
    expect(whyToday({ totalWeeks: 8, currentWeek: 99, focus: 'footwork' })?.label).toContain('of 8')
    expect(whyToday({ totalWeeks: 8, currentWeek: 0, focus: 'footwork' })?.label).toContain(
      'week 1',
    )
  })

  it('produces something for every week of every plan length', () => {
    for (let totalWeeks = 4; totalWeeks <= 16; totalWeeks++) {
      for (let week = 1; week <= totalWeeks; week++) {
        const why = whyToday({ totalWeeks, currentWeek: week, focus: 'footwork' })
        expect(why).not.toBeNull()
        expect(why?.label).not.toContain('undefined')
        expect(why?.purpose.length).toBeGreaterThan(20)
      }
    }
  })
})
