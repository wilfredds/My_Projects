# Installing AutoCare for another shop

AutoCare is installed **once per shop**. Each shop gets its own copy of the app
and its own database, so one shop can never see another's customers or money,
and each install carries that shop's name, logo and colour. This guide is for
the person doing the installing (you); the shop owner only does the last step.

It takes about twenty minutes. You need a GitHub account with this repository,
a [Neon](https://neon.tech) account and a [Vercel](https://vercel.com) account.

> **Before you charge for it.** Vercel's free *Hobby* plan is intended for
> personal, non-commercial projects. If you are paid to host a shop's install,
> expect to need Vercel *Pro* (or another host that runs Next.js). Neon's free
> tier is generous, but check its limits too. Read both companies' current
> pricing and terms before quoting a price to a shop — they change.

---

## 1. A database for the shop (Neon)

1. In Neon, **New Project**. Name it after the shop (`talyer-ni-mang-ben`).
   Region: **Singapore** (closest to the Philippines).
2. Copy the **direct** connection string — the host must **not** contain
   `-pooler`. Migrations need a direct connection; the main README explains why.

## 2. The app (Vercel)

1. **Add New → Project**, and pick this repository.
2. **Root Directory:** `autocare`. Framework: Next.js. Leave the build command
   alone — `vercel.json` already sets it to `npm run build:vercel`, which
   creates and updates the tables on every production deploy.
3. **Environment Variables:**

   | Name | Value |
   | --- | --- |
   | `DATABASE_URL` | the direct connection string from step 1 |
   | `AUTH_SECRET` | the output of `openssl rand -base64 32` — a new one for every shop |
   | `SETUP_CODE` | a one-time code you make up, at least 8 characters, e.g. `mangben-2026-setup` |

4. **Deploy.**

The first deploy creates the database tables itself; there is nothing to run
by hand.

Do **not** run `npm run seed` or paste `prisma/bootstrap.sql` for another shop.
Both are HI-OCTEN's: they create HI-OCTEN's owner accounts, with passwords that
are printed in this repository. A new shop starts empty and sets itself up
(next step).

## 3. The owner sets up the shop

Open the site. The login page says **"Bagong install ito"** and offers
**I-set up ang shop**. With the owner beside you, fill in:

1. the **setup code** — the `SETUP_CODE` from step 2. Until it is set, the
   setup page stays locked and says so;
2. the shop's **name, address and phone**;
3. the owner's **own name, username and password** — they choose it, so
   nobody else knows it;
4. leave **"Lagyan na ng karaniwang serbisyo ng talyer"** ticked to start with
   ten common services (change oil, tune-up, brakes, underchassis, alignment,
   tires, vulcanizing, battery, aircon, carwash) at typical prices, each
   already knowing how often it comes back (change oil: 3 months or
   5,000 km). All of it is editable.

The owner then logs in, reads the rules of use once, and is in.

Setup works **only while the database has no accounts at all**. The moment the
owner's account exists, `/setup` is gone (404) for good, so it cannot be used
later to create a second owner. You can now delete `SETUP_CODE` from Vercel —
it no longer does anything.

## 4. Make it theirs

In **Mga Setting → Itsura ng inyong shop**, the owner (or you) can:

- upload the shop's **logo** — a PNG, JPG or WebP picture; it is shrunk on
  the phone before it is sent. Without one, the shop's initials are shown;
- pick the shop's **colour**: orange, blue, violet, or black and gold. Green,
  red and yellow are not offered because in AutoCare they mean paid and owed;
- add the shop's **TIN**, printed on receipts.

Staff accounts are added in **Mga User**. Each staff member chooses their own
password on their first login.

## 5. Stop every push from building every shop

Each Vercel project builds on every push to the repository, whatever changed.
With several shops — and the other projects in this repository — that soon
uses up Vercel's daily build allowance. Once the shop is set up, open the
shop's project → **Settings → Git → Ignored Build Step**, choose **Custom**,
and enter the command from Vercel's own documentation:

```bash
git diff --quiet HEAD^ HEAD ./
```

It runs inside `autocare/`, so a push that changes nothing there is skipped.
Do this last: if you ever change an environment variable and the redeploy is
skipped, set Ignored Build Step back to **Automatic**, redeploy, then switch
it back.

## 6. Optional: the shop's own web address

Vercel → the shop's project → **Settings → Domains**.

---

## Things to tell the owner

- **Receipts.** AutoCare prints a job record, and every receipt says so:
  *"Ito ay talaan ng trabaho, hindi opisyal na resibo ng BIR."* AutoCare is not
  a BIR-registered receipting system. Official receipts or invoices still come
  from the shop's BIR-registered booklet or system.
- **Their data is theirs.** *Mga Ulat → Mag-download ng kopya* exports every
  record as CSV (opens in Excel) or JSON, at any time.
- **Backups.** Neon keeps a restore history of the database (how far back
  depends on the plan). Exporting a copy once a month is a sensible extra.
- **Babalikan.** Cars due back for their next service are listed with Call and
  Text buttons. Both use the phone in the owner's hand — its own number and its
  normal call and text rates — so there is no SMS service to sign up for.
- **Singilin (utang).** Everyone who still owes is on one page, with Call and
  Text (the amount already in the message) and **Tumanggap ng bayad** when the
  money comes in. Money collected later counts as that day's income.
- **Languages.** Filipino, English, Español, 日本語, 한국어 and 中文, chosen per
  person.
- **Phones.** It is a website, so there is nothing to install. On Android,
  Chrome's *Add to Home screen* gives it an icon like an app.

## Updating every shop

All shops run the same code. Merge a change to `main` and each shop's Vercel
project redeploys itself (if its Ignored Build Step sees a change under
`autocare/`), applying any new database migration as part of the build.
Migrations are written to be additive, so an update never removes a shop's
data — keep it that way.
