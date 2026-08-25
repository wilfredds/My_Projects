import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk } from "next/font/google";
import { headers } from "next/headers";

import { restaurant, restaurantJsonLd } from "@/lib/restaurant";
import { siteUrl as resolveSiteUrl } from "@/lib/site";
import "./globals.css";

/* next/font downloads these at *build* time and serves them from our own
   domain. No request ever goes to fonts.googleapis.com from a visitor's
   browser, which means no third-party can log who visits the site, and our
   Content-Security-Policy can stay strict about where fonts may load from. */
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  axes: ["SOFT", "WONK", "opsz"],
});

const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  display: "swap",
});

const siteUrl = resolveSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${restaurant.name} — Unli Samgyupsal in ${restaurant.address.city}, ${restaurant.address.province}`,
    template: `%s · ${restaurant.name}`,
  },
  description: restaurant.description,
  keywords: [
    "samgyupsal General Trias",
    "unli samgyupsal Cavite",
    "Korean BBQ General Trias",
    "unlimited samgyupsal",
    restaurant.name,
  ],
  openGraph: {
    type: "website",
    locale: "en_PH",
    url: siteUrl,
    siteName: restaurant.name,
    title: `${restaurant.name} — ${restaurant.tagline}`,
    description: restaurant.description,
  },
  twitter: {
    card: "summary_large_image",
    title: `${restaurant.name} — ${restaurant.tagline}`,
    description: restaurant.description,
  },
  robots: { index: true, follow: true },
  /* One canonical URL, so the same page reached via a preview domain, a
     trailing slash or a tracking query does not read as three pages competing
     with each other in search results. */
  alternates: { canonical: siteUrl },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  /**
   * Reading a request header does two jobs at once.
   *
   * 1. It gives us this response's CSP nonce, so our own inline script below
   *    is allowed to stay on the page.
   * 2. Touching `headers()` opts the whole app out of static prerendering —
   *    which is exactly what we need, because a nonce is per-response and a
   *    page baked at build time has no response to belong to. Without this,
   *    Next serves cached HTML with no nonce on it, the browser blocks every
   *    script in it, and React never hydrates. (Ask how we know.)
   */
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="en-PH" className={`${fraunces.variable} ${hanken.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        {children}
        {/* Structured data.
            This is the ONLY dangerouslySetInnerHTML in the project, and
            `react/no-danger` is set to error so it stays that way — adding a
            second one is a build failure, not a code-review conversation.
            It is safe because the object comes from restaurant.ts, which we
            wrote; nothing a visitor ever typed passes through here. Never
            interpolate user text into a script tag like this. */}
        <script
          type="application/ld+json"
          nonce={nonce}
          // eslint-disable-next-line react/no-danger -- our own static data, see above
          dangerouslySetInnerHTML={{ __html: JSON.stringify(restaurantJsonLd(siteUrl)) }}
        />
      </body>
    </html>
  );
}
