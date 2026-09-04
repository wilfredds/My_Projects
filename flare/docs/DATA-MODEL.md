# FLARE — screen inventory and data model

Canonical build reference, derived from the client's Figma frames (file
`vAtxWbxhQ7OUtQ7qhhY73V`). This document is the source of truth for the
Firestore schema; the published review page shared with the client is a
rendering of it, not a second source.

Status: **proposed, awaiting client sign-off.** Nothing here is implemented
yet. Open questions at the bottom must be answered before the assessment and
registration flows can be built.

## What FLARE is

The Firefighters' Learning and Resources Exchange — per the client's own
copy, the official online training platform of the Bureau of Fire Protection
(BFP). It is a **learning management system**, not a marketing site: courses,
lessons, per-section progress, assessments, certificates, and an
announcement feed, restricted to authorized BFP personnel.

This matters because it was initially scoped as a "content site with auth."
It isn't, and the schema below reflects the real shape.

## Screen inventory

24 frames were supplied, covering 10 distinct screens. The lesson screen
accounts for 7 of those frames — they are states of one component (tab
selection, per-section expand/collapse, per-section completion), not
separate pages.

| Screen | Auth | Notes |
|---|---|---|
| Domain (landing) | public | Create New Account / Sign In |
| Sign In | public | Email, password, captcha, forgot password |
| Sign Up | public | Username, email, password, confirm password |
| Home | required | Hero + 6 categories across a 2-page carousel, each showing progress state |
| Category | required | Overview + Lesson 1–5 tiles; one per category, themed |
| Lesson | required | Discussion / Resources / Assessment tabs + accordions, per-section completion, BACK on finish |
| Feed (notifications) | required | Grouped by day, Mark as Read per group |
| Profile | required | Identity, role badge, 4 training statistics |
| Settings | required | Profile link, Pause Notification, Dark Mode, Security, Language, legal links, Log Out |
| A.P.T | required | About Us / Privacy / Terms accordion, each downloadable |

The six categories, from the Home carousel: **Fire Training, Water Training,
Land Training, Equipment & Apparatus, Fitness & Wellness, Standard Operating
Procedures.**

## Progress is tracked per section, not per lesson

The single most important structural finding. Each lesson has exactly three
sections — Discussion, Resources, Assessment — and each carries its own
`Not Started` / `Finished` control in the design.

```
category            fire | water | land | equipment | fitness | sop
  └── lesson        overview | lesson-1 … lesson-5
        └── section discussion | resources | assessment   ← progress lives here
```

The `50%` bar on the Home cards is therefore a **derived rollup**, computed
from completed sections in a category. It must not be stored as a number:
a stored percentage silently goes stale the moment a lesson is added, and
would then misreport training compliance — which for this client is a
reporting obligation, not a cosmetic bug.

## Collections

```
users/{uid}
  username, email, fullName
  rank, badgeNumber, unit, position, contactNumber   # BFP identity fields
  role: 'learner' | 'admin'
  status: 'pending' | 'active' | 'suspended'
  preferences: { theme, language, notificationsPaused }
  createdAt, lastLoginAt

categories/{categoryId}                              # fire, water, land, …
  title, order, description, theme, iconPath, heroImagePath, published

categories/{categoryId}/lessons/{lessonId}           # overview, lesson-1 … lesson-5
  title, order, heroImagePath, published

categories/{categoryId}/lessons/{lessonId}/sections/{sectionId}
  # sectionId is fixed: discussion | resources | assessment
  body, attachments[], videoPath, updatedAt

categories/{categoryId}/lessons/{lessonId}/questions/{questionId}
  order, prompt, type: 'single' | 'multiple', options[{ id, label }]
  # deliberately contains NO correct answers — see below

answerKeys/{categoryId}__{lessonId}__{questionId}    # server-only
  correctOptionIds[], points, explanation

users/{uid}/progress/{categoryId}
  lessons: { [lessonId]: { discussion, resources, assessment, completedAt } }
  updatedAt

users/{uid}/attempts/{attemptId}
  categoryId, lessonId, answers[], score, passed, submittedAt

users/{uid}/certificates/{certificateId}
  categoryId, serial, issuedAt, pdfPath

announcements/{announcementId}
  type: 'course_update' | 'resource' | 'system' | 'assessment_reminder'
  title, body, audience, createdAt

users/{uid}/notifications/{notificationId}
  announcementId?, type, title, body, createdAt, readAt

auditLogs/{logId}                                    # server-only
  uid, action, ip, userAgent, targetPath, createdAt
```

### Why answer keys live in a separate collection

Firestore security rules gate **whole documents**, never individual fields.
If `correctOptionIds` sits on the question document the learner's client
reads, that learner can read the answers straight out of the SDK regardless
of what the UI displays. Hiding it in the interface hides nothing.

