import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { ScreenFallback } from '@/components/ScreenFallback'
import { useAuth } from '@/lib/auth/context'

import { RepositoriesContext, useRepositories } from './context'
import { createRepositories } from './index'
import { migrateLocalHistory } from './migrate'

interface DataProviderProps {
  children: ReactNode
  /** Overrides the signed-in user; used by tests. */
  userId?: string | null
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Local storage reads are instant and the app must work offline, so
        // retrying a "failed" query buys nothing but a delay.
        retry: false,
        refetchOnWindowFocus: false,
        staleTime: 30_000,
        // Not the default 'online', which pauses every read once the browser
        // fires 'offline' — the data is on this phone and needs no network.
        // A paused query is neither loading nor loaded, so screens read it as
        // empty: every drill finished on a court with no signal ended on
        // "Session not found", with the session saved and out of reach. With
        // an account, a read that cannot reach the server now fails at once
        // instead of hanging.
        networkMode: 'always',
      },
    },
  })
}

/**
 * Picks the backend for the whole app based on who is signed in, and hands a
 * signed-out history over to the account the first time someone signs in.
 *
 * **One cache per person.** Every query key here is unscoped — `['profile']`,
 * `['sessions', ...]` — so a cache shared across a sign-in or a sign-out
 * serves the previous person's data for as long as it is fresh. On a phone
 * passed around a club, signing out would have kept somebody else's history
 * on screen. So the cache is created with the repositories, and the tree below
 * is keyed on the user: a query observer stays bound to the cache it was
 * created with, and handing it a new one without a remount would not reach it.
 */
export function DataProvider({ children, userId }: DataProviderProps) {
  const auth = useAuth()
  const resolvedUserId = userId !== undefined ? userId : (auth.user?.id ?? null)

  const { repositories, queryClient } = useMemo(
    () => ({
      repositories: createRepositories(resolvedUserId),
      queryClient: createQueryClient(),
    }),
    [resolvedUserId],
  )

  const migratedFor = useRef<string | null>(null)
  useEffect(() => {
    if (!resolvedUserId || repositories.backend !== 'supabase') return
    if (migratedFor.current === resolvedUserId) return
    migratedFor.current = resolvedUserId

    void migrateLocalHistory(repositories, resolvedUserId)
      .then((result) => {
        if (result.skipped) return
        // The dashboard was very likely already rendered from an empty account.
        void queryClient.invalidateQueries()
      })
      .catch(() => {
        // A failed upload leaves the local copy intact and the marker unset,
        // so the next sign-in tries again. Nothing is lost either way.
        migratedFor.current = null
      })
  }, [repositories, resolvedUserId, queryClient])

  return (
    <QueryClientProvider client={queryClient} key={resolvedUserId ?? 'this-phone'}>
      <RepositoriesContext.Provider value={repositories}>
        <ProfileLoaded>{children}</ProfileLoaded>
      </RepositoriesContext.Provider>
    </QueryClientProvider>
  )
}

/**
 * The longest the app will hold its screens for the profile. Reading it from
 * this phone takes milliseconds; this only matters for an account on a bad
 * connection, where a request that never answers must not mean an app that
 * never opens.
 */
export const PROFILE_WAIT_MS = 1500

/**
 * Holds the screens until the player's profile has been read.
 *
 * Until it has, their level reads as beginner, and every screen that renders
 * first draws a beginner's session: the runner showed "5:52" for two or three
 * frames before correcting itself to "7:35", and it used to build the drill
 * itself from that first render. Waiting here means no screen ever sees the
 * placeholder for somebody who has a profile. A failed read falls through —
 * offline with an account, the app still runs, as the placeholder says.
 */
function ProfileLoaded({ children }: { children: ReactNode }) {
  const repositories = useRepositories()
  const profile = useQuery({
    queryKey: ['profile'],
    queryFn: () => repositories.profiles.get(),
  })
  const [gaveUp, setGaveUp] = useState(false)

  useEffect(() => {
    if (!profile.isPending) return
    const timer = window.setTimeout(() => setGaveUp(true), PROFILE_WAIT_MS)
    return () => window.clearTimeout(timer)
  }, [profile.isPending])

  if (profile.isPending && !gaveUp) return <ScreenFallback fullScreen />
  return children
}
