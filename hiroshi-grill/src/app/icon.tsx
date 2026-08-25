import { ImageResponse } from "next/og";

/**
 * The favicon: a lacquer-red tile with a gold H.
 *
 * Generated rather than a committed .ico so there is one fewer binary to keep
 * in step with the brand colours, and so it stays crisp at any size a browser
 * asks for.
 */

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#B01E24",
          color: "#C9A24B",
          fontSize: 24,
          fontWeight: 700,
          /* No custom font here on purpose — at 32px the letterform barely
             matters, and it saves loading a typeface to draw one glyph. */
          fontFamily: "serif",
          borderRadius: 6,
        }}
      >
        H
      </div>
    ),
    size,
  );
}
