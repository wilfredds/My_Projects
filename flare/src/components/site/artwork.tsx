/**
 * Placeholder artwork.
 *
 * The design carries illustrations on every hero — a firefighter, a whale, a
 * mountain scene. Those are the client's own work, held in a Figma file this
 * environment cannot reach, and redrawing them from a screenshot would be both
 * a poor copy and a discourtesy to whoever made them.
 *
 * These stand-ins keep each screen's composition and colour weight so the
 * layout is real, while being obviously abstract rather than a bad imitation.
 * Replace with the exported assets once the file is shared: every hero pulls
 * its art through this one module.
 */

/** Soft layered shapes echoing the design's large arrow motifs. */
export function HeroArtwork({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 300"
      className={`h-full w-full ${className}`}
      aria-hidden="true"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id="hero-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.30" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.04" />
        </linearGradient>
      </defs>
      <g fill="url(#hero-a)">
        <path d="M-20 210 L120 90 L150 120 L30 220 Z" />
        <path d="M90 250 L250 100 L285 135 L140 265 Z" opacity="0.7" />
        <path d="M240 230 L360 120 L392 152 L280 255 Z" opacity="0.5" />
      </g>
      <circle cx="320" cy="70" r="46" fill="#ffffff" opacity="0.10" />
      <circle cx="70" cy="60" r="26" fill="#ffffff" opacity="0.08" />
    </svg>
  );
}

const CATEGORY_ART: Record<string, { fill: string; shapes: React.ReactNode }> = {
  water: {
    fill: "#2a1c86",
    shapes: (
      <>
        <ellipse cx="200" cy="170" rx="120" ry="46" fill="#ffffff" opacity="0.18" />
        <ellipse cx="200" cy="150" rx="80" ry="28" fill="#ffffff" opacity="0.12" />
      </>
    ),
  },
  land: {
    fill: "#c9762a",
    shapes: (
      <>
        <path d="M0 220 L110 110 L200 220 Z" fill="#ffffff" opacity="0.18" />
        <path d="M150 220 L260 100 L400 220 Z" fill="#ffffff" opacity="0.12" />
      </>
    ),
  },
  fire: {
    fill: "#d92d1a",
    shapes: (
      <>
        <path d="M200 60 C250 130 250 190 200 230 C150 190 150 130 200 60 Z" fill="#ffffff" opacity="0.18" />
        <circle cx="200" cy="190" r="34" fill="#ffffff" opacity="0.12" />
      </>
    ),
  },
};

/** A category hero band. Falls back to the generic form for new categories. */
export function CategoryArtwork({ categoryId }: { categoryId: string }) {
  const art = CATEGORY_ART[categoryId];

  return (
    <svg
      viewBox="0 0 400 240"
      className="h-full w-full"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid slice"
    >
      <rect width="400" height="240" fill={art?.fill ?? "#3b2bb8"} />
      {art?.shapes ?? <HeroArtwork />}
    </svg>
  );
}
