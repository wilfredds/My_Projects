// Turning a pasted video link into an embed URL FLARE is willing to frame.
//
// This is a security boundary, not a convenience. Whatever comes out of here
// ends up as an <iframe src>, so passing the author's string through would let
// anyone with an authoring account frame arbitrary content — a credential
// prompt styled like FLARE, say — inside a trusted government training portal.
// So nothing is passed through: the provider and id are extracted, validated,
// and a canonical URL is rebuilt from scratch. An input that does not parse is
// refused rather than "cleaned".
//
// Relative imports with extensions: `node --test` runs this file directly.
import type { LessonVideo } from "../types.ts";

export type VideoParseResult =
  | { ok: true; value: Extract<LessonVideo, { kind: "embed" }> }
  | { ok: false; error: string };

/** Exact hostnames. A suffix check would accept youtube.com.attacker.example. */
const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "www.youtu.be",
]);

const VIMEO_HOSTS = new Set(["vimeo.com", "www.vimeo.com", "player.vimeo.com"]);

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^\d{6,12}$/;

export function parseVideoUrl(input: unknown): VideoParseResult {
  if (typeof input !== "string" || !input.trim()) {
    return { ok: false, error: "Paste a YouTube or Vimeo link." };
  }

  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return { ok: false, error: "That is not a valid link." };
  }

  // Rules out javascript:, data: and file: before anything else looks at it.
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, error: "Only https links are accepted." };
  }

  const host = url.hostname.toLowerCase();

  if (YOUTUBE_HOSTS.has(host)) {
    const id = youtubeId(url, host);
    if (!id) return { ok: false, error: "That YouTube link has no video id in it." };

    return {
      ok: true,
      value: {
        kind: "embed",
        provider: "youtube",
        // youtube-nocookie, deliberately. FLARE's Privacy Notice enumerates
        // what the platform collects and does not disclose third-party
        // advertising cookies being set on BFP personnel; the nocookie host
        // avoids them until a viewer actually plays the video.
        embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
        sourceUrl: url.toString(),
      },
    };
  }

  if (VIMEO_HOSTS.has(host)) {
    const id = vimeoId(url);
    if (!id) return { ok: false, error: "That Vimeo link has no video id in it." };

    return {
      ok: true,
      value: {
        kind: "embed",
        provider: "vimeo",
        // dnt=1 asks Vimeo not to track the viewer, for the same reason.
        embedUrl: `https://player.vimeo.com/video/${id}?dnt=1`,
        sourceUrl: url.toString(),
      },
    };
  }

  return { ok: false, error: "Only YouTube and Vimeo links can be embedded." };
}

function youtubeId(url: URL, host: string): string | null {
  // youtu.be/<id>
  if (host === "youtu.be" || host === "www.youtu.be") {
    return check(url.pathname.split("/")[1], YOUTUBE_ID);
  }

  // youtube.com/watch?v=<id>
  const fromQuery = url.searchParams.get("v");
  if (fromQuery) return check(fromQuery, YOUTUBE_ID);

  // youtube.com/embed/<id> and /shorts/<id>
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length >= 2 && (segments[0] === "embed" || segments[0] === "shorts")) {
    return check(segments[1], YOUTUBE_ID);
  }

  return null;
}

function vimeoId(url: URL): string | null {
  const segments = url.pathname.split("/").filter(Boolean);

  // player.vimeo.com/video/<id>
  if (segments[0] === "video" && segments[1]) return check(segments[1], VIMEO_ID);

  // vimeo.com/<id>
  return check(segments[0], VIMEO_ID);
}

function check(value: string | undefined, pattern: RegExp): string | null {
  if (!value) return null;
  return pattern.test(value) ? value : null;
}
