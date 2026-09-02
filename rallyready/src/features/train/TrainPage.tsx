import { useQuery } from '@tanstack/react-query'
import {
  Flame,
  Gamepad2,
  GraduationCap,
  Home,
  Play,
  SlidersHorizontal,
  Sparkles,
  X,
  Zap,
} from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'

import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { StaggerItem } from '@/components/motion/StaggerItem'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Segmented } from '@/components/ui/segmented'
import { SkeletonCard } from '@/components/ui/skeleton'
import { useRepositories } from '@/lib/data/context'
import { resolveRecommendation } from '@/lib/data/recommend'
import { shouldSeeWelcome, wasWelcomeShownThisLoad, WELCOME_PATH } from '@/lib/firstRun'
import { isConditioning, isPrepOrRecovery } from '@/lib/data/seed/drills'
import type { Drill, SkillLevel } from '@/lib/data/types'
import { buildLibrary } from '@/lib/library/entries'
import { configFromDrill, estimateDurationSec } from '@/lib/timer/plan'
import { formatCompactDuration, pluralize } from '@/lib/utils'
import { useDrillConfigStore } from '@/store/drillConfigStore'
import { usePremium } from '@/store/premiumStore'
import { useTrainingProfile } from '@/hooks/useTrainingProfile'
import { useUiStore } from '@/store/uiStore'

import { TodayCard } from '../programs/components/TodayCard'
import { CueSettingsDialog } from './components/CueSettingsDialog'
import { DrillCard } from './components/DrillCard'
import { CoachCard } from './components/CoachCard'
import { FocusGrid } from './components/FocusGrid'
import { TrainingProfileBar } from './components/TrainingProfileBar'
import { ReadinessCard } from './components/ReadinessCard'
import { WarmUpBar } from './components/WarmUpBar'
import { CATEGORY_LABEL, LEVEL_LABEL } from './drillLabels'

type Tab = 'drills' | 'conditioning'

