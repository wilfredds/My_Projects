/**
 * Bike Passport — Cloud Functions (server-side Claude proxy).
 *
 * WHY THIS EXISTS (architectural decision):
 * The Claude API key must never ship inside the mobile app. These HTTPS
 * functions hold the key (set via a secret) and call Claude on the device's
 * behalf, returning structured JSON. The Flutter `ClaudeAiService` /
 * `ClaudeVisionService` post to these endpoints.
 *
 * Set the key before deploy:
 *   firebase functions:secrets:set ANTHROPIC_API_KEY
 *
 * Every endpoint is wrapped in `guarded()`, which enforces App Check, a valid
 * Firebase ID token, and a per-user daily budget. See auth.ts for why.
 */
import Anthropic from "@anthropic-ai/sdk";
import { initializeApp } from "firebase-admin/app";
import { onRequest } from "firebase-functions/v2/https";

import { guarded, RequestRejected } from "./auth";

initializeApp();

const MODEL = "claude-sonnet-5";

/** Shared runtime options. Auth is by Bearer token, so CORS is not a CSRF risk. */
const OPTS = { secrets: ["ANTHROPIC_API_KEY"], cors: true };

function client(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

/** Extracts the first text block from a Claude response. */
function textOf(msg: Anthropic.Message): string {
  const block = msg.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text : "";
}

/** Best-effort JSON parse of a model reply (handles ```json fences). */
function parseJson<T>(raw: string, fallback: T): T {
  try {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return fallback;
  }
}

function requireString(value: unknown, field: string, maxLen: number): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new RequestRejected(400, `Field "${field}" must be a non-empty string.`);
  }
  if (value.length > maxLen) {
    throw new RequestRejected(400, `Field "${field}" exceeds ${maxLen} characters.`);
  }
  return value;
}

/**
 * POST /mechanicChat { message, history } -> { reply }
 *
 * History is capped because it is attacker-controlled and bills per token.
 */
export const mechanicChat = onRequest(
  OPTS,
  guarded(1, async (req, res) => {
    const { message, history } = req.body ?? {};
    const text = requireString(message, "message", 4000);
    const raw = Array.isArray(history) ? history.slice(-20) : [];
    const turns = raw
      .filter((t): t is { role: string; text: string } =>
        !!t && typeof t.text === "string" && t.text.length <= 4000
      )
      .map((t) => ({
        role: t.role === "user" ? ("user" as const) : ("assistant" as const),
        content: t.text,
      }));

    const msg = await client().messages.create({
      model: MODEL,
      max_tokens: 700,
      system:
        "You are an expert bike mechanic. Ask clarifying questions when needed, " +
        "then give a clear, safe, step-by-step diagnosis.",
      messages: [...turns, { role: "user", content: text }],
    });
    res.json({ reply: textOf(msg) });
  })
);

/**
 * POST /analyzeBike { part, imageBase64 } -> structured health report
 *
 * `part` is an allowlisted enum, never free text: it is interpolated into the
 * system prompt, so accepting arbitrary strings would be a prompt-injection
 * vector letting a caller rewrite the model's instructions.
 */
const BIKE_PARTS = ["whole", "tires", "chain", "brakes", "frame", "drivetrain"] as const;

/** ~5 MB of image once base64-decoded. Guards memory and model spend. */
const MAX_IMAGE_CHARS = 7_000_000;

export const analyzeBike = onRequest(
  { ...OPTS, memory: "512MiB" },
  guarded(5, async (req, res) => {
    const { part, imageBase64 } = req.body ?? {};

    if (typeof part !== "string" || !BIKE_PARTS.includes(part as never)) {
      throw new RequestRejected(
        400,
        `Field "part" must be one of: ${BIKE_PARTS.join(", ")}.`
      );
    }
    const image = requireString(imageBase64, "imageBase64", MAX_IMAGE_CHARS);
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(image)) {
      throw new RequestRejected(400, 'Field "imageBase64" is not valid base64.');
    }

    const msg = await client().messages.create({
      model: MODEL,
      max_tokens: 1500,
      system:
        "You are a bicycle inspection AI. Analyse the photo of the bike " +
        `area "${part}". Respond ONLY with JSON: {"healthScore":number(0-100),` +
        '"riskLevel":"low"|"medium"|"high","summary":string,' +
        '"findings":[{"area":string,"issue":string,"severity":"low"|"medium"|"high","suggestions":string[]}]}',
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: "image/jpeg", data: image },
            },
            { type: "text", text: "Inspect this and report issues." },
          ],
        },
      ],
    });
    res.json(
      parseJson(textOf(msg), {
        healthScore: 0,
        riskLevel: "low",
        summary: "",
        findings: [],
      })
    );
  })
);
