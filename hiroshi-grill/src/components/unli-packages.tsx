import { formatPeso } from "@/lib/format";
import { unliPackages } from "@/lib/menu";

import { SectionHeading } from "./section";

export function UnliPackages() {
  return (
    <section id="unli" className="scroll-mt-20 border-b border-paper-edge/70 py-20 sm:py-24">
      <div className="mx-auto w-full max-w-6xl px-5">
        <SectionHeading eyebrow="Unlimited" title="Pick your set, then keep going.">
          One price per person, refilled as often as you like within your two hours. Every set
          comes with unlimited banchan, rice, egg roll and soup.
        </SectionHeading>

        <ul className="mt-12 grid gap-6 lg:grid-cols-3">
          {unliPackages.map((pkg) => (
            <li
              key={pkg.id}
              className={`flex flex-col rounded-2xl border p-7 transition-shadow hover:shadow-lg hover:shadow-sumi/5 ${
                pkg.featured
                  ? "border-lacquer/35 bg-paper-warm ring-1 ring-lacquer/10"
                  : "border-paper-edge bg-white/45"
              }`}
            >
              {pkg.featured ? (
                <span className="mb-4 w-fit rounded-full bg-lacquer px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-paper">
                  House favourite
                </span>
              ) : null}

              <h3 className="font-display text-2xl font-semibold text-sumi">{pkg.name}</h3>

              <p className="mt-2 flex items-baseline gap-1.5">
                <span className="font-display text-4xl font-semibold text-lacquer">
                  {formatPeso(pkg.price)}
                </span>
                <span className="text-sm text-sumi-muted">/ person</span>
              </p>

              <p className="mt-3 text-sm leading-relaxed text-sumi-muted">{pkg.blurb}</p>

              <ul className="mt-6 space-y-2.5 border-t border-paper-edge pt-6 text-sm text-sumi-soft">
                {pkg.includes.map((line) => (
                  <li key={line} className="flex gap-2.5">
                    <span aria-hidden className="mt-[0.4rem] size-1.5 shrink-0 rounded-full bg-gold" />
                    {line}
                  </li>
                ))}
              </ul>

              <a
                href="#reserve"
                className={`mt-7 rounded-full px-5 py-2.5 text-center text-sm font-semibold transition-colors ${
                  pkg.featured
                    ? "bg-lacquer text-paper hover:bg-lacquer-deep"
                    : "border border-sumi/20 text-sumi hover:border-lacquer hover:text-lacquer"
                }`}
              >
                Reserve for {pkg.name}
              </a>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-sm text-sumi-muted">
          Prices are per person and exclude drinks. Kids under 4 ft dine free with a paying adult.
        </p>
      </div>
    </section>
  );
}