export function TrainPage() {
  const repositories = useRepositories()
  const location = useLocation()
  const overrides = useDrillConfigStore((state) => state.overrides)
  const setupDismissed = useUiStore((state) => state.setupPromptDismissed)
  const dismissSetup = useUiStore((state) => state.dismissSetupPrompt)
  const welcomeSeenAt = useUiStore((state) => state.welcomeSeenAt)
  const premium = usePremium()
  const training = useTrainingProfile()
  const [tab, setTab] = useState<Tab>('drills')
  const [homeOnly, setHomeOnly] = useState(false)

  const { data: drills = [], isLoading } = useQuery({
    queryKey: ['drills'],
    queryFn: () => repositories.drills.list(),
  })

  const { data: streak } = useQuery({
    queryKey: ['streak'],
    queryFn: () => repositories.streaks.get(),
  })

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => repositories.profiles.get(),
  })

  const { data: recent = [], isLoading: historyLoading } = useQuery({
    queryKey: ['sessions', 'any'],
    queryFn: () => repositories.sessions.listRecent(1),
  })

  // With a profile the headline drill is chosen for this player; without one it
  // is simply the first in the catalogue.
  const recommendation = profile ? resolveRecommendation(profile, drills) : null
  const featured = recommendation?.drill ?? drills[0]

  // Warm-ups and cool-downs are reached from the bar below the hero, not from
  // the catalogue — they are not something you pick instead of training.
  const trainable = drills.filter((drill) => !isPrepOrRecovery(drill))
  const inTab = trainable.filter((drill) =>
    tab === 'conditioning' ? isConditioning(drill) : !isConditioning(drill),
  )
  const visible = inTab
    .filter((drill) => !homeOnly || drill.location === 'anywhere')
    .filter((drill) => drill.slug !== featured?.slug)
    // A doubles player is not shown the singles-only work and vice versa.
    // Drills for either game stay in both lists, which is most of the
    // catalogue — footwork and conditioning do not care which you play.
    .filter((drill) => drill.discipline === 'both' || drill.discipline === training.discipline)

  // Every duration on this page is the one this player will actually run, not
  // the one the drill was written at.
  const configFor = (drill: Drill) => overrides[drill.slug] ?? configFromDrill(drill, training)

  const library = buildLibrary(drills)
  const browseLevel: SkillLevel = training.level
  // Nothing set up and nothing trained: a real first visit, not a returning
  // player who skipped the questionnaire.
  const isNewHere = !profileLoading && !profile && !historyLoading && recent.length === 0

  /*
   * A genuine first visit gets an introduction, not a catalogue.
   *
   * Rendered as a redirect rather than fired from an effect: an effect runs
   * after paint, so the catalogue would flash up and vanish. Everything that
   * decides this lives in `lib/firstRun` so it can be tested without a router.
   */
  if (
    shouldSeeWelcome({
      loading: profileLoading || historyLoading,
      hasProfile: Boolean(profile),
      hasSessions: recent.length > 0,
      seenWelcome: welcomeSeenAt !== null,
      path: location.pathname,
      redirectedThisLoad: wasWelcomeShownThisLoad(),
    })
  ) {
    return <Navigate to={WELCOME_PATH} replace />
  }

  return (
    <>
      <PageHeader
        title="Train"
        description="Pick a drill and go. Every call is spoken, so you never need to look at the screen."
        action={<CueSettingsDialog />}
      />

      {streak && streak.currentStreak > 0 && (
        <div className="text-muted-foreground mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <Link
            to="/progress"
            className="text-foreground inline-flex items-center gap-1.5 font-medium hover:underline"
          >
            <Flame className="text-primary size-4" aria-hidden />
            {pluralize(streak.currentStreak, 'week')} in a row
          </Link>
          <span>
            {streak.weeklySessionsCount === 0
              ? 'Nothing logged this week yet'
              : `${pluralize(streak.weeklySessionsCount, 'session')} this week`}
          </span>
        </div>
      )}

      {!isNewHere && <TrainingProfileBar />}

      {/*
       * A genuine first visit gets an introduction rather than a catalogue.
       *
       * Someone opening this for the first time does not need a readiness
       * check or a training-load chart; they need to know what the app is for
       * and where to put their first tap. Shown only when there is no profile
       * *and* nothing logged — the moment there is either, it is in the way.
       */}
      {isNewHere && (
        <Card level="lead" className="mb-6">
          <CardContent className="p-5">
            <div className="mb-3 flex items-start gap-3">
              <span className="bg-primary text-primary-foreground grid size-10 shrink-0 place-items-center rounded-xl">
                <GraduationCap className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <h2 className="text-xl font-bold tracking-tight">Welcome to RallyReady</h2>
                <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                  A coach for training on your own. It calls the corners out loud so you never watch
                  the screen, warms you up, tracks what it costs you, and tells you when to back
                  off.
                </p>
              </div>
            </div>
            <p className="text-muted-foreground mb-3 text-sm leading-relaxed">
              <span className="text-foreground font-medium">Never played before?</span> Start with
              the basics — how to hold the racket, how to stand, and the shots everything else is
              built on.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild size="lg" className="sm:flex-1">
                <Link to="/focus/fundamentals">Learn the basics</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="sm:flex-1">
                <Link to="/onboarding">I have played before</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* First on the screen because it is the first decision of the session:
          everything below reads differently once the app knows how you feel. */}
      {!isNewHere && <ReadinessCard />}

      {/* Then the instruction the check-in feeds. */}
      {!isNewHere && <CoachCard />}

      <TodayCard />

      {/*
       * The fallback hero, for anyone the coach is not deciding for.
       *
       * Withheld on a first visit — "Start here: Six-Corner Shadow,
       * Intermediate" under "never played before" is two pieces of advice
       * contradicting each other — and withheld again once Premium is on,
       * because the coach card above has already answered this question and two
       * competing "do this" cards answer it worse than either alone.
       */}
      {featured && !isNewHere && !premium.has('coach') && (
        <Card level="lead" className="mb-6 overflow-hidden">
          <CardContent className="flex flex-col gap-4 p-5">
            <div>
              <Badge variant="accent" className="mb-2">
                <Zap className="size-3" aria-hidden />
                {recommendation ? 'Picked for you' : 'Start here'}
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight text-balance">{featured.name}</h2>
              <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                {recommendation?.reason ?? featured.description}
              </p>
            </div>
            <div className="text-muted-foreground flex flex-wrap gap-2 text-xs">
              <Badge variant="outline">{CATEGORY_LABEL[featured.category]}</Badge>
              <Badge variant="outline">
                {featured.circuit
                  ? pluralize(featured.circuit.length, 'exercise')
                  : `${featured.corners} zones`}
              </Badge>
              <Badge variant="outline">
                {formatCompactDuration(estimateDurationSec(configFor(featured)))}
              </Badge>
              <Badge variant="outline">{LEVEL_LABEL[featured.level]}</Badge>
            </div>
            <div className="flex gap-2">
              <Button asChild size="lg" className="flex-1">
                <Link to={`/run/${featured.slug}`}>
                  <Play className="fill-current" />
                  Start
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to={`/train/${featured.slug}`} aria-label={`Adjust ${featured.name}`}>
                  <SlidersHorizontal />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Directly under the drill you are about to do, because that is the
          moment the advice is relevant. */}
      <WarmUpBar />

      {/* Below the drill it is offering to improve, and dismissible. Above it,
          an unclosable prompt outranked the content it was advertising. */}
      {!profileLoading && !profile && !setupDismissed && !isNewHere && (
        <div className="border-border mb-6 flex items-center gap-3 rounded-xl border border-dashed p-3">
          <Sparkles className="text-primary size-4 shrink-0" aria-hidden />
          <p className="text-muted-foreground min-w-0 flex-1 text-xs leading-relaxed">
            <span className="text-foreground font-medium">Get drills picked for you.</span> Four
            questions, under two minutes.
          </p>
          <Button asChild size="sm" variant="outline" className="shrink-0">
            <Link to="/onboarding">Set up</Link>
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            className="shrink-0"
            onClick={dismissSetup}
            title="Dismiss"
          >
            <X />
            <span className="sr-only">Dismiss this prompt</span>
          </Button>
        </div>
      )}

      {/*
       * Goals rather than a catalogue.
       *
       * A flat list of twelve drills only helps someone who already knows which
       * one fixes their problem — which is nobody new. A player does know what
       * they want to be better at, so the app asks that and does the mapping.
       */}
      {/*
       * Everything above this line is "today", stacked tight. Everything below
       * it is a place to go looking, and gets the room to read as a section of
       * its own. Two spacings, applied consistently, is the whole rhythm.
       */}
      <div className="space-y-10 pt-4">
        <section aria-labelledby="focus">
          <h2 id="focus" className="type-headline mb-1 text-lg">
            What do you want to work on?
          </h2>
          <p className="text-muted-foreground type-body mb-4">
            Pick one and the app shows you what trains it, at your level.
          </p>
          <FocusGrid entries={library} level={browseLevel} />
        </section>

        <Card level="quiet">
          <CardContent className="flex items-center gap-3 p-4">
            <span className="bg-sprint/15 text-sprint grid size-10 shrink-0 place-items-center rounded-xl">
              <Gamepad2 className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Reflex Rush</p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Thirty seconds, tap the corner that lights up. The only part of this app that is
                purely for fun.
              </p>
            </div>
            <Button asChild size="sm" className="shrink-0">
              <Link to="/play/reflex">Play</Link>
            </Button>
          </CardContent>
        </Card>

        <section aria-labelledby="catalogue">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 id="catalogue" className="type-headline text-lg">
                Or browse everything
              </h2>
              <p className="text-muted-foreground text-xs">
                {tab === 'drills'
                  ? 'Corner-calling footwork, called out loud.'
                  : 'Intervals and circuits. Most need no court at all.'}
              </p>
            </div>
            <Button
              variant={homeOnly ? 'default' : 'outline'}
              size="sm"
              className="shrink-0"
              onClick={() => setHomeOnly((current) => !current)}
              aria-pressed={homeOnly}
            >
              <Home />
              No court
            </Button>
          </div>

          <Segmented
            label="Workout type"
            value={tab}
            options={[
              { value: 'drills', label: 'Drills' },
              { value: 'conditioning', label: 'Conditioning' },
            ]}
            onChange={(next) => setTab(next as Tab)}
          />

          <div className="mt-4">
            {isLoading ? (
              // Six card-shaped placeholders rather than a line of text: the
              // catalogue is the tallest thing on this screen, and a one-line
              // "Loading…" makes everything below it jump when the data lands.
              <ul className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 6 }, (_, index) => (
                  <li key={index}>
                    <SkeletonCard />
                  </li>
                ))}
              </ul>
            ) : visible.length === 0 ? (
              <EmptyState
                illustration="court"
                title={homeOnly ? 'Everything left needs a court' : 'Nothing here yet'}
                body={
                  homeOnly
                    ? 'Nothing in this tab works in a hallway. Turn the filter off to see the rest.'
                    : 'This tab is empty at the moment.'
                }
                action={
                  homeOnly ? (
                    <Button variant="outline" onClick={() => setHomeOnly(false)}>
                      Show everything
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {visible.map((drill, index) => (
                  <StaggerItem key={drill.slug} index={index}>
                    <DrillCard drill={drill} config={configFor(drill)} />
                  </StaggerItem>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </>
  )
}
