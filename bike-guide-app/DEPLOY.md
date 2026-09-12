# Deploying Kasama / Bike Guide PH

## Vercel (primary)

Project: **rideph** → `https://rideph.vercel.app`
Linked to `wilfredds/My_Projects`, root directory `bike-guide-app`.

### vercel.json — why each rule exists

| Rule | Reason |
|---|---|
| `sw.js` → `max-age=0, must-revalidate` | **The important one.** A cached service worker is a stuck app — users keep running the old one until the cached copy expires, so pushes appear to do nothing. |
| `manifest.json` → no cache | Icon and name changes need to reach installed PWAs. |
| `assets/data/*` → 5 min | Hazard seed data changes as the community grows; a long cache would freeze the map. |
| `Permissions-Policy` | Only geolocation and camera are needed. Denying the rest limits the blast radius if a third-party script is ever compromised. |
| `X-Content-Type-Options: nosniff` | Stops the browser guessing content types. |

### Production branch

Vercel defaults to `main`, but the current app lives on
`claude/bike-guide-app-planning-ciID4`. The repo's `main` has 130 commits of
unrelated projects and **no common ancestor** with this branch, so they cannot
be merged — the production branch must be set explicitly:

> Vercel dashboard → **rideph** → Settings → **Git** → Production Branch →
> `claude/bike-guide-app-planning-ciID4` → Save → Redeploy

After that every push to that branch deploys automatically.

## GitHub Pages (secondary, still live)

`https://wilfredds.github.io/My_Projects/bike-guide-app/` via
`.github/workflows/deploy-bike-guide.yml`. Kept as a fallback; safe to retire
once Vercel is the shared link.

## After changing domains — checklist

- [ ] Firebase → Authentication → Settings → **Authorized domains** → add the
      Vercel domain. Not needed for Firestore, but required the moment login
      is added, and easy to forget until it breaks.
- [ ] Re-run `/firebase-check.html` on the new domain.
- [ ] Hard-refresh once: the old service worker is cached per-origin, so the
      new domain starts clean but the old one may serve stale files.
