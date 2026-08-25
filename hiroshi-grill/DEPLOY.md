# Deploying

> **Doing this for the first time?** Follow [`GOLIVE.md`](GOLIVE.md) instead —
> it is the full sequence in order, with the Supabase setup and the local
> verification that should happen before any of this. This file is the Vercel
> reference you come back to afterwards.

## Before the first deploy — the blocking items

Two things must be true or the site will be live and wrong. Neither is a code
change; both are yours.

### 1. Replace the placeholder business details

Every address, phone number, opening time and price in the repo is a stand-in.
They live in two files:

- `src/lib/restaurant.ts` — address, phone, email, hours, map coordinates
- `src/lib/menu.ts` — packages, prices, à la carte items, house rules

This is not cosmetic. Those values are fed into the JSON-LD structured data that
Google reads and shows in search results, and into the Open Graph image people
see when the link is shared. **Publishing a wrong phone number or wrong opening
hours for a real restaurant is worse than publishing none** — people turn up to
a closed door, or call a stranger.

### 2. Stand up the Supabase project

Follow [`supabase/README.md`](supabase/README.md). Until it exists:

- the reservation form returns "we could not save that request",
- `/portal` cannot sign anyone in.

The rest of the site — menu, rules, hours, location — works without it.

## Environment variables on Vercel

Project → Settings → Environment Variables. Set these for **Production** and
**Preview**:

| Variable | Value | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://your-domain.ph` | Canonical URL. Omit on Preview so previews do not claim to be canonical. |
| `NEXT_PUBLIC_SUPABASE_URL` | from Supabase | Public. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from Supabase | Public. Grants nothing on its own — RLS still judges every request. |
| `SUPABASE_SERVICE_ROLE_KEY` | from Supabase | **Secret.** Bypasses every policy. Never `NEXT_PUBLIC_`. |
| `RATE_LIMIT_SALT` | `openssl rand -base64 32` | Must be the **same value across all instances**, or limits become per-instance. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | from Cloudflare | Optional. Public. |
| `TURNSTILE_SECRET_KEY` | from Cloudflare | Optional. **Secret.** |

A note on the two "public" keys: they are compiled into the JavaScript bundle
and readable by anyone. That is by design. The anon key is not a password — it
identifies the project, and what it is allowed to do is decided by the RLS
policies in `supabase/schema.sql`. The service-role key is the opposite, and is
the one credential in this project that is genuinely catastrophic to leak.

## Deploying

```bash
npm i -g vercel
vercel            # preview deployment, unique URL
vercel --prod     # production
```

Or connect the GitHub repo in the Vercel dashboard and set the **Root
Directory** to `hiroshi-grill` — this repo holds several projects.

Preview deployments get their own URL and are marked `noindex` by Vercel, so
they are a safe way to look at the site on a phone before it is public.

## After the first deploy

- [ ] Open the site and check the address, phone and hours are the real ones.
- [ ] Submit a test booking; confirm it appears in the portal.
- [ ] Sign in as crew, host and owner in turn and confirm each sees what §9 of
      the spec says they should — masked numbers and no cancel button for crew.
- [ ] Check `https://your-domain.ph/robots.txt` names the right sitemap.
- [ ] Paste the URL into Facebook Messenger and confirm the preview card renders.
- [ ] Run the URL through
      [Google's Rich Results Test](https://search.google.com/test/rich-results)
      to confirm the Restaurant schema is picked up.
- [ ] Submit the sitemap in Google Search Console.
- [ ] In Supabase: Authentication → Policies, turn on minimum password strength
      and leaked-password protection. These are dashboard settings; the repo
      cannot set them for you.
- [ ] Schedule `select public.prune_rate_limits();` (Database → Extensions →
      pg_cron) so the rate-limit table does not grow forever.

## Custom domain

Vercel issues and renews the certificate automatically. Once the domain is live,
set `NEXT_PUBLIC_SITE_URL` to it and redeploy so the canonical URL, sitemap and
JSON-LD all agree.

One caution on HSTS: `next.config.ts` sends
`Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`. That
tells browsers to refuse plain http on the domain **and every subdomain** for
two years, and it is not quickly reversible — a browser that has seen the header
keeps honouring it. Make sure every subdomain you intend to use can serve HTTPS
before pointing a real domain at this.
