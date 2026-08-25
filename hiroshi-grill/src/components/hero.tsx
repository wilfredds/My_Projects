import { restaurant } from "@/lib/restaurant";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-sumi text-paper">
      {/* Decorative warmth behind the type — a charcoal glow, drawn with
          gradients rather than an image so there is nothing extra to download. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(60% 55% at 20% 15%, rgba(176,30,36,0.42) 0%, transparent 65%), " +
            "radial-gradient(50% 50% at 85% 80%, rgba(201,162,75,0.28) 0%, transparent 70%)",
        }}
      />

      <div className="relative mx-auto grid w-full max-w-6xl gap-10 px-5 py-20 sm:py-28 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <div>
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-gold/40 px-3.5 py-1 text-[0.68rem] font-medium uppercase tracking-[0.24em] text-gold">
            <span aria-hidden>◆</span>
            {restaurant.address.city}, {restaurant.address.province}
          </p>

          <h1 className="font-display text-5xl leading-[0.95] font-semibold tracking-tight text-paper sm:text-6xl lg:text-7xl">
            Hiroshi
            <span className="block text-gold">Master Grill</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-paper/80">
            {restaurant.tagline} Marinated cuts over a live grill, unlimited banchan, and a
            crew that keeps the plate clean so you never taste last round&apos;s char.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <a
              href="#reserve"
              className="rounded-full bg-lacquer px-6 py-3 text-sm font-semibold text-paper transition-colors hover:bg-lacquer-deep"
            >
              Request a table
            </a>
            <a
              href="#unli"
              className="rounded-full border border-paper/25 px-6 py-3 text-sm font-semibold text-paper transition-colors hover:border-gold hover:text-gold"
            >
              See the unli sets
            </a>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-paper/15 bg-paper/15 sm:grid-cols-3 lg:grid-cols-2">
          {[
            { label: "Unli sets", value: "3" },
            { label: "Dining time", value: "2 hrs" },
            { label: "Cuts on the Master set", value: "10" },
            { label: "Side dishes", value: "Unli" },
          ].map((stat) => (
            <div key={stat.label} className="bg-sumi px-5 py-6">
              <dt className="text-[0.68rem] uppercase tracking-[0.18em] text-paper/55">
                {stat.label}
              </dt>
              <dd className="mt-1.5 font-display text-3xl font-semibold text-gold">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
