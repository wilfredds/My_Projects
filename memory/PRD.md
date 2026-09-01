# CourtSplit — PRD

## Problem statement
A mobile-responsive web app for a single badminton session organizer ("Queue Master") to split court and shuttlecock costs among players and track who has paid. Players do not log in and have no accounts.

## Architecture
- Frontend: React (CRA + craco), Tailwind, shadcn/ui, react-router v7, sonner toasts.
- Backend: FastAPI + MongoDB (motor). All routes prefixed with /api.
- No auth. No real payments (paid toggle is manual). Multi-currency (display only, code stored per session).

## Core calculation (exact, in /app/frontend/src/lib/calc.js)
- totalShuttleCost = numberOfShuttles × pricePerShuttle
- totalCost = courtFee + totalShuttleCost
- courtPortion = courtFee / n ; shuttlePortion = totalShuttleCost / n
- perPlayerShare = courtPortion + shuttlePortion (2-dp display)
- Verified: ₱600 court, 3×₱120 shuttles, 6 players → ₱160.00 each (₱100 court + ₱60 shuttle), total ₱960.00.

## Data model
- Session: id, venue, date, court_fee, num_shuttles, price_per_shuttle, currency, payment_note, players[], created_at, updated_at.
- Player: id (uuid), name, paid (bool).

## Screens (done — 2026-06)
1. Home (/): past sessions list with venue/date/total/unpaid count, aggregate stats, New button, empty state.
2. New/Edit Session (/sessions/new, /sessions/:id/edit): venue, date, currency picker, costs, add players, sticky live per-player calculator, save.
3. Session Detail (/sessions/:id): roster with paid/unpaid Switch, collected vs outstanding + progress, edit/delete, copy text, share link.
4. Shareable public Summary (/summary/:id): polished screenshot-ready receipt card — gradient header, per-player court+shuttle breakdown, collected/outstanding, cost breakdown, optional payment note, "Made with CourtSplit" footer.

## Implemented endpoints
- POST/GET /api/sessions ; GET/PUT/DELETE /api/sessions/{id} ; PATCH /api/sessions/{id}/players/{playerId}

## Status
- Backend + frontend tested 100% (iteration_1). All core flows and calculation verified.

## Backlog (P1/P2)
- P1: Duplicate/clone a past session as a template.
- P1: Search/filter sessions on Home (All / Unsettled / Settled).
- P2: Per-player uneven shares (half-game/late) — explicitly deferred; user chose equal shares.
- P2: Dark "night mode" toggle.
- P2: Export/download summary as image.
