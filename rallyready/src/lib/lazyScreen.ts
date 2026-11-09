import { lazy, type ComponentType } from 'react'

/**
 * Screens that are not part of the core loop, loaded when they are opened.
 *
 * The whole app used to ship as one 1.3 MB file, so a cold open of Train on a
 * mid-range phone over slow 4G waited for the chart library before it could
 * show anything — and only Progress and Benchmark draw a chart. The core loop
 * (Train, drill setup, the runner, the summary) stays in the first download;
 * everything here arrives when it is asked for.
 *
 * Splitting costs two things the single file got for free, and both are paid
 * for below:
 *
 * - **A phone still running last week's build.** The service worker updates
 *   in the background and deletes the old files. A page that was already open
 *   still asks for the old screen file, and it is gone. One reload picks up the
 *   new build; a second failure inside the same window is a real failure, not
 *   a stale page, and is shown as one.
 * - **The offline promise.** One file meant that once the page had opened,
 *   every screen worked without a signal, whether or not the service worker had
 *   finished saving its copy. `prefetchScreens` restores that: after the first
 *   screen is up it fetches the rest, one at a time, while the phone is idle.
 */

/** Thrown when a screen could not be downloaded and a reload would not help. */
export class ScreenNotLoadedError extends Error {
  override name = 'ScreenNotLoadedError'
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : 'A screen could not be downloaded.')
    this.cause = cause
  }
}

/** How long a reload counts as "just tried that". */
export const RELOAD_WINDOW_MS = 10_000

const RELOADED_AT_KEY = 'rallyready.reloadedForNewBuildAt'

/**
 * Whether a failed screen download should be answered with a reload.
 *
 * Not when offline with no service worker: the reload would leave the app for
 * the browser's own "no internet" page, which is a worse place to be than an
 * honest message inside it. Not twice in a row: if the reload did not fix it,
 * another one will not either, and a loop is a phone that cannot be used.
 * Not when the last reload is unknown — a browser that refuses storage cannot
 * remember it tried, and guessing "never" is how the loop starts.
 */
export function shouldReloadForNewBuild(state: {
  lastReloadAt: number | null | undefined
  now: number
  online: boolean
  controlled: boolean
}): boolean {
  if (state.lastReloadAt === undefined) return false
  if (!state.online && !state.controlled) return false
  return state.lastReloadAt === null || state.now - state.lastReloadAt > RELOAD_WINDOW_MS
}

/** `undefined` means storage refused to answer, not that nothing was stored. */
function readLastReload(): number | null | undefined {
  try {
    const raw = sessionStorage.getItem(RELOADED_AT_KEY)
    if (raw === null) return null
    const at = Number(raw)
    return Number.isFinite(at) ? at : null
  } catch {
    return undefined
  }
}

function recover(error: unknown): Promise<never> {
  const now = Date.now()
  const reload = shouldReloadForNewBuild({
    lastReloadAt: readLastReload(),
    now,
    online: navigator.onLine,
    controlled: Boolean(navigator.serviceWorker?.controller),
  })
  if (reload) {
    try {
      sessionStorage.setItem(RELOADED_AT_KEY, String(now))
      window.location.reload()
      // Never settles: the page is going away, and settling would flash the
      // error screen for the moment before it does.
      return new Promise<never>(() => {})
    } catch {
      // Could not record the attempt, so it must not be made.
    }
  }
  return Promise.reject(new ScreenNotLoadedError(error))
}

type Loaded = { default: ComponentType }

const prefetchers: (() => Promise<unknown>)[] = []

/**
 * `React.lazy` over a named export, sharing one download with the prefetcher.
 *
 * A failed download is forgotten rather than cached, so a prefetch that ran
 * while offline does not poison the screen for when the signal comes back.
 */
export function lazyScreen<M>(load: () => Promise<M>, name: keyof M) {
  let pending: Promise<Loaded> | null = null
  const download = () =>
    (pending ??= load().then(
      (module) => ({ default: module[name] as ComponentType }),
      (error: unknown) => {
        pending = null
        throw error
      },
    ))

  // A prefetch that fails is fine — the screen will try again when opened. It
  // must never reload the page: the player is in the middle of something.
  prefetchers.push(() => download().catch(() => undefined))
  return lazy(() => download().catch(recover))
}

/**
 * Fetch every lazy screen, one per idle moment, until `cancel` is called.
 *
 * The caller cancels when a runner opens. Evaluating a screen's code is a task
 * on the main thread, and during a drill that is exactly the thread that has to
 * be free when the next call is due.
 */
export function prefetchScreens(): () => void {
  let cancelled = false
  let handle: number | undefined
  const idle =
    typeof window.requestIdleCallback === 'function'
      ? (fn: () => void) => window.requestIdleCallback(fn, { timeout: 4000 })
      : (fn: () => void) => window.setTimeout(fn, 200)
  const stop =
    typeof window.cancelIdleCallback === 'function'
      ? (id: number) => window.cancelIdleCallback(id)
      : (id: number) => window.clearTimeout(id)

  const queue = [...prefetchers]
  const next = () => {
    const job = queue.shift()
    if (!job || cancelled) return
    void job().then(() => {
      if (!cancelled) handle = idle(next)
    })
  }
  handle = idle(next)

  return () => {
    cancelled = true
    if (handle !== undefined) stop(handle)
  }
}
