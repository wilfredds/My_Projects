import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { Link, Route, Routes } from 'react-router-dom'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { AuthProvider } from '@/lib/auth/AuthProvider'
import { useAuth } from '@/lib/auth/context'
import { DataProvider } from '@/lib/data/DataProvider'
import { SignInPage } from '@/features/auth/SignInPage'
import { BenchmarkPage } from '@/features/benchmark/BenchmarkPage'
import { BenchmarkResultPage } from '@/features/benchmark/BenchmarkResultPage'
import { BenchmarkRunPage } from '@/features/benchmark/BenchmarkRunPage'
import { DesignSystemPage } from '@/features/design-system/DesignSystemPage'
import { OnboardingPage } from '@/features/onboarding/OnboardingPage'
import { LibraryEntryPage } from '@/features/library/LibraryEntryPage'
import { LibraryPage } from '@/features/library/LibraryPage'
import { ProfilePage } from '@/features/profile/ProfilePage'
import { ProgressPage } from '@/features/progress/ProgressPage'
import { ProgramBuilderPage } from '@/features/programs/ProgramBuilderPage'
import { ProgramDetailPage } from '@/features/programs/ProgramDetailPage'
import { ProgramsPage } from '@/features/programs/ProgramsPage'
import { DrillRunPage } from '@/features/train/DrillRunPage'
import { DrillSetupPage } from '@/features/train/DrillSetupPage'
import { ReflexRushPage } from '@/features/games/ReflexRushPage'
import { PremiumPage } from '@/features/premium/PremiumPage'
import { ChallengePage } from '@/features/social/ChallengePage'
import { WelcomePage } from '@/features/welcome/WelcomePage'
import { FocusPage } from '@/features/train/FocusPage'
import { WorkoutsPage } from '@/features/workouts/WorkoutsPage'
import { SessionSummaryPage } from '@/features/train/SessionSummaryPage'
import { TrainPage } from '@/features/train/TrainPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Local storage reads are instant and the app must work offline, so
      // retrying a "failed" query buys nothing but a delay.
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
})

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
    </DataProvider>
  )
}

export function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
