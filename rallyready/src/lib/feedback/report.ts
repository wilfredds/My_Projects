import type { Discipline, SkillLevel } from '@/lib/data/types'

/**
 * Turning "this bit is confusing" into something the person who wrote the app
 * can act on.
 *
 * The app had no way for anybody to say anything. Hand it to a player at the
 * club, watch them hit something baffling, and unless you are standing next to
 * them you never find out — and everything they did is in their own browser's
 * local storage where you cannot see it either.
 *
 * There is no server to post to. So a report is *text*, built here and handed
 * to whatever the phone already has: the share sheet, which on a Philippine
 * club player's phone means Messenger. That is not a workaround, it is the
 * shortest path between somebody's annoyance and a fix.
 *
 * ## What goes in, and what deliberately does not
 *
 * Enough context that a bug is reproducible — the screen, the level, the
 * app build, the viewport — and nothing that identifies anybody. No name, no
 * email, no account id. The only personal thing in here is what the tester
 * typed, and the training history they explicitly asked to attach. The report
 * says on its face what it contains, because somebody is about to send it to
 * another human and should be able to read it first.
 */

export const FEEDBACK_TOPICS = [
  'confusing',
  'bug',
  'too-hard',
  'too-easy',
  'idea',
  'other',
] as const
export type FeedbackTopic = (typeof FEEDBACK_TOPICS)[number]

export const TOPIC_LABEL: Record<FeedbackTopic, string> = {
  confusing: 'Confusing',
  bug: 'Something broke',
  'too-hard': 'Too hard',
  'too-easy': 'Too easy',
  idea: 'An idea',
  other: 'Something else',
}

export type FeedbackRating = 'good' | 'ok' | 'bad'

export const RATING_LABEL: Record<FeedbackRating, string> = {
  good: 'Enjoyed it',
  ok: 'It was fine',
  bad: 'Did not enjoy it',
}

export interface FeedbackDraft {
  topic: FeedbackTopic
  rating: FeedbackRating | null
  message: string
}

export interface FeedbackContext {
  /** The route they were on when they opened this. */
  path: string
  build: string
  level: SkillLevel
  discipline: Discipline
  /** How much they have actually used it — an opinion after one go is a
   *  different opinion from one after twenty. */
  sessions: number
  /** Viewport, which is how a layout bug gets reproduced. */
  viewport: string
  userAgent: string
}

/** Long enough for a real report, short enough to survive a chat app. */
export const MAX_MESSAGE = 1200

export function isSendable(draft: FeedbackDraft): boolean {
  return draft.message.trim().length >= 3
}

const line = (label: string, value: string) => `${label}: ${value}`

/**
 * The report, as plain text.
 *
 * Plain text rather than JSON because a human reads it first — in a chat
 * window, on a phone — and decides whether to send it. A blob of JSON is
 * something you forward without reading, which is exactly the wrong instinct
 * to encourage when it may carry someone's training history.
 */
export function buildReport(
  draft: FeedbackDraft,
  context: FeedbackContext,
  history?: string,
): string {
  const message = draft.message.trim().slice(0, MAX_MESSAGE)
  const parts = [
    'RallyReady feedback',
    '',
    message,
    '',
    '--- what this includes ---',
    line('Topic', TOPIC_LABEL[draft.topic]),
    ...(draft.rating ? [line('Session', RATING_LABEL[draft.rating])] : []),
    line('Screen', context.path),
    line('Level', `${context.level}, ${context.discipline}`),
    line('Sessions logged', String(context.sessions)),
    line('Build', context.build),
    line('Viewport', context.viewport),
    line('Browser', context.userAgent),
  ]

  if (history) {
    parts.push(
      '',
      '--- training history attached ---',
      'Your logged sessions, so the drills you actually ran can be looked at.',
      'No name, email or account is included anywhere in this report.',
      '',
      history,
    )
  }

  return parts.join('\n')
}

/** A filename for the copy that gets saved rather than shared. */
export function reportFilename(now = new Date()): string {
  const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, '-')
  return `rallyready-feedback-${stamp}.txt`
}
