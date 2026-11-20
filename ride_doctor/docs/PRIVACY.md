# Ride Doctor — privacy policy (draft)

> **Draft, not legal advice.** Written in plain language so it can be checked
> against what the app really does. Before any public release it needs review
> against the Philippine Data Privacy Act of 2012 (RA 10173) and, for users
> elsewhere, GDPR-style requirements. Last updated for Phase 0.

## What the app does today (Phase 0)

- **Collects nothing.** There is no profile, no account and no database yet.
- **Sends nothing.** The app makes no network requests. The release build
  requests no Android permissions.
- **Remembers nothing.** Theme and language choices are held in memory and
  reset when the app closes.

This section is rewritten at the end of every phase to match the shipped code.

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
- Decide the age policy (minimum age, parental consent).
- Name every third party that receives any data, and why.
- State retention periods.
- Legal review.
