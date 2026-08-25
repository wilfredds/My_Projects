import { houseRules } from "@/lib/menu";

import { SectionHeading } from "./section";

export function HouseRules() {
  return (
    <section id="rules" className="scroll-mt-20 bg-sumi py-20 text-paper sm:py-24">
      <div className="mx-auto w-full max-w-6xl px-5">
        <SectionHeading tone="dark" eyebrow="House Rules" title="The short list, stated up front.">
          Unli works when everyone knows the deal before the first tray lands. Nothing here is a
          surprise charge — it is all on the table, literally.
        </SectionHeading>

        <ol className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-paper/15 bg-paper/15 sm:grid-cols-2 lg:grid-cols-3">
          {houseRules.map((rule, index) => (
            <li key={rule.title} className="bg-sumi p-7">
              <span className="font-display text-sm font-semibold text-gold">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-2 font-display text-xl font-semibold text-paper">{rule.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-paper/70">{rule.detail}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
