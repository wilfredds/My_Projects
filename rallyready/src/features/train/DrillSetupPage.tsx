import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  ChevronRight,
  Lightbulb,
  Play,
  RotateCcw,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Segmented } from '@/components/ui/segmented'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { useRepositories } from '@/lib/data/context'
import { topicsForDrill } from '@/lib/data/seed/technique'
import { cornerIdsForLayout, type CornerId, type CourtLayout } from '@/lib/timer/corners'
import {
  configFromDrill,
  DIFFICULTY_PRESETS,
  estimateDurationSec,
  INTERVAL_STEP_MS,
  MAX_INTERVAL_MS,
  MIN_INTERVAL_MS,
  STRUCTURE_PRESETS,
  isCircuit,
  matchDifficulty,
  matchStructure,
  type DrillConfig,
} from '@/lib/timer/plan'
import type { DrillMode } from '@/lib/timer/types'
import { formatCompactDuration } from '@/lib/utils'
import { useTrainingProfile } from '@/hooks/useTrainingProfile'
import { useDrillConfigStore } from '@/store/drillConfigStore'

import { CircuitEditor } from '@/features/conditioning/components/CircuitEditor'

import { CornerPicker } from './components/CornerPicker'
import { CueSettingsDialog } from './components/CueSettingsDialog'
import { RallyPatternList } from './components/RallyPatternList'
import { SessionShape } from './components/SessionShape'

const MODE_OPTIONS: { value: DrillMode; label: string; hint: string }[] = [
  { value: 'sequential', label: 'Sequential', hint: 'Fixed order — learn the pattern' },
  { value: 'random', label: 'Random', hint: 'Unpredictable — test the pattern' },
  { value: 'deception', label: 'Deception', hint: 'A fake, then the real corner' },
  { value: 'number', label: 'Number', hint: 'Zones called by number' },
  { value: 'weighted', label: 'Weighted', hint: 'Target a weak corner more often' },
  { value: 'stroke', label: 'Strokes', hint: 'The corner and the shot to play there' },
  { value: 'pattern', label: 'Rallies', hint: 'A whole point, shot by shot' },
]

const LAYOUT_OPTIONS: { value: string; label: string; hint: string }[] = [
  { value: '4', label: '4 zones', hint: 'Net + rear' },
  { value: '6', label: '6 zones', hint: 'Classic six-corner' },
  { value: '8', label: '8 zones', hint: 'Adds the centres' },
]

const WEIGHT_CYCLE = [1, 2, 3, 5]

