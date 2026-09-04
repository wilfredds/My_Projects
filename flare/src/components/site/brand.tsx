/**
 * The FLARE mark.
 *
 * PLACEHOLDER ARTWORK. The client's real logo is an illustrated mark in their
 * Figma file, which this environment cannot reach. What follows is a plain
 * geometric stand-in, deliberately not an imitation of their design — guessing
 * at somebody's logo from a screenshot produces a worse copy of work they
 * already paid for. Swap in the exported SVG once the file is shared; nothing
 * else needs to change, because every screen renders the mark through here.
 */
export function FlareMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      role="img"
      aria-label="FLARE"
      className="shrink-0"
    >
      {/* Four tapering strokes from a centre point — a neutral spark form. */}
      {[0, 90, 180, 270].map((angle) => (
        <path
          key={angle}
          d="M12 12 L12 2.5"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          transform={`rotate(${angle} 12 12)`}
        />
      ))}
      {[45, 135, 225, 315].map((angle) => (
        <path
          key={angle}
          d="M12 12 L12 6"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.75"
          transform={`rotate(${angle} 12 12)`}
        />
      ))}
    </svg>
  );
}

/** Wordmark plus the tagline the design pairs with it. */
export function FlareWordmark({
  size = "md",
  tagline = false,
}: {
  size?: "sm" | "md" | "lg";
  tagline?: boolean;
}) {
  const type = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-5xl sm:text-6xl",
  }[size];

  const mark = { sm: 20, md: 26, lg: 52 }[size];

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-2">
        <FlareMark size={mark} />
        <span className={`${type} font-extrabold tracking-[0.18em]`}>FLARE</span>
      </div>
      {tagline && (
        <p className="text-center text-[0.6rem] tracking-[0.14em] opacity-80 sm:text-xs">
          FIREFIGHTERS&rsquo; LEARNING AND RESOURCES EXCHANGE
        </p>
      )}
    </div>
  );
}
