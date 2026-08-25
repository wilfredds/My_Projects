"use client";

import Script from "next/script";

import { TURNSTILE_FIELD } from "@/lib/turnstile";

/**
 * The Cloudflare Turnstile widget.
 *
 * Renders nothing at all when no site key is configured, so a restaurant
 * without a Cloudflare account still has a working booking form — the honeypot
 * carries the load on its own.
 *
 * ---------------------------------------------------------------------------
 * HOW THIS GETS PAST OUR OWN CSP
 * ---------------------------------------------------------------------------
 * Our policy uses `'strict-dynamic'`, and a detail of that keyword is easy to
 * miss: when it is present, browsers IGNORE host allowlists in `script-src`
 * entirely. Adding `https://challenges.cloudflare.com` to the policy would do
 * nothing whatsoever.
 *
 * What does work is the nonce. A script tag carrying this response's nonce is
 * trusted regardless of where it loads from, and under `'strict-dynamic'` every
 * script IT goes on to load inherits that trust — which is exactly what
 * Turnstile needs, because it injects further scripts of its own.
 *
 * `next/script` picks up the nonce from the CSP automatically, which is why
 * this is a `<Script>` and not a plain tag.
 *
 * The widget also renders an iframe, so `frame-src` has to name Cloudflare —
 * and `frame-src` is a host list that strict-dynamic does not touch. See
 * `src/proxy.ts`.
 */
export function TurnstileWidget({ siteKey }: { siteKey: string | undefined }) {
  if (!siteKey) return null;

  return (
    <div className="mt-5">
      {/* afterInteractive, not lazyOnload: the widget is a dependency of the
          form's submit button, so it should be ready by the time a guest has
          finished typing rather than waiting for every other resource. */}
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
      />
      {/* Cloudflare's script finds this by class and writes a hidden input
          named `cf-turnstile-response` into the surrounding form. */}
      <div
        className="cf-turnstile"
        data-sitekey={siteKey}
        data-theme="light"
        data-action="reservation"
      />
      <noscript>
        <p className="mt-2 text-sm text-sumi-muted">
          This form needs JavaScript to verify you are not a bot. Please call us instead — we are
          happy to take the booking over the phone.
        </p>
      </noscript>
    </div>
  );
}

export { TURNSTILE_FIELD };
