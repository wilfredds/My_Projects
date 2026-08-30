import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CloudOff,
  Database,
  LogIn,
  LogOut,
  Palette,
  PlayCircle,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UserRound,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Segmented } from '@/components/ui/segmented'
import { useTheme } from '@/hooks/useTheme'
import { useAuth } from '@/lib/auth/context'
import { isSupabaseConfigured } from '@/lib/data'
import { useRepositories } from '@/lib/data/context'
import { removeKey, STORAGE_KEYS } from '@/lib/data/local/storage'
import { WELCOME_PATH } from '@/lib/firstRun'
import type { ThemePreference } from '@/lib/theme'
import { formatDuration, pluralize } from '@/lib/utils'
import { useDrillConfigStore } from '@/store/drillConfigStore'
import { usePremium } from '@/store/premiumStore'

import { BackupCard } from './components/BackupCard'

const LEVEL_LABEL = {
  beginner: 'Getting back into it',
  intermediate: 'Club player',
  advanced: 'Competitive',
} as const

const GOAL_LABEL = {
  stamina: 'Rebuild stamina',
  footwork: 'Sharpen footwork',
  'match-ready': 'Get match-ready',
  consistency: 'Train consistently',
} as const

export function ProfilePage() {
  const repositories = useRepositories()
  const auth = useAuth()
  const queryClient = useQueryClient()
  const { preference, setPreference } = useTheme()
  const premium = usePremium()
  const clearAllConfigs = useDrillConfigStore((state) => state.clearAll)

  const { data: sessions = [] } = useQuery({
    queryKey: ['sessions', 'all'],
    queryFn: () => repositories.sessions.listRecent(500),
  })

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => repositories.profiles.get(),
  })

  const totalSeconds = sessions.reduce((sum, session) => sum + session.durationSec, 0)

  return (
    <>
      <PageHeader
        title="Profile"
        description="Your account, your settings, and where your data lives."
      />

      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="text-primary size-4" aria-hidden />
              Account
            </CardTitle>
            <CardDescription>
              {auth.status === 'signed-in'
                ? 'Your sessions sync to this account.'
                : auth.status === 'unavailable'
                  ? 'Accounts are switched off in this build, so your training stays on this device. Everything still works.'
                  : 'Signing in syncs your training across devices. It is entirely optional.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {auth.status === 'signed-in' && auth.user && (
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{auth.user.displayName ?? auth.user.email}</p>
                  <p className="text-muted-foreground truncate text-sm">{auth.user.email}</p>
                </div>
                <Button variant="outline" onClick={() => void auth.signOut()}>
                  <LogOut />
                  Sign out
                </Button>
              </div>
            )}

            {auth.status === 'signed-out' && (
              <Button asChild size="lg" className="w-full">
                <Link to="/signin">
                  <LogIn />
                  Sign in or create an account
                </Link>
              </Button>
            )}

            {profile ? (
              <div className="border-border flex items-start justify-between gap-4 border-t pt-4">
                <div>
                  <p className="text-muted-foreground text-xs font-medium">Training profile</p>
                  <p className="mt-1 text-sm">
                    {LEVEL_LABEL[profile.skillLevel]} · {GOAL_LABEL[profile.goal]}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-xs capitalize">
                    Mostly {profile.primaryDiscipline}
                  </p>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/onboarding">
                    <SlidersHorizontal />
                    Change
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="border-border border-t pt-4">
                <p className="text-muted-foreground mb-3 text-sm leading-relaxed">
                  Tell us your level and what you are training for, and we will pick your drills
                  more usefully. Takes under two minutes.
                </p>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/onboarding">Set up my training profile</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Anyone who has bought a block can see the account for it, without
            going hunting through a sales page for it. */}
        {premium.commitment && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="text-primary size-4" aria-hidden />
                Your Premium block
              </CardTitle>
              <CardDescription>
                What you bought, and what has actually been delivered — week by week.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link to="/premium">See the account</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/*
         * The introduction, on demand.
         *
         * The first-run redirect is deliberately narrow — it never fires for
         * anyone with a profile or a logged session, because re-introducing an
         * app to somebody who has been training in it for a month is worse than
         * not introducing it at all. The cost of that rule is that the people
         * most likely to want to *see* the introduction — anyone who skipped
         * it, anyone showing the app to a friend, and everybody who was already
         * using it the day it shipped — had no way in at all. This is the way
         * in. It does not reset anything.
         */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="text-primary size-4" aria-hidden />
              How RallyReady works
            </CardTitle>
            <CardDescription>
              The three-screen introduction, including the live call demo. New players see this
              once, automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link to={WELCOME_PATH}>
                <PlayCircle />
                Play the introduction
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="text-primary size-4" aria-hidden />
              Appearance
            </CardTitle>
            <CardDescription>Follows your system unless you pick one.</CardDescription>
          </CardHeader>
          <CardContent>
            <Segmented
              label="Theme"
              value={preference}
              options={[
                { value: 'system', label: 'System' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
              onChange={(value) => setPreference(value as ThemePreference)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {repositories.backend === 'supabase' ? (
                <Database className="text-primary size-4" aria-hidden />
              ) : (
                <CloudOff className="text-primary size-4" aria-hidden />
              )}
              Your data
            </CardTitle>
            <CardDescription>
              {repositories.backend === 'supabase'
                ? 'Synced to your account. A copy stays on this device so drills still run offline.'
                : 'Everything you have logged, and what it would take to lose it.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-muted-foreground text-xs font-medium">Sessions logged</dt>
                <dd className="tnum text-2xl font-bold">{sessions.length}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs font-medium">Total training time</dt>
                <dd className="tnum text-2xl font-bold">{formatDuration(totalSeconds)}</dd>
              </div>
            </dl>

            {/* Where the data lives, in words a player can act on. The old
                version read "Backend: local · Supabase not configured", which
                is a developer's status line, not an answer to "is my training
                safe if I lose this phone?". */}
            <p className="text-muted-foreground text-xs leading-relaxed">
              {repositories.backend === 'supabase'
                ? 'Saved to your account, so it survives losing this phone.'
                : isSupabaseConfigured()
                  ? 'Saved in this browser. Sign in and it comes with you to your other devices.'
                  : 'Saved in this browser. Clearing your browser data would erase it.'}
            </p>

            <Button
              variant="outline"
              onClick={() => {
                if (!window.confirm('Delete all sessions and saved drill setups on this device?')) {
                  return
                }
                removeKey(STORAGE_KEYS.sessions)
                removeKey(STORAGE_KEYS.metrics)
                removeKey(STORAGE_KEYS.benchmarks)
                removeKey(STORAGE_KEYS.badges)
                clearAllConfigs()
                void queryClient.invalidateQueries()
                window.location.reload()
              }}
            >
              <Trash2 />
              Clear local data
            </Button>
          </CardContent>
        </Card>

        {/* Directly after "Your data", because that card is where someone
            realises their training only exists in this one browser. */}
        <BackupCard />

        <Card>
          <CardHeader>
            <CardTitle>Recent sessions</CardTitle>
          </CardHeader>
          <CardContent>
            {sessions.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Nothing logged yet.{' '}
                <Link className="text-primary underline" to="/">
                  Start a drill
                </Link>{' '}
                and it will show up here.
              </p>
            ) : (
              <ul className="divide-border divide-y">
                {sessions.slice(0, 10).map((session) => (
                  <li key={session.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <Link
                        to={`/session/${session.id}`}
                        className="truncate text-sm font-medium hover:underline"
                      >
                        {session.drillName ?? 'Custom drill'}
                      </Link>
                      <p className="text-muted-foreground text-xs">
                        {new Date(session.startedAt).toLocaleDateString(undefined, {
                          day: 'numeric',
                          month: 'short',
                        })}{' '}
                        · {pluralize(session.roundsCompleted, 'round')}
                      </p>
                    </div>
                    <span className="tnum text-muted-foreground shrink-0 text-sm">
                      {formatDuration(session.durationSec)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <p className="text-muted-foreground text-center text-xs">
          <Link className="hover:text-foreground underline" to="/design-system">
            Design system
          </Link>
        </p>
      </div>
    </>
  )
}
