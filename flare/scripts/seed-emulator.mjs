// Seeds the Firebase emulators with enough data to drive FLARE locally, and
// prints a session cookie so the admin surface can be opened in a browser
// without a real Firebase project.
//
//   firebase emulators:exec --only auth,firestore "node scripts/seed-emulator.mjs"
//
// or, to keep the emulators up while you work:
//
//   firebase emulators:start --only auth,firestore     # terminal 1
//   node scripts/seed-emulator.mjs                     # terminal 2
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
//   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 npm run dev
//
// The Admin SDK talks to the emulators whenever those two variables are set,
// and accepts any project ID, so no service account key is involved.
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? "flare-local";
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099";

process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST;

// No credential at all: with the emulator host variables set, the Admin SDK
// talks to the emulators and never authenticates. Passing a fake cert() does
// not work — it parses the private key before it looks at the emulator.
const app = initializeApp({ projectId: PROJECT_ID });

const auth = getAuth(app);
const db = getFirestore(app);

const PEOPLE = [
  {
    uid: "seed-admin",
    email: "admin@bfp.gov.ph",
    username: "admin",
    fullName: "Dela Cruz, Juan",
    rank: "Fire Chief Inspector",
    badgeNumber: "BFP-00001",
    unit: "Cavite City Fire Station",
    position: "Chief of Operator",
    role: "admin",
    status: "active",
  },
  {
    uid: "seed-learner",
    email: "learner@bfp.gov.ph",
    username: "fo1santos",
    fullName: "Santos, Maria",
    rank: "Fire Officer I",
    badgeNumber: "BFP-00214",
    unit: "Imus Fire Station",
    position: "Firefighter",
    role: "learner",
    status: "active",
  },
  {
    uid: "seed-applicant",
    email: "applicant@bfp.gov.ph",
    username: "fo1reyes",
    fullName: "Reyes, Antonio",
    rank: "Fire Officer I",
    badgeNumber: "BFP-00318",
    unit: "Bacoor Fire Station",
    position: "Firefighter",
    role: "learner",
    status: "pending",
  },
  {
    uid: "seed-suspended",
    email: "suspended@bfp.gov.ph",
    username: "fo2cruz",
    fullName: "Cruz, Elena",
    rank: "Fire Officer II",
    badgeNumber: "BFP-00127",
    unit: "Dasmariñas Fire Station",
    position: "Firefighter",
    role: "learner",
    status: "suspended",
  },
];

const CATEGORIES = [
  { id: "fire", title: "Fire Training", order: 1 },
  { id: "water", title: "Water Training", order: 2 },
  { id: "land", title: "Land Training", order: 3 },
  { id: "equipment", title: "Equipment & Apparatus", order: 4 },
  { id: "fitness", title: "Fitness & Wellness", order: 5 },
  { id: "sop", title: "Standard Operating Procedures", order: 6 },
];

for (const person of PEOPLE) {
  await auth
    .createUser({ uid: person.uid, email: person.email, password: "flare-emulator" })
    .catch((error) => {
      if (error.code !== "auth/uid-already-exists") throw error;
    });

  await db.collection("users").doc(person.uid).set({
    ...person,
    contactNumber: "09170000000",
    preferences: { theme: "system", language: "en", notificationsPaused: false },
    createdAt: new Date("2026-08-20T02:00:00Z").toISOString(),
    lastLoginAt: null,
  });
}

for (const category of CATEGORIES) {
  await db.collection("categories").doc(category.id).set({
    ...category,
    description: `${category.title} for BFP personnel.`,
    theme: category.id,
    iconPath: null,
    heroImagePath: null,
    published: true,
  });

  for (const [index, title] of ["Overview", "Lesson 1", "Lesson 2"].entries()) {
    await db
      .collection("categories")
      .doc(category.id)
      .collection("lessons")
      .doc(index === 0 ? "overview" : `lesson-${index}`)
      .set({ title, order: index, heroImagePath: null, published: true });
  }
}

await db.collection("announcements").add({
  type: "system",
  title: "Scheduled system maintenance",
  body: "FLARE will be unavailable on Sunday from 8:00 PM to 10:00 PM.",
  createdBy: "seed-admin",
  createdAt: new Date().toISOString(),
});

await db.collection("auditLogs").add({
  uid: "seed-learner",
  action: "sign_in",
  targetPath: null,
  detail: null,
  ip: "203.0.113.7",
  userAgent: "Mozilla/5.0 (seed)",
  createdAt: new Date(),
});

// Mint a session cookie for the admin, the same way /api/auth/session does:
// custom token -> ID token -> session cookie.
const customToken = await auth.createCustomToken("seed-admin");
const response = await fetch(
  `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=emulator`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  },
);
const { idToken } = await response.json();
const sessionCookie = await auth.createSessionCookie(idToken, {
  expiresIn: 60 * 60 * 24 * 1000,
});

console.log("seeded:", PEOPLE.length, "accounts,", CATEGORIES.length, "categories");
console.log("FLARE_SESSION_COOKIE=" + sessionCookie);
