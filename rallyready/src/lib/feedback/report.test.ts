import { describe, expect, it } from 'vitest'

import {
  buildReport,
  isSendable,
  MAX_MESSAGE,
  reportFilename,
  TOPIC_LABEL,
  FEEDBACK_TOPICS,
  type FeedbackContext,
  type FeedbackDraft,
} from './report'

const context: FeedbackContext = {
  path: '/train/six-corner-shadow',
  build: '0.1.0 (2026-09-08)',
  level: 'intermediate',
  discipline: 'singles',
  sessions: 14,
  viewport: '390×844',
  userAgent: 'Mozilla/5.0 (iPhone)',
}

const draft = (overrides: Partial<FeedbackDraft> = {}): FeedbackDraft => ({
  topic: 'confusing',
  rating: 'ok',
  message: 'The rally names go by too fast to read.',
  ...overrides,
})

describe('a feedback report', () => {
  it('leads with what the person actually said', () => {
    // They are about to read this in a chat window before sending it. The
    // complaint goes at the top; the diagnostics are the footnote.
    const report = buildReport(draft(), context)
    const body = report.split('--- what this includes ---')[0] ?? ''
    expect(body).toContain('The rally names go by too fast to read.')
    expect(body).not.toContain('Mozilla')
  })

  it('carries enough to reproduce a bug', () => {
    const report = buildReport(draft({ topic: 'bug' }), context)
    expect(report).toContain('/train/six-corner-shadow')
    expect(report).toContain('0.1.0 (2026-09-08)')
    expect(report).toContain('390×844')
    expect(report).toContain('intermediate, singles')
    // How much they have used it changes what their opinion is worth.
    expect(report).toContain('Sessions logged: 14')
  })

  it('identifies nobody unless they type it themselves', () => {
    const report = buildReport(draft({ message: 'no personal details here' }), context)
    for (const forbidden of ['@', 'userId', 'user_id', 'token', 'email']) {
      expect(report.toLowerCase(), forbidden).not.toContain(forbidden)
    }
  })

  it('only attaches the training history when one is handed to it', () => {
    expect(buildReport(draft(), context)).not.toContain('training history attached')
    const withHistory = buildReport(draft(), context, '{"sessions":[]}')
    expect(withHistory).toContain('training history attached')
    expect(withHistory).toContain('{"sessions":[]}')
    // Says what it contains, because a person forwards this to another person.
    expect(withHistory).toContain('No name, email or account is included')
  })

  it('caps a message that would not survive a chat app', () => {
    const long = 'x'.repeat(MAX_MESSAGE * 3)
    const report = buildReport(draft({ message: long }), context)
    expect(report).toContain('x'.repeat(MAX_MESSAGE))
    expect(report).not.toContain('x'.repeat(MAX_MESSAGE + 1))
  })

  it('will not send an empty complaint', () => {
    expect(isSendable(draft({ message: '' }))).toBe(false)
    expect(isSendable(draft({ message: '   ' }))).toBe(false)
    expect(isSendable(draft({ message: 'no' }))).toBe(false)
    expect(isSendable(draft({ message: 'too fast' }))).toBe(true)
  })

  it('names every topic it offers', () => {
    for (const topic of FEEDBACK_TOPICS) {
      expect(TOPIC_LABEL[topic].length).toBeGreaterThan(3)
      expect(buildReport(draft({ topic }), context)).toContain(TOPIC_LABEL[topic])
    }
  })

  it('omits the rating line rather than inventing one', () => {
    expect(buildReport(draft({ rating: null }), context)).not.toContain('Session:')
  })

  it('names the file by when it was written', () => {
    const name = reportFilename(new Date('2026-09-08T14:30:05Z'))
    expect(name).toBe('rallyready-feedback-2026-09-08-14-30-05.txt')
  })
})
