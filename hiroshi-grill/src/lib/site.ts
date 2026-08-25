/**
 * The site's canonical origin.
 *
 * One source of truth, because it feeds four things that must agree: the
 * canonical link, the Open Graph tags, the JSON-LD, and the sitemap. If they
 * disagree, search engines pick one and it will not be the one you meant.
 *
 * On Vercel, `VERCEL_PROJECT_PRODUCTION_URL` is set automatically to the
 * project's production domain, which means preview deployments do not
 * accidentally advertise themselves as canonical. `NEXT_PUBLIC_SITE_URL`
 * overrides it once there is a real domain.
 */
export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return stripTrailingSlash(configured);

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${stripTrailingSlash(vercel)}`;

  return "http://localhost:3000";
}

function stripTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}