So: questions are readable by active users, `answerKeys/` is readable by
**no client at all**, and grading happens in a Next.js Route Handler using
`firebase-admin`, which then writes the attempt and updates progress. The
learner's browser submits answers and receives a score; it never sees the
key.

### Why progress is one document per category

Six categories × six lessons is a small, bounded corpus. One progress
document per user per category means the Home screen reads six small
documents rather than 36, marking a section complete touches exactly one
document, and there is no cross-user write contention. If the catalogue
grows substantially this should be revisited.

### Notifications

Broadcast items (course updates, new resources, system announcements) live
once in `announcements/`; per-user state — including `readAt` for the design's
"Mark as Read" — lives in `users/{uid}/notifications/`. Personal items
(assessment reminders) are written directly to the per-user collection.

The alternative, fanning every announcement out to every user on write, is
simpler to paginate but becomes a write storm at BFP headcount. Revisit only
if per-user targeting outgrows this.

## Compliance requirements are contractual, not optional

The client's Privacy Notice and Terms of Service are real, specific, and
already written. They commit the system to things the backend must actually
implement:

- **Republic Act No. 10173** (Data Privacy Act of 2012), its IRR, and NPC
  issuances are cited by name.
- The notice states that FLARE collects **login history, IP address, device
  and browser information, and system usage logs and audit records.** That is
  a published promise, which is why `auditLogs/` exists in the schema above
  rather than being deferred.
- **Data subject rights** (access, correction, erasure, objection, complaint)
  are promised — so per-user data export and deletion must be buildable.
- Sensitive personnel fields are enumerated: full name, rank, badge or
  employee ID, office/unit/fire station assignment, position, official BFP
  email, contact number.

Practical consequence: `auditLogs/` is written only through the Admin SDK and
is readable by no client. Retention policy still needs a number from the
client.

## Security rules, in summary

| Path | Read | Write |
|---|---|---|
| `users/{uid}` | owner, admin | owner (restricted fields), admin |
| `categories/**` (incl. lessons, sections, questions) | signed-in + `status == 'active'` | admin only |
| `answerKeys/**` | nobody | server only |
| `users/{uid}/progress/**` | owner | owner |
| `users/{uid}/attempts/**` | owner | server only |
| `users/{uid}/certificates/**` | owner | server only |
| `announcements/**` | signed-in + active | admin only |
| `users/{uid}/notifications/**` | owner | owner (`readAt` only), server |
| `auditLogs/**` | nobody | server only |

Default posture stays closed: anything not listed is denied.

## Gaps found in the supplied design

Neither is a criticism of the design work — both are seams that only surface
when the backend is specified.

**1. Sign Up does not collect the fields the system requires.** The frame
asks for username, email, password, confirm password. The Profile screen and
Privacy Notice require rank, badge number, station assignment, and position.
Either a profile-completion step is missing, or accounts are provisioned by
an administrator.

**2. Nothing verifies that a registrant is BFP personnel.** The copy
repeatedly restricts FLARE to "authorized BFP personnel," but the design
shows open self-registration. As drawn, anyone on the internet can create an
account on a government training portal. This is why `users.status` carries
`pending` in the schema — it supports an approval gate — but which mechanism
to use is the client's decision.

## Admin side — required, not yet designed

The client confirmed an admin side exists in principle; no frames were
supplied. Someone must author every lesson, upload every resource, write
every assessment, and send those System Announcements. Minimum surface:

- Dashboard
- User management — approve pending registrations, assign roles, suspend
- Category management
- Lesson editor — rich text, video, file attachments
- Assessment builder — questions, options, answer keys, passing score
- Announcement composer
- Training compliance reports — the Privacy Notice commits to monitoring
  mandatory BFP training and generating certificates and training reports
- Audit log viewer
- Certificate template management

This is a substantial share of the total build and should be designed and
priced explicitly rather than absorbed.

## Open questions for the client

1. **Assessments** — options are drawn as checkboxes. Multi-answer, or
   single-answer drawn with checkbox styling? Scoring differs.
2. **Passing score and retakes** — what score passes, and how many attempts?
3. **Registration** — open signup with admin approval, BFP email domain
   restriction, or admin-provisioned accounts only?
4. **BFP identity fields** — collected at signup, or in a profile step?
5. **Certificates** — issued automatically on category completion? Who
   supplies the template and signatory?
6. **Languages** — the Settings screen has a language selector. Which
   languages? (This must be decided before build; retrofitting i18n is
   expensive.)
7. **Video hosting** — uploaded to Firebase Storage, or embedded from
   YouTube/Vimeo? Storage egress is billed and BFP-wide video traffic is not
   trivial.
8. **Search** — the top bar carries a search field on every screen. Firestore
   has no native full-text search; scope needs confirming before choosing
   between a client-side index and a search service.
9. **Audit log retention** — how long, per BFP records policy?
10. **"Overview"** — a lesson like any other, or the category description?
