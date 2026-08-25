import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site";

/**
 * sitemap.xml
 *
 * Short, because the site is one page. The staff portal is deliberately absent:
 * a sitemap is a list of pages you want indexed, and nothing behind a login
 * qualifies.
 *
 * The section anchors are not listed either. Google treats `/#menu` as the same
 * URL as `/`, so listing them would be noise — the menu gets found because it is
 * in the server-rendered HTML of the page that IS listed.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl(),
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
