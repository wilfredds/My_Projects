import { formatPeso } from "@/lib/format";
import { alaCarteSections } from "@/lib/menu";

import { SectionHeading } from "./section";

export function AlaCarteMenu() {
  return (
    <section id="menu" className="scroll-mt-20 border-b border-paper-edge/70 bg-paper-warm/60 py-20 sm:py-24">
      <div className="mx-auto w-full max-w-6xl px-5">
        <SectionHeading eyebrow="Rice & Ramen" title="Not in the mood for unli?">
          A short à la carte menu for lighter appetites, solo diners and take-out. No time limit on
          these.
        </SectionHeading>

        <div className="mt-12 grid gap-10 lg:grid-cols-3">
          {alaCarteSections.map((section) => (
            <div key={section.id}>
              <h3 className="font-display text-2xl font-semibold text-sumi">{section.title}</h3>
              <p className="mt-1.5 text-sm text-sumi-muted">{section.caption}</p>

              <ul className="mt-6 space-y-4">
                {section.items.map((item) => (
                  <li key={item.name} className="border-b border-paper-edge pb-4 last:border-0">
                    <div className="flex items-baseline gap-3">
                      <span className="font-medium text-sumi">{item.name}</span>
                      {/* The dotted leader between name and price — a menu
                          convention, purely decorative, hidden from readers. */}
                      <span aria-hidden className="h-px grow border-b border-dotted border-sumi/25" />
                      <span className="font-display font-semibold text-lacquer">
                        {formatPeso(item.price)}
                      </span>
                    </div>
                    {item.note ? (
                      <p className="mt-1 text-sm text-sumi-muted">{item.note}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
