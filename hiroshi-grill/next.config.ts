import type { NextConfig } from "next";

/**
 * Security headers.
 *
 * These are instructions to the *browser*, telling it to refuse things that an
 * attacker would need in order to exploit us. They cost nothing, they apply to
 * every response, and they are the cheapest security in the whole project — so
 * they go in at scaffold time, not at the end.
 *
 * The Content-Security-Policy is NOT here — it lives in `src/proxy.ts`, because
 * it carries a per-request nonce and so has to be built per request. Setting it
 * in both places would send two CSP headers, and a browser that receives two
 * enforces the *intersection* of them, which is a very confusing way to break
 * your own site.
 */
const securityHeaders = [
  {
    /* HSTS: after the first visit, the browser refuses to talk to us over plain
       http at all, even if someone hands the guest an http:// link. Vercel gives
       us the certificate; this makes the browser insist on using it. */
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  /* Stops the staff portal being loaded inside an <iframe> on someone else's
     site, where a fake overlay could trick a host into clicking "cancel" on a
     real booking. (Clickjacking.) `frame-ancestors 'none'` above says the same
     thing to modern browsers; this covers the older ones. */
  { key: "X-Frame-Options", value: "DENY" },
  /* Stops the browser second-guessing our Content-Type and, say, deciding an
     uploaded .txt is really JavaScript worth running. */
  { key: "X-Content-Type-Options", value: "nosniff" },
  /* Do not leak the full portal URL (which may contain a reservation id) to
     third-party sites in the Referer header. */
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  /* We need none of these, so we turn them all off. */
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  // Never leak the framework version to anyone probing the site.
  poweredByHeader: false,
  reactStrictMode: true,

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
