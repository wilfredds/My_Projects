import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Play, Swords } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useRepositories } from '@/lib/data/context'
import { decodeChallenge, type Challenge } from '@/lib/social/challenge'
import { configFromDrill } from '@/lib/timer/plan'
import { formatCompactDuration, pluralize } from '@/lib/utils'
import { useChallengeStore } from '@/store/challengeStore'
import { useDrillConfigStore } from '@/store/drillConfigStore'

/**
 * Taking a challenge someone sent you.
 *
 * Free, deliberately and permanently: a social loop that needs both people to
 * be paying is not a loop. Accepting applies the sender's settings and seed to
 * the drill, so the corner order you get is the corner order they got —
 * otherwise "I beat your score" means nothing.
 */
export function ChallengePage() {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const repositories = useRepositories()
  const save = useDrillConfigStore((state) => state.save)
  const accept = useChallengeStore((state) => state.accept)
  const [pasted, setPasted] = useState('')

  const decoded = decodeChallenge(code ? decodeURIComponent(code) : pasted)

  const { data: drill } = useQuery({
    queryKey: ['drill', decoded.ok ? decoded.challenge.drill : null],
    queryFn: () => repositories.drills.getBySlug(decoded.ok ? decoded.challenge.drill : ''),
    enabled: decoded.ok,
  })

  const start = (challenge: Challenge) => {
    if (!drill) return
    // The sender's settings become yours for this run. Saved rather than passed
    // through the URL because the runner reads its config from the store, and a
    // challenge you abandon and come back to should still be the same challenge.
    save(drill.slug, {
      ...configFromDrill(drill),
      rounds: challenge.rounds,
      workSec: challenge.workSec,
      restSec: challenge.restSec,
      intervalMs: challenge.intervalMs,
    })
    accept({ ...challenge, acceptedAt: Date.now() })
    navigate(`/run/${drill.slug}`)
  }

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
        <Link to="/">
          <ArrowLeft />
          Train
        </Link>
      </Button>

      <PageHeader
        title="Challenge"
        description="The exact session someone else did — same drill, same settings, same shuttle order."
      />

      {!code && (
        <Card className="mb-5">
          <CardContent className="p-5">
            <label htmlFor="challenge-code" className="text-sm font-medium">
              Paste a challenge code
            </label>
            {/* The shared Input, not a hand-rolled one: this was 14px text in
                a 38px box, and iOS zooms the whole page in on any field under
                16px — on the one screen somebody is pasting into. */}
            <Input
              id="challenge-code"
              value={pasted}
              onChange={(event) => setPasted(event.target.value)}
              placeholder="1,ABC,G,BN,U,1C8,4M,six-corner-shadow,Wilfred"
              className="mt-2"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
            {pasted.trim() !== '' && !decoded.ok && (
              <p className="text-destructive mt-2 text-xs" role="status">
                {decoded.error}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {code && !decoded.ok && (
        <Card className="mb-5">
          <CardContent className="p-5 text-center">
            <p className="font-medium">That challenge did not open</p>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{decoded.error}</p>
            <Button asChild variant="outline" className="mt-4">
              <Link to="/challenge">Paste a code instead</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {decoded.ok && (
        <Card level="lead">
          <CardContent className="p-5">
            <div className="mb-3 flex items-start gap-3">
              <span className="bg-primary text-primary-foreground grid size-10 shrink-0 place-items-center rounded-xl">
                <Swords className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-muted-foreground text-xs font-medium">
                  {decoded.challenge.from
                    ? `${decoded.challenge.from} challenged you`
                    : 'Someone challenged you'}
                </p>
                <h2 className="text-2xl leading-tight font-bold tracking-tight text-balance">
                  {drill?.name ?? decoded.challenge.drill}
                </h2>
              </div>
            </div>

            {decoded.challenge.target !== null && (
              <p className="mb-3 text-sm leading-relaxed">
                Their score:{' '}
                <span className="font-bold">
                  {pluralize(decoded.challenge.target, 'call')} answered
                </span>
                . Same corner order — no excuses.
              </p>
            )}

            <div className="mb-4 flex flex-wrap gap-2">
              <Badge variant="outline">
                {decoded.challenge.workSec}s / {decoded.challenge.restSec}s ×{' '}
                {decoded.challenge.rounds}
              </Badge>
              <Badge variant="outline">
                {(decoded.challenge.intervalMs / 1000).toFixed(2)}s per call
              </Badge>
              {drill && (
                <Badge variant="outline">
                  {formatCompactDuration(
                    decoded.challenge.rounds *
                      (decoded.challenge.workSec + decoded.challenge.restSec),
                  )}
                </Badge>
              )}
            </div>

            {drill ? (
              <Button size="xl" className="w-full" onClick={() => start(decoded.challenge)}>
                <Play className="fill-current" />
                Take the challenge
              </Button>
            ) : (
              <p className="text-muted-foreground text-sm leading-relaxed">
                That challenge names a drill this version does not have —{' '}
                <span className="font-medium">{decoded.challenge.drill}</span>.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </>
  )
}
