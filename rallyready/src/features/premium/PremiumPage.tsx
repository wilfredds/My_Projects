import { ArrowLeft, Check, Info, ShieldCheck, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/PageHeader'
import { useProgramState } from '../programs/useProgramState'
import { CommitmentCard } from './components/CommitmentCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  daysRemaining,
  monthlyRate,
  ALWAYS_FREE,
  BUNDLES,
  COACH_SESSION_PHP,
  GUARANTEES,
  PREMIUM_FEATURES,
  type Bundle,
} from '@/lib/premium/entitlements'
import { cn } from '@/lib/utils'
import { usePremium, usePremiumStore } from '@/store/premiumStore'

/**
 * What Premium is, what it costs, and — stated on the page rather than buried —
 * the fact that no payment provider is connected yet.
 *
 * A screen that looks like a checkout and quietly does nothing is the kind of
 * thing that loses someone's trust permanently. So the buttons here say what
 * they actually do, and the honest note sits above them rather than below.
 */
/**
 * Sessions a week a block is built around when nothing else says otherwise.
 * Three is what the built-in programs assume for a club player, and a block
 * has to ask for *something* or there is nothing to be held to.
 */
const DEFAULT_SESSIONS_PER_WEEK = 3

export function PremiumPage() {
  const premium = usePremium()
  const { program } = useProgramState()
  const unlock = usePremiumStore((state) => state.unlock)
  const cancel = usePremiumStore((state) => state.cancel)
  const [chosen, setChosen] = useState<Bundle>(BUNDLES.find((bundle) => bundle.best) ?? BUNDLES[0]!)

  const left = daysRemaining(premium.expiresAt)

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
        <Link to="/">
          <ArrowLeft />
          Train
        </Link>
      </Button>

      <PageHeader
        title="RallyReady Premium"
        description="The free app is a very good training tool. Premium is the coach on top of it — the part that decides what you do today, and why."
      />

      <CommitmentCard />

      {premium.active && !premium.commitment && (
        <Card level="lead" className="mb-6">
          <CardContent className="flex items-start gap-3 p-5">
            <span className="bg-primary text-primary-foreground grid size-9 shrink-0 place-items-center rounded-xl">
              <Sparkles className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Premium is on</p>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {left === null
                  ? 'Active.'
                  : `${left} ${left === 1 ? 'day' : 'days'} left on your ${premium.bundleId} bundle.`}
              </p>
              <Button variant="ghost" size="sm" className="mt-2 -ml-2" onClick={cancel}>
                Turn it off
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* The honest bit, above the prices rather than under them. */}
      <Card className="mb-6">
        <CardContent className="flex items-start gap-3 p-4">
          <Info className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
          <p className="text-muted-foreground text-xs leading-relaxed">
            <span className="text-foreground font-medium">No payments are connected yet.</span>{' '}
            Nothing on this page charges you, and the button below simply switches Premium on
            locally so you can try it. Taking real money needs a payment provider — GCash, Maya or a
            card processor — and a server that checks the receipt, because an unlock stored in a
            browser can be switched on by anyone who knows how.
          </p>
        </CardContent>
      </Card>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">What Premium adds</h2>
        <ul className="space-y-3">
          {PREMIUM_FEATURES.map((feature) => (
            <li key={feature.id}>
              <Card>
                <CardContent className="flex gap-3 p-4">
                  <span className="bg-primary/15 text-primary mt-0.5 grid size-6 shrink-0 place-items-center rounded-full">
                    <Check className="size-3.5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{feature.name}</p>
                    <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                      {feature.blurb}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-1 text-lg font-semibold tracking-tight">Pick a bundle</h2>
        <p className="text-muted-foreground mb-4 text-sm leading-relaxed">
          One coaching session near you runs about ₱{COACH_SESSION_PHP}. A year of this costs less
          than one of those.
        </p>

        <div className="mb-4 grid gap-3">
          {BUNDLES.map((bundle) => {
            const selected = chosen.id === bundle.id
            return (
              <button
                key={bundle.id}
                type="button"
                onClick={() => setChosen(bundle)}
                aria-pressed={selected}
                className={cn(
                  'focus-visible:ring-ring rounded-xl border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none',
                  selected
                    ? 'border-primary bg-accent/50'
                    : 'border-border bg-card hover:border-primary/40',
                )}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold">{bundle.name}</span>
                  <span className="tnum text-xl font-bold tracking-tight">₱{bundle.pricePhp}</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <span className="text-muted-foreground text-xs leading-relaxed">
                    {bundle.blurb}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs font-medium">
                    ₱{monthlyRate(bundle)}/mo
                  </span>
                </div>
                {bundle.best && (
                  <Badge variant="accent" className="mt-2">
                    Best value
                  </Badge>
                )}
              </button>
            )
          })}
        </div>

        <Button
          size="xl"
          className="w-full"
          onClick={() =>
            unlock(chosen, 'preview', program?.sessionsPerWeek ?? DEFAULT_SESSIONS_PER_WEEK)
          }
          disabled={premium.active}
        >
          {/* Buttons are `whitespace-nowrap`, and this label is long enough to
              push a 375px screen sideways. The bundle is already named and
              highlighted directly above; repeating it here cost a working
              layout. */}
          {premium.active ? 'Premium already on' : 'Switch Premium on — free preview'}
        </Button>
        <p className="text-muted-foreground mt-2 text-center text-xs">
          No card, no charge. This is a preview of the paid tier.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="type-headline mb-1 text-lg">What we owe you</h2>
        <p className="text-muted-foreground type-body mb-3">
          Three promises, each one enforced by code rather than by good intentions.
        </p>
        <ul className="space-y-3">
          {GUARANTEES.map((guarantee) => (
            <li key={guarantee.title}>
              <Card>
                <CardContent className="flex gap-3 p-4">
                  <ShieldCheck className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{guarantee.title}</p>
                    <p className="text-muted-foreground type-meta mt-0.5 leading-relaxed">
                      {guarantee.body}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="type-headline mb-1 text-lg">Free, for ever</h2>
        <p className="text-muted-foreground mb-3 text-sm leading-relaxed">
          None of this ever goes behind the paywall. Nothing that keeps you uninjured should cost
          money.
        </p>
        <ul className="space-y-2">
          {ALWAYS_FREE.map((item) => (
            <li key={item} className="text-muted-foreground flex gap-2.5 text-sm leading-snug">
              <Check className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
