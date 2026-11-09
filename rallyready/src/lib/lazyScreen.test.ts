import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  lazyScreen,
  prefetchScreens,
  RELOAD_WINDOW_MS,
  ScreenNotLoadedError,
  shouldReloadForNewBuild,
} from './lazyScreen'

describe('answering a screen that did not download', () => {
  const now = 1_000_000

  it('reloads once, to pick up the build the service worker just installed', () => {
    expect(
      shouldReloadForNewBuild({ lastReloadAt: null, now, online: true, controlled: true }),
    ).toBe(true)
  })

  it('does not reload again inside the window — a second failure is a real one', () => {
    const lastReloadAt = now - RELOAD_WINDOW_MS + 1
    expect(shouldReloadForNewBuild({ lastReloadAt, now, online: true, controlled: true })).toBe(
      false,
    )
    expect(
      shouldReloadForNewBuild({
        lastReloadAt: now - RELOAD_WINDOW_MS - 1,
        now,
        online: true,
        controlled: true,
      }),
    ).toBe(true)
  })

  it('stays in the app when offline with no service worker to reload from', () => {
    expect(
      shouldReloadForNewBuild({ lastReloadAt: null, now, online: false, controlled: false }),
    ).toBe(false)
    // Offline but installed: the reload is served from the phone's own copy.
    expect(
      shouldReloadForNewBuild({ lastReloadAt: null, now, online: false, controlled: true }),
    ).toBe(true)
  })

  it('never reloads when it cannot remember trying, so it cannot loop', () => {
    expect(
      shouldReloadForNewBuild({ lastReloadAt: undefined, now, online: true, controlled: true }),
    ).toBe(false)
  })

  it('names the failure for what it is', () => {
    const error = new ScreenNotLoadedError(
      new TypeError('Failed to fetch dynamically imported module'),
    )
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('ScreenNotLoadedError')
    expect(error.message).toMatch(/Failed to fetch/)
  })
})

describe('fetching the other screens in the background', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  /** Let the idle fallback (a 200ms timer here) and the promises behind it run. */
  async function idle(times = 1) {
    for (let i = 0; i < times; i++) await vi.advanceTimersByTimeAsync(250)
  }

  it('downloads each screen once, however often it is asked', async () => {
    const load = vi.fn(() => Promise.resolve({ Screen: () => null }))
    lazyScreen(load, 'Screen')

    const first = prefetchScreens()
    await idle(40)
    first()
    const again = prefetchScreens()
    await idle(40)
    again()

    expect(load).toHaveBeenCalledTimes(1)
  })

  it('forgets a download that failed, so it is tried again once there is a signal', async () => {
    const load = vi
      .fn<() => Promise<{ Screen: () => null }>>()
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValue({ Screen: () => null })
    lazyScreen(load, 'Screen')

    const first = prefetchScreens()
    await idle(40)
    first()
    expect(load).toHaveBeenCalledTimes(1)

    const again = prefetchScreens()
    await idle(40)
    again()
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('stops as soon as it is cancelled — a runner has opened', async () => {
    const loads = Array.from({ length: 5 }, () =>
      vi.fn(() => Promise.resolve({ Screen: () => null })),
    )
    loads.forEach((load) => lazyScreen(load, 'Screen'))

    const cancel = prefetchScreens()
    cancel()
    await idle(80)

    expect(loads.every((load) => load.mock.calls.length === 0)).toBe(true)
  })

  it('starts nothing new after a cancel that lands mid-download', async () => {
    let finish: () => void = () => {}
    const slow = vi.fn(
      () =>
        new Promise<{ Screen: () => null }>((resolve) => {
          finish = () => resolve({ Screen: () => null })
        }),
    )
    const after = vi.fn(() => Promise.resolve({ Screen: () => null }))
    lazyScreen(slow, 'Screen')
    lazyScreen(after, 'Screen')

    const cancel = prefetchScreens()
    for (let i = 0; i < 80 && slow.mock.calls.length === 0; i++) await idle()
    expect(slow).toHaveBeenCalledTimes(1)

    // The player taps Start while that screen is still on its way.
    cancel()
    finish()
    await idle(40)

    expect(after).not.toHaveBeenCalled()
  })

  it('fetches one screen per idle moment, not all of them in one task', async () => {
    const startedAt: number[] = []
    const load = () => {
      startedAt.push(Date.now())
      return Promise.resolve({ Screen: () => null })
    }
    for (let i = 0; i < 3; i++) lazyScreen(load, 'Screen')

    // Screens registered by earlier tests are queued ahead of these and are
    // already downloaded; that only moves where ours start, not how.
    const cancel = prefetchScreens()
    await idle(80)
    cancel()

    expect(startedAt).toHaveLength(3)
    // The idle fallback here is a 200ms timer: each download waits for its own.
    for (let i = 1; i < startedAt.length; i++) {
      expect(startedAt[i]! - startedAt[i - 1]!).toBeGreaterThanOrEqual(200)
    }
  })
})
