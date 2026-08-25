import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site";

/**
 * robots.txt
 *
 * Worth being clear about what this is for. `Disallow` is a request to
 * well-behaved crawlers, not an access control — a rule here keeps the staff
 * portal out of Google, and does absolutely nothing to stop anyone who types
 * the URL. What actually protects `/portal` is the login and Row Level
 * Security. If robots.txt were the only thing standing between the public and
 * the reservations table, the table would already be public.
 *
 * (It is also, unavoidably, a list of the paths we would rather people did not
 * poke at — which is why the protection has to be real.)
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        /* Nothing behind the login is useful in search results. */
        "/portal",
        /* The booking endpoint only answers POST; indexing it is pointless. */
        "/api/",
      ],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  };
}