export function DrillSetupPage() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const repositories = useRepositories()
  const save = useDrillConfigStore((state) => state.save)
  const clear = useDrillConfigStore((state) => state.clear)
  const stored = useDrillConfigStore((state) => state.overrides[slug])
  const training = useTrainingProfile()

  const { data: drill, isLoading } = useQuery({
    queryKey: ['drill', slug],
    queryFn: () => repositories.drills.getBySlug(slug),
  })

  // The editor's working copy. Derived during render rather than seeded by an
  // effect: switching drills swaps the draft on the same pass, with no flash of
  // the previous drill's settings.
  const [draft, setDraft] = useState<{ slug: string; config: DrillConfig } | null>(null)
  const config: DrillConfig | null =
    draft?.slug === slug
      ? draft.config
      : drill
        ? (stored ?? configFromDrill(drill, training))
        : null

  // Persist as the user edits: leaving the screen must not lose the setup.
  useEffect(() => {
    if (config && drill) save(drill.slug, config)
  }, [config, drill, save])

  if (isLoading || !config) {
    return <p className="text-muted-foreground text-sm">Loading…</p>
  }

  if (!drill) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Drill not found</h1>
        <Button asChild>
          <Link to="/">Back to Train</Link>
        </Button>
      </div>
    )
  }

  const update = (patch: Partial<DrillConfig>) =>
    setDraft({ slug, config: { ...config, ...patch } })

  const setLayout = (layout: CourtLayout) => {
    // Choosing "8 zones" should give you eight targets. Carrying the previous
    // selection over leaves new zones mysteriously switched off.
    update({ layout, enabledCorners: cornerIdsForLayout(layout) })
  }

  const toggleCorner = (corner: CornerId) => {
    const next = config.enabledCorners.includes(corner)
      ? config.enabledCorners.filter((id) => id !== corner)
      : [...config.enabledCorners, corner]
    // Refuse to leave the caller with nothing to call.
    if (next.length === 0) return
    update({ enabledCorners: next })
  }

  const cycleWeight = (corner: CornerId) => {
    const current = config.weights[corner] ?? 1
    const index = WEIGHT_CYCLE.indexOf(current)
    const next = WEIGHT_CYCLE[(index + 1) % WEIGHT_CYCLE.length] ?? 1
    update({ weights: { ...config.weights, [corner]: next } })
  }

  const circuit = isCircuit(config)
  const difficulty = matchDifficulty(config)
  const structure = matchStructure(config)
  const durationSec = estimateDurationSec(config)

  return (
    <>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Button asChild variant="ghost" size="sm" className="-ml-3 mb-1">
            <Link to="/">
              <ArrowLeft />
              Train
            </Link>
          </Button>
          <h1 className="type-display text-3xl text-balance">{drill.name}</h1>
          <p className="text-muted-foreground type-body mt-2">{drill.description}</p>
        </div>
        <CueSettingsDialog />
      </div>

      <div className="space-y-5">
        {/* First, above every control: what you are about to do, to scale and
            in the colours the runner is about to use. */}
        <Card level="quiet">
          <CardContent className="p-4">
            <SessionShape config={config} />
          </CardContent>
        </Card>

        {circuit && <CircuitEditor drill={drill} config={config} onChange={update} />}

        {!circuit && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Caller</CardTitle>
                <CardDescription>How the next corner gets chosen.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <Segmented
                  label="Drill mode"
                  layout="stacked"
                  value={config.mode}
                  options={MODE_OPTIONS}
                  onChange={(mode) => update({ mode })}
                />

                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Label htmlFor="no-repeat">Never call the same zone twice</Label>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Off is harder — a repeat means you have to reset without moving.
                    </p>
                  </div>
                  <Switch
                    id="no-repeat"
                    checked={config.avoidImmediateRepeat}
                    onCheckedChange={(value) => update({ avoidImmediateRepeat: value })}
                  />
                </div>

                {config.mode === 'pattern' && (
                  <div>
                    <p className="mb-3 text-sm font-medium">
                      {config.patterns.length} {config.patterns.length === 1 ? 'rally' : 'rallies'}{' '}
                      in this session
                    </p>
                    <RallyPatternList ids={config.patterns} />
                    <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
                      Rallies are picked at random and played through in order. The zones are set by
                      the pattern, so the court below is only a reference here.
                    </p>
                  </div>
                )}

                {config.mode === 'deception' && (
                  <div>
                    <div className="mb-2 flex items-baseline justify-between">
                      <Label htmlFor="deception-rate">Fake calls</Label>
                      <span className="tnum text-muted-foreground text-sm">
                        {Math.round(config.deceptionProbability * 100)}% of calls
                      </span>
                    </div>
                    <Slider
                      id="deception-rate"
                      min={0.1}
                      max={1}
                      step={0.05}
                      value={[config.deceptionProbability]}
                      onValueChange={([value]) => update({ deceptionProbability: value ?? 0.35 })}
                      aria-label="Share of calls that start with a fake"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Court</CardTitle>
                <CardDescription>
                  {config.mode === 'weighted'
                    ? 'Tap a zone to switch it off; tap an active zone to raise how often it is called.'
                    : 'Tap a zone to switch it off.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <Segmented
                  label="Number of zones"
                  layout="stacked"
                  columns={3}
                  value={String(config.layout)}
                  options={LAYOUT_OPTIONS}
                  onChange={(value) => setLayout(Number(value) as CourtLayout)}
                />
                <div className="mx-auto h-64 w-full max-w-[15rem]">
                  <CornerPicker
                    layout={config.layout}
                    enabled={config.enabledCorners}
                    weights={config.weights}
                    showWeights={config.mode === 'weighted'}
                    onToggle={toggleCorner}
                    onCycleWeight={cycleWeight}
                  />
                </div>
                <p className="text-muted-foreground text-center text-xs">
                  {config.enabledCorners.length} of {config.layout} zones active
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pace</CardTitle>
                <CardDescription>
                  How fast the calls come, and how random the caller is.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <div className="mb-2 flex items-baseline justify-between">
                    <Label htmlFor="interval">Shot interval</Label>
                    <span className="tnum text-muted-foreground text-sm">
                      {(config.intervalMs / 1000).toFixed(2)}s ·{' '}
                      {Math.round(60_000 / config.intervalMs)} calls/min
                    </span>
                  </div>
                  <Slider
                    id="interval"
                    min={MIN_INTERVAL_MS}
                    max={MAX_INTERVAL_MS}
                    step={INTERVAL_STEP_MS}
                    value={[config.intervalMs]}
                    onValueChange={([value]) => update({ intervalMs: value ?? 1400 })}
                    aria-label="Seconds between calls"
                  />
                </div>

                <div>
                  <Label className="mb-2 block">Difficulty preset</Label>
                  <Segmented
                    label="Difficulty preset"
                    layout="stacked"
                    columns={3}
                    value={difficulty?.id ?? 'custom'}
                    options={[
                      ...DIFFICULTY_PRESETS.map((preset) => ({
                        value: preset.id,
                        label: preset.label,
                        hint: `${(preset.intervalMs / 1000).toFixed(2)}s`,
                      })),
                      { value: 'custom', label: 'Custom', hint: 'Your own pace' },
                    ]}
                    onChange={(id) => {
                      const preset = DIFFICULTY_PRESETS.find((p) => p.id === id)
                      if (!preset) return
                      update({
                        intervalMs: preset.intervalMs,
                        avoidImmediateRepeat: preset.avoidImmediateRepeat,
                        deceptionProbability: preset.deceptionProbability,
                      })
                    }}
                  />
                  {difficulty && (
                    <p className="text-muted-foreground mt-2 text-xs">{difficulty.description}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Structure</CardTitle>
                <CardDescription>
                  Work and rest blocks. The default mirrors real singles: about six seconds of rally
                  against twelve of recovery.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <Segmented
                  label="Structure preset"
                  layout="stacked"
                  value={structure?.id ?? 'custom'}
                  options={[
                    ...STRUCTURE_PRESETS.map((preset) => ({
                      value: preset.id,
                      label: preset.label,
                      hint: `${preset.workSec}s / ${preset.restSec}s × ${preset.rounds}`,
                    })),
                    { value: 'custom', label: 'Custom', hint: 'Set it yourself' },
                  ]}
                  onChange={(id) => {
                    const preset = STRUCTURE_PRESETS.find((p) => p.id === id)
                    if (!preset) return
                    update({
                      workSec: preset.workSec,
                      restSec: preset.restSec,
                      rounds: preset.rounds,
                    })
                  }}
                />

                <NumberSlider
                  id="work"
                  label="Work"
                  value={config.workSec}
                  min={5}
                  max={120}
                  step={1}
                  suffix="s"
                  onChange={(workSec) => update({ workSec })}
                />
                <NumberSlider
                  id="rest"
                  label="Rest"
                  value={config.restSec}
                  min={0}
                  max={180}
                  step={5}
                  suffix="s"
                  onChange={(restSec) => update({ restSec })}
                />
                <NumberSlider
                  id="rounds"
                  label="Rounds"
                  value={config.rounds}
                  min={1}
                  max={30}
                  step={1}
                  onChange={(rounds) => update({ rounds })}
                />

                <div className="border-border grid gap-5 border-t pt-5 sm:grid-cols-2">
                  <NumberSlider
                    id="warmup"
                    label="Warm-up"
                    value={config.warmupSec}
                    min={0}
                    max={300}
                    step={15}
                    suffix="s"
                    onChange={(warmupSec) => update({ warmupSec })}
                  />
                  <NumberSlider
                    id="cooldown"
                    label="Cool-down"
                    value={config.cooldownSec}
                    min={0}
                    max={300}
                    step={15}
                    suffix="s"
                    onChange={(cooldownSec) => update({ cooldownSec })}
                  />
                </div>

                <div className="border-border border-t pt-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <Label htmlFor="sprint">Finish with a sprint set</Label>
                      <p className="text-muted-foreground mt-1 text-xs">
                        Four short, faster blocks after the main work — where the session is won.
                      </p>
                    </div>
                    <Switch
                      id="sprint"
                      checked={config.sprint !== null}
                      onCheckedChange={(value) =>
                        update({
                          sprint: value
                            ? {
                                rounds: 4,
                                workSec: 10,
                                restSec: 20,
                                intervalMs: Math.max(MIN_INTERVAL_MS, config.intervalMs - 200),
                              }
                            : null,
                        })
                      }
                    />
                  </div>
                  {config.sprint && (
                    <p className="text-muted-foreground tnum mt-3 text-xs">
                      {config.sprint.rounds} × {config.sprint.workSec}s at{' '}
                      {(config.sprint.intervalMs / 1000).toFixed(2)}s per call,{' '}
                      {config.sprint.restSec}s rest
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* §1.4 — the technique lives with the drill, so you never leave to learn it. */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="text-primary size-4" aria-hidden />
              Coaching cues
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2.5 text-sm leading-relaxed">
              {drill.coachingCues.map((cue) => (
                <li key={cue} className="flex gap-2.5">
                  <span className="bg-primary mt-[0.4375rem] size-1.5 shrink-0 rounded-full" />
                  {cue}
                </li>
              ))}
            </ul>
            {drill.commonFaults.length > 0 && (
              <div className="border-border border-t pt-4">
                <p className="mb-2.5 flex items-center gap-2 text-sm font-semibold">
                  <AlertTriangle className="text-sprint size-4" aria-hidden />
                  Common faults
                </p>
                <ul className="text-muted-foreground space-y-2 text-sm leading-relaxed">
                  {drill.commonFaults.map((fault) => (
                    <li key={fault} className="flex gap-2.5">
                      <span className="bg-sprint/60 mt-[0.4375rem] size-1.5 shrink-0 rounded-full" />
                      {fault}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* §1.4 again — the cues above are the summary; this is where the
            technique behind them is actually explained. */}
        {topicsForDrill(drill.slug).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="text-primary size-4" aria-hidden />
                Learn the technique
              </CardTitle>
              <CardDescription>The reference behind this drill, in a few minutes.</CardDescription>
            </CardHeader>
            <CardContent className="p-0 pb-2">
              <ul className="divide-border divide-y">
                {/* Three at most. Half the catalogue touches a four-corner
                    drill somehow, and a list that long stops being a pointer. */}
                {topicsForDrill(drill.slug)
                  .slice(0, 3)
                  .map((topic) => (
                    <li key={topic.slug}>
                      <Link
                        to={`/library/technique/${topic.slug}`}
                        className="hover:bg-secondary/50 focus-visible:ring-ring flex items-center gap-3 px-5 py-3 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold">{topic.title}</span>
                          <span className="text-muted-foreground block text-xs">
                            {topic.readMinutes} min read
                          </span>
                        </span>
                        <ChevronRight
                          className="text-muted-foreground size-4 shrink-0"
                          aria-hidden
                        />
                      </Link>
                    </li>
                  ))}
              </ul>
              <Button asChild variant="ghost" size="sm" className="mx-2 mt-1">
                <Link to={`/library/drill/${drill.slug}`}>
                  All the reference for this drill
                  <ChevronRight />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              clear(drill.slug)
              setDraft({ slug, config: configFromDrill(drill, training) })
            }}
          >
            <RotateCcw />
            Reset to defaults
          </Button>
          <Badge variant="outline">{formatCompactDuration(durationSec)} total</Badge>
        </div>
      </div>

      {/* Sticky so Start is always a thumb away, however far you have scrolled.
          Sits flush on top of the bottom nav on mobile. */}
      <div className="bg-background/90 sticky bottom-[calc(3.25rem+env(safe-area-inset-bottom,0px))] z-30 -mx-4 mt-6 border-t px-4 py-3 backdrop-blur md:bottom-0">
        <Button size="xl" className="w-full" onClick={() => navigate(`/run/${drill.slug}`)}>
          <Play className="fill-current" />
          Start drill
        </Button>
      </div>
    </>
  )
}

interface NumberSliderProps {
  id: string
  label: string
  value: number
  min: number
  max: number
  step: number
  suffix?: string
  onChange: (value: number) => void
}

function NumberSlider({
  id,
  label,
  value,
  min,
  max,
  step,
  suffix = '',
  onChange,
}: NumberSliderProps) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <Label htmlFor={id}>{label}</Label>
        <span className="tnum text-muted-foreground text-sm">
          {value}
          {suffix}
        </span>
      </div>
      <Slider
        id={id}
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([next]) => onChange(next ?? value)}
        aria-label={label}
      />
    </div>
  )
}
