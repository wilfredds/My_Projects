import { Loader2 } from 'lucide-react'
import { Suspense } from 'react'
import { Link, Route, Routes } from 'react-router-dom'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ScreenFallback } from '@/components/ScreenFallback'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { AuthProvider } from '@/lib/auth/AuthProvider'
import { useAuth } from '@/lib/auth/context'
import { DataProvider } from '@/lib/data/DataProvider'
import { lazyScreen } from '@/lib/lazyScreen'
import { DrillRunPage } from '@/features/train/DrillRunPage'
import { DrillSetupPage } from '@/features/train/DrillSetupPage'
import { ChallengePage } from '@/features/social/ChallengePage'
import { WelcomePage } from '@/features/welcome/WelcomePage'
import { SessionSummaryPage } from '@/features/train/SessionSummaryPage'
import { TrainPage } from '@/features/train/TrainPage'

/*
 * The core loop is above, in the first download: Train, drill setup, the
 * runner and its summary, plus the welcome and the challenge link, because
 * those are the screens somebody arrives on. Everything below loads when it is
 * opened. Nothing on this list may be a screen a drill passes through — see
 * `lib/lazyScreen` for why, and for what keeps these working offline.
 */
const SignInPage = lazyScreen(() => import('@/features/auth/SignInPage'), 'SignInPage')
const BenchmarkPage = lazyScreen(
  () => import('@/features/benchmark/BenchmarkPage'),
  'BenchmarkPage',
)
const BenchmarkResultPage = lazyScreen(
  () => import('@/features/benchmark/BenchmarkResultPage'),
  'BenchmarkResultPage',
)
const BenchmarkRunPage = lazyScreen(
  () => import('@/features/benchmark/BenchmarkRunPage'),
  'BenchmarkRunPage',
)
const DesignSystemPage = lazyScreen(
  () => import('@/features/design-system/DesignSystemPage'),
  'DesignSystemPage',
)
const OnboardingPage = lazyScreen(
  () => import('@/features/onboarding/OnboardingPage'),
  'OnboardingPage',
)
const LibraryEntryPage = lazyScreen(
  () => import('@/features/library/LibraryEntryPage'),
  'LibraryEntryPage',
)
const LibraryPage = lazyScreen(() => import('@/features/library/LibraryPage'), 'LibraryPage')
const ProfilePage = lazyScreen(() => import('@/features/profile/ProfilePage'), 'ProfilePage')
const ProgressPage = lazyScreen(() => import('@/features/progress/ProgressPage'), 'ProgressPage')
const ProgramBuilderPage = lazyScreen(
  () => import('@/features/programs/ProgramBuilderPage'),
  'ProgramBuilderPage',
)
const ProgramDetailPage = lazyScreen(
  () => import('@/features/programs/ProgramDetailPage'),
  'ProgramDetailPage',
)
const ProgramsPage = lazyScreen(() => import('@/features/programs/ProgramsPage'), 'ProgramsPage')
const ReflexRushPage = lazyScreen(() => import('@/features/games/ReflexRushPage'), 'ReflexRushPage')
const PremiumPage = lazyScreen(() => import('@/features/premium/PremiumPage'), 'PremiumPage')
const FocusPage = lazyScreen(() => import('@/features/train/FocusPage'), 'FocusPage')
const WorkoutsPage = lazyScreen(() => import('@/features/workouts/WorkoutsPage'), 'WorkoutsPage')

function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="text-muted-foreground mt-2 text-sm">That route does not exist.</p>
      <Button asChild className="mt-6">
        <Link to="/">Back to Train</Link>
      </Button>
    </div>
  )
}

/**
 * Holds the app back until the session is resolved, so the data layer mounts
 * against the right backend once instead of flipping from local to account and
 * re-fetching everything.
 */
function AppRoutes() {
  const auth = useAuth()

  if (auth.status === 'loading') {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Loader2 className="text-muted-foreground size-6 animate-spin" aria-label="Loading" />
      </div>
    )
  }

  return (
    <DataProvider>
      {/* Only the runners outside the shell ever show this one; the shell has
          its own, so the nav stays put while a screen arrives. */}
      <Suspense fallback={<ScreenFallback fullScreen />}>
        <Routes>
          {/* Full-bleed runners live outside the shell: nothing competes with the
            board while a drill or a test is running. */}
          <Route path="/run/:slug" element={<DrillRunPage />} />
          <Route path="/benchmark/run" element={<BenchmarkRunPage />} />

          {/* The welcome is outside it too. A first-run screen with a bottom nav
            invites people to wander off before it has said anything, and it
            carries its own Skip for anyone who wants out. */}
          <Route path="/welcome" element={<WelcomePage />} />

          <Route element={<AppShell />}>
            <Route path="/" element={<TrainPage />} />
            <Route path="/train/:slug" element={<DrillSetupPage />} />
            <Route path="/focus/:id" element={<FocusPage />} />
            <Route path="/workouts" element={<WorkoutsPage />} />
            <Route path="/play/reflex" element={<ReflexRushPage />} />
            <Route path="/premium" element={<PremiumPage />} />
            <Route path="/challenge" element={<ChallengePage />} />
            <Route path="/challenge/:code" element={<ChallengePage />} />
            <Route path="/session/:id" element={<SessionSummaryPage />} />
            <Route path="/progress" element={<ProgressPage />} />
            <Route path="/benchmark" element={<BenchmarkPage />} />
            <Route path="/benchmark/result/:id" element={<BenchmarkResultPage />} />
            <Route path="/programs" element={<ProgramsPage />} />
            {/* `new` before `:slug` so the builder is not read as a program. */}
            <Route path="/programs/new" element={<ProgramBuilderPage />} />
            <Route path="/programs/:slug" element={<ProgramDetailPage />} />
            <Route path="/programs/:slug/edit" element={<ProgramBuilderPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/library/:kind/:slug" element={<LibraryEntryPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/signin" element={<SignInPage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/design-system" element={<DesignSystemPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </DataProvider>
  )
}

export function App() {
  return (
    <ErrorBoundary>
      {/* The query cache lives in DataProvider, one per signed-in person. */}
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ErrorBoundary>
  )
}
