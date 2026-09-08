import { beforeEach, describe, expect, it } from 'vitest'

import {
  FIRST_RUN_FROM,
  markWelcomeShownThisLoad,
  resetWelcomeLoadState,
  shouldSeeWelcome,
  wasWelcomeShownThisLoad,
  type FirstRunInput,
} from './firstRun'

const input = (overrides: Partial<FirstRunInput> = {}): FirstRunInput => ({
  loading: false,
  hasProfile: false,
  hasSessions: false,
  seenWelcome: false,
  path: FIRST_RUN_FROM,
  ...overrides,
})

describe('shouldSeeWelcome', () => {
  it('sends a genuinely new visitor to the welcome', () => {
    expect(shouldSeeWelcome(input())).toBe(true)
  })

  it('waits until the profile and history have actually loaded', () => {
    // Otherwise a returning player sees the catalogue, gets bounced to the
    // welcome, and gets bounced back the moment their profile arrives.
    expect(shouldSeeWelcome(input({ loading: true }))).toBe(false)
  })

  it('never shows it twice', () => {
    expect(shouldSeeWelcome(input({ seenWelcome: true }))).toBe(false)
  })

  it('leaves a returning player alone, flag or no flag', () => {
    expect(shouldSeeWelcome(input({ hasProfile: true }))).toBe(false)
    expect(shouldSeeWelcome(input({ hasSessions: true }))).toBe(false)
    // Cleared storage, but they have clearly used the app before.
    expect(shouldSeeWelcome(input({ hasSessions: true, seenWelcome: false }))).toBe(false)
  })

  it('never hijacks a deep link', () => {
    // Somebody opening a challenge someone sent them should land on the
    // challenge, not on an introduction to the app.
    for (const path of [
      '/challenge/ABC',
      '/run/six-corner-shadow',
      '/library/technique/the-smash',
      '/premium',
      '/progress',
    ]) {
      expect(shouldSeeWelcome(input({ path })), path).toBe(false)
    }
  })

  it('does not redirect away from the welcome or the questionnaire', () => {
    expect(shouldSeeWelcome(input({ path: '/welcome' }))).toBe(false)
    expect(shouldSeeWelcome(input({ path: '/onboarding' }))).toBe(false)
  })

  it('does not trap anyone when storage refuses to persist the flag', () => {
    // Private mode: the flag never sticks, so skipping would bounce straight
    // back. One redirect per page load is the escape hatch.
    const stuck = input({ seenWelcome: false, redirectedThisLoad: true })
    expect(shouldSeeWelcome(stuck)).toBe(false)
  })

  it('still shows it on the first pass of that same page load', () => {
    expect(shouldSeeWelcome(input({ redirectedThisLoad: false }))).toBe(true)
  })
})

describe('the per-load guard', () => {
  beforeEach(resetWelcomeLoadState)

  it('starts clear on a fresh page load', () => {
    expect(wasWelcomeShownThisLoad()).toBe(false)
  })

  it('closes the loop once the welcome has been shown', () => {
    // The sequence that matters: land on `/`, get redirected, press Skip, and
    // — with storage refusing to keep the flag — land back on `/`.
    expect(shouldSeeWelcome(input({ redirectedThisLoad: wasWelcomeShownThisLoad() }))).toBe(true)
    markWelcomeShownThisLoad()
    expect(shouldSeeWelcome(input({ redirectedThisLoad: wasWelcomeShownThisLoad() }))).toBe(false)
  })

  it('is idempotent', () => {
    markWelcomeShownThisLoad()
    markWelcomeShownThisLoad()
    expect(wasWelcomeShownThisLoad()).toBe(true)
  })
})

describe('a browser that will not remember anything', () => {
  it('never shows the welcome, because it could never stop showing it', () => {
    /*
     * With storage refused the flag cannot be written, and no profile or
     * session is ever kept either — so every condition stays true and the
     * redirect fires on every visit to the home screen. Finish a drill in an
     * in-app browser and the app greets you as a brand-new user.
     */
    expect(
      shouldSeeWelcome({
        loading: false,
        hasProfile: false,
        hasSessions: false,
        seenWelcome: false,
        path: FIRST_RUN_FROM,
        storageWritable: false,
      }),
    ).toBe(false)
  })

  it('still shows it to a genuine first visit that can remember', () => {
    const first = {
      loading: false,
      hasProfile: false,
      hasSessions: false,
      seenWelcome: false,
      path: FIRST_RUN_FROM,
    }
    expect(shouldSeeWelcome(first)).toBe(true)
    expect(shouldSeeWelcome({ ...first, storageWritable: true })).toBe(true)
  })
})
