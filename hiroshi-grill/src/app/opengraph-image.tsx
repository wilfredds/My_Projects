import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

import { restaurant } from "@/lib/restaurant";

/**
 * The picture that shows up when someone shares the site.
 *
 * On Facebook and Messenger — which is where a restaurant in Cavite is actually
 * shared — this image is the whole first impression. Without one, the link
 * renders as a grey box, and a grey box does not sell unli samgyupsal.
 *
 * Generated rather than designed in Figma so it can never drift from the
 * content: change the restaurant name in `restaurant.ts` and the social card
 * follows.
 */

export const alt = `${restaurant.name} — ${restaurant.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/* Brand tokens, repeated here because Satori renders this with inline styles
   and never sees globals.css. Keep them in step with `@theme` there. */
const PAPER = "#FBF6EF";
const LACQUER = "#B01E24";
const SUMI = "#17130F";
const GOLD = "#C9A24B";

/**
 * Read from disk, not the network — see src/assets/README.md.
 *
 * Returns null rather than throwing if the file is not there. A missing font is
 * a reason for the card to look plainer, never a reason for the route to answer
 * 500 — a broken image is how a shared link turns back into a grey box, which
 * is the exact thing this route exists to prevent.
 */
async function loadFraunces(): Promise<Buffer | null> {
  try {
    return await readFile(path.join(process.cwd(), "src/assets/Fraunces-SemiBold.ttf"));
  } catch (error) {
    console.error("[og] Fraunces not found, falling back to the default font:", error);
    return null;
  }
}

export default async function OpengraphImage() {
  const fraunces = await loadFraunces();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: SUMI,
          padding: 72,
          /* The same charcoal glow as the hero, so the card and the page it
             links to look like the same restaurant. */
          backgroundImage:
            `radial-gradient(60% 55% at 18% 12%, rgba(176,30,36,0.45) 0%, transparent 62%),` +
            `radial-gradient(52% 52% at 86% 88%, rgba(201,162,75,0.30) 0%, transparent 68%)`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 44, height: 3, background: GOLD }} />
          {/* Satori requires an explicit display on any element with more
              than one child, and `{city}, {province}` is three. */}
          <div
            style={{
              display: "flex",
              color: GOLD,
              fontSize: 24,
              letterSpacing: 6,
              textTransform: "uppercase",
            }}
          >
            {`${restaurant.address.city}, ${restaurant.address.province}`}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontFamily: "Fraunces",
              fontSize: 132,
              lineHeight: 1,
              color: PAPER,
            }}
          >
            Hiroshi
          </div>
          <div
            style={{
              fontFamily: "Fraunces",
              fontSize: 132,
              lineHeight: 1,
              color: GOLD,
            }}
          >
            Master Grill
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ color: "rgba(251,246,239,0.82)", fontSize: 34, maxWidth: 720 }}>
            {restaurant.tagline}
          </div>
          <div
            style={{
              display: "flex",
              background: LACQUER,
              color: PAPER,
              fontSize: 26,
              padding: "16px 30px",
              borderRadius: 999,
            }}
          >
            Reserve a table
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      /* The key is OMITTED when the font is missing, not set to []. Satori
         throws "No fonts are loaded" on an empty array — so the fallback that
         was supposed to keep this route alive would have killed it instead.
         With no `fonts` key at all it uses its own default, which is the
         behaviour intended here. */
      ...(fraunces
        ? {
            fonts: [
              { name: "Fraunces", data: fraunces, style: "normal" as const, weight: 600 as const },
            ],
          }
        : {}),
    },
  );
}
