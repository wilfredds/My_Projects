# Ride Doctor — privacy policy (draft)

> **Draft, not legal advice.** Written in plain language so it can be checked
> against what the app really does. Before any public release it needs review
> against the Philippine Data Privacy Act of 2012 (RA 10173) and, for users
> elsewhere, GDPR-style requirements. Last updated for Phase 2.

## What the app does today (Phase 2)

This section is rewritten at the end of every phase to match the shipped code.

**What is stored, and only on your phone**
- Your profile: name or nickname, birth year, height, weight, riding habits
  and goal; and, only if you add them, sex, inseam, heart-rate numbers and FTP.
- Your answers to the seven readiness questions, and when you answered.
- Your bike: type, tyre size, measurements and gears. Which sensors you own.
- Your choices on this page's permissions, each with its date and the version
  of the text you saw. Withdrawing adds a record; history is not rewritten.
- Your races: name, type, date and start time, and any course details you
  add; which checklist items you ticked; and your debrief after a race —
  whether you finished, your place, where it was hardest, anything physical
  you noticed, and your own note. The debrief is health-related information
  and is covered by the same consent as your profile.
- App settings: theme, language, units.

**How it is protected**
- All of it is in one database encrypted on the device. The key is generated
  on first launch and kept in Android's secure keystore.
- The app is excluded from Android backup and device-to-device transfer.
- Nothing is written until you finish setup and agree to health data being
  stored. If you do not agree, nothing is saved.

**What leaves the phone**
- Nothing. The app makes no network requests and requests no Android
  permissions. There is no account, no analytics and no crash reporting.

**Location and reminders**
- Setup asks whether you would allow them, and records your answer. Neither
  is used yet: the app does not read your location or send notifications in
  this version. You will be asked again, by Android, when those features exist.

**Your rights, in the app (Settings → Privacy and your data)**
- **Export:** shows everything stored as JSON text, with a copy button. Note
  that anything copied to the clipboard can be read by other apps until it is
  replaced.
- **Delete everything:** removes every record and returns the app to its
  first-run state. Deleted content is overwritten, not just unlinked.
- **Withdraw:** location and reminder consent can be switched off any time.
  Health-data consent is withdrawn by deleting everything, since the app
  cannot keep a profile without it.

**The web preview** is a way to look at the app in a browser. It keeps what
you type in that browser tab's memory only: nothing is saved on the device,
nothing is sent anywhere, and reloading or closing the page erases it. The
page itself is loaded from wherever it is hosted, like any website, so the
host sees an ordinary page request but none of what you enter.

**If the encryption key is lost** (for example the phone's secure storage is
reset), the data cannot be recovered by anyone. The app will say so and offer
to start over.

## What we are building toward

These are commitments the later phases are designed around. Each becomes a
statement of fact here only once it is built and tested.

**Your data stays on your phone by default.** Profile, health readiness
answers, bike details, rides and symptom reports will be stored in an encrypted
database on the device. Nothing leaves it unless you turn on an optional
feature that needs to, and that feature says exactly what is sent.

**We ask separately, and you can change your mind.** Health data, location and
notifications each get their own consent, recorded with the date and the
version of the text you agreed to. Each can be withdrawn in Settings.

**We ask only for what a feature needs, when it needs it.** Onboarding asks for
the essentials. Everything else is requested at the moment a feature uses it,
with a short "why we ask".

**You can take your data or delete it.** Settings will offer an export of
everything as a JSON file, and a delete-everything action covering the device
and, if you ever enabled sync, the cloud copy.

**Health data is treated as sensitive.** It will not appear in logs or crash
reports and will not be sent to analytics or advertising services.

**Photos and video for the fit check stay on the phone** and are analysed
there, unless you explicitly choose otherwise.

**Location** will be used to get the weather forecast and heat risk for where
you ride. A weather request necessarily sends approximate coordinates to the
weather provider; the provider will be named here.

**Weight** is used only for physics (climbing) and fuelling. The app has no
weight-loss, calorie-restriction or body-image features.

## Not a medical device

Ride Doctor is an educational tool. It does not diagnose, treat or prevent any
condition. If you have chest pain or pressure, fainting, unusual shortness of
breath, palpitations, confusion in the heat, sudden severe joint pain or
swelling: stop and seek medical care.

## Open items before release

- Name the personal information controller and a contact for privacy requests.
- Decide the age policy (minimum age, parental consent). The app currently
  accepts ages 13 to 100 as a placeholder.
- Have a medical professional review the readiness questions and the
  red-flag wording.
- Replace clipboard export with a save-to-file flow.
- Name every third party that receives any data, and why.
- State retention periods.
- Legal review.
