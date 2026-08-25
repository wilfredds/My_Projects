import type { ReactNode } from "react";

type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  children?: ReactNode;
  tone?: "light" | "dark";
};

/** The repeated eyebrow / rule / headline block that opens every section. */
export function SectionHeading({ eyebrow, title, children, tone = "light" }: SectionHeadingProps) {
  const dark = tone === "dark";
  return (
    <div className="max-w-2xl">
      <p
        className={`flex items-center gap-3 text-[0.68rem] font-medium uppercase tracking-[0.24em] ${
          dark ? "text-gold" : "text-lacquer"
        }`}
      >
        {eyebrow}
        <span aria-hidden className="h-px w-10 bg-gold" />
      </p>
      <h2
        className={`mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl ${
          dark ? "text-paper" : "text-sumi"
        }`}
      >
        {title}
      </h2>
      {children ? (
        <p className={`mt-4 text-base leading-relaxed ${dark ? "text-paper/75" : "text-sumi-muted"}`}>
          {children}
        </p>
      ) : null}
    </div>
  );
}
