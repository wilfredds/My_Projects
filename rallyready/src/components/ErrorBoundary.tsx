import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { ScreenNotLoadedError } from '@/lib/lazyScreen'

interface ErrorBoundaryProps {
  children: ReactNode
  /** Changing it clears the error: the player has gone somewhere else. */
  resetKey: string
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * The last line of defence. Without one, a single render throw leaves a blank
 * white page with no way out — and on an installed PWA there is no address bar
 * to escape with either.
 *
 * Keyed on the path, so going anywhere else — the phone's Back button
 * included — clears it. Before, Back changed the address and left the error on
 * screen, which on an installed app is the only button there is.
 */
export function ErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  return <Boundary resetKey={pathname}>{children}</Boundary>
}

/** A class component because this is the one thing hooks still cannot do. */
class Boundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null }

  /** Re-render when the signal comes or goes, so "Try again" can appear. */
  private readonly connectivity = () => {
    if (this.state.error) this.forceUpdate()
  }

  override componentDidMount() {
    window.addEventListener('online', this.connectivity)
    window.addEventListener('offline', this.connectivity)
  }

  override componentWillUnmount() {
    window.removeEventListener('online', this.connectivity)
    window.removeEventListener('offline', this.connectivity)
  }

  override componentDidUpdate(previous: ErrorBoundaryProps) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // No analytics endpoint to report to, and inventing one would be worse
    // than the console for someone debugging their own install.
    console.error('RallyReady crashed:', error, info.componentStack)
  }

  override render() {
    const { error } = this.state
    if (!error) return this.props.children

    // A screen that never downloaded is not a bug, and saying "that is a bug"
    // to somebody with no signal sends them looking for the wrong fix. It also
    // cannot be retried in place: React keeps a failed screen's error, so only
    // a reload asks the network again.
    const notLoaded = error instanceof ScreenNotLoadedError
    // A reload with no signal and no service worker lands on the browser's own
    // "no internet" page, outside the app entirely. Only offer it when it can
    // work; the copy already says to connect first.
    const canReload = navigator.onLine || Boolean(navigator.serviceWorker?.controller)
    const buttonClass =
      'border-border hover:bg-secondary/60 focus-visible:ring-ring grid h-12 place-items-center rounded-xl border text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none'

    return (
      <div className="grid min-h-dvh place-items-center p-6">
        <div className="max-w-sm text-center">
          <div className="bg-secondary mx-auto mb-5 grid size-14 place-items-center rounded-2xl">
            <svg viewBox="0 0 24 24" className="text-muted-foreground size-7" aria-hidden>
              <path
                d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {notLoaded ? 'This screen did not load' : 'Something broke'}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            {notLoaded
              ? 'It needs the internet the first time it opens. Connect, then try again. Your sessions are safe.'
              : 'That is a bug in RallyReady, not something you did. Your logged sessions are safe — nothing is stored in the screen that failed.'}
          </p>

          <div className="mt-6 flex flex-col gap-2">
            {(!notLoaded || canReload) && (
              <button
                type="button"
                onClick={() =>
                  notLoaded ? window.location.reload() : this.setState({ error: null })
                }
                className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring h-12 rounded-xl text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none"
              >
                Try that again
              </button>
            )}
            {notLoaded ? (
              // Inside the app, not a page load: Train is in the first download,
              // so it opens with no signal at all.
              <Link to="/" className={buttonClass}>
                Back to Train
              </Link>
            ) : (
              // A full load on purpose: after a real crash, start clean.
              <a href="/" className={buttonClass}>
                Back to Train
              </a>
            )}
          </div>

          <details className="mt-6 text-left">
            <summary className="text-muted-foreground cursor-pointer text-xs">
              Technical detail
            </summary>
            <pre className="text-muted-foreground mt-2 overflow-x-auto rounded-lg border p-3 text-[0.6875rem] leading-relaxed">
              {error.message}
            </pre>
          </details>
        </div>
      </div>
    )
  }
}
