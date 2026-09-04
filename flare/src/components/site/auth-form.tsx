"use client";

import Link from "next/link";
import { Suspense, useState, type FormEvent, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { validateRegistration } from "@/lib/users/registration";
import { FlareWordmark } from "./brand";
import { HeroArtwork } from "./artwork";

/**
 * The Sign In and Sign Up screens.
 *
 * Both follow the same path as the rest of FLARE: the browser authenticates
 * with Firebase directly, then exchanges the resulting ID token for the
 * httpOnly session cookie the server trusts. No password reaches this app's
 * server at any point.
 */

const field =
  "w-full rounded-full border border-white/40 bg-white/90 px-4 py-2.5 text-sm text-[#14103a] outline-none placeholder:text-[#8a86a3] focus:ring-2 focus:ring-white";

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="flare-gradient relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-12">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <HeroArtwork />
      </div>
      <div className="relative flex w-full max-w-sm flex-col items-center gap-7">
        <FlareWordmark tagline />
        {children}
      </div>
    </main>
  );
}

function Back() {
  return (
    <Link
      href="/"
      className="absolute left-4 top-4 rounded-full p-2 text-white transition hover:bg-white/15"
      aria-label="Back"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  );
}

/** Trades a Firebase ID token for the server session cookie. */
async function startSession(idToken: string) {
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!response.ok) throw new Error("session");
}

// ------------------------------------------------------------------ sign in

export function SignInScreen() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notRobot, setNotRobot] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!notRobot) {
      setError("Tick the box to confirm you are not a robot.");
      return;
    }

    setBusy(true);
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      await startSession(await credential.user.getIdToken());
      router.push(params.get("next") ?? "/home");
      router.refresh();
    } catch {
      // One message for both "no such account" and "wrong password": saying
      // which would let anyone check whether an address has an account here.
      setError("That email and password do not match an account.");
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setError(null);
    setNotice(null);
    if (!email) {
      setError("Enter your email address first, then choose Forgot password.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
    } catch {
      // Deliberately ignored — see the notice below.
    }
    setNotice("If that address has an account, a reset link is on its way.");
  }

  return (
    <Shell>
      <Back />
      <form onSubmit={submit} className="flare-glass w-full rounded-3xl p-5">
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-sm text-white">
            <span className="font-semibold">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={field}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm text-white">
            <span className="font-semibold">Password</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={field}
            />
          </label>

          {/* The design shows a CAPTCHA here. This is the checkbox from that
              frame and it is enforced, but it is not yet a real bot check —
              wiring Cloudflare Turnstile (as hiroshi-grill does) needs keys
              from the client. Labelled rather than left looking complete. */}
          <label className="flare-glass flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-sm text-white">
            <input
              type="checkbox"
              checked={notRobot}
              onChange={(event) => setNotRobot(event.target.checked)}
              className="size-4"
            />
            <span>
              I&rsquo;m not a robot
              <span className="block text-[0.65rem] text-[var(--on-gradient-muted)]">
                Placeholder — a real bot check needs Turnstile keys
              </span>
            </span>
          </label>

          <button
            type="button"
            onClick={reset}
            className="self-start text-xs text-[var(--on-gradient-muted)] underline underline-offset-2"
          >
            Forgot password
          </button>

          {error && <p className="text-sm font-medium text-white">{error}</p>}
          {notice && <p className="text-sm text-[var(--on-gradient-muted)]">{notice}</p>}

          <button
            type="submit"
            disabled={busy}
            className="flare-label rounded-full bg-[image:var(--grad-cta)] px-6 py-2.5 text-sm text-white shadow disabled:opacity-60"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </div>
      </form>

      <p className="text-sm text-[var(--on-gradient-muted)]">
        No account?{" "}
        <Link href="/sign-up" className="font-semibold text-white underline underline-offset-2">
          Create one
        </Link>
      </p>
    </Shell>
  );
}

// ------------------------------------------------------------------ sign up

export function SignUpScreen() {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", email: "", password: "", confirmPassword: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    // Checked here for an immediate answer, and again on the server, which is
    // the check that counts.
    const validated = validateRegistration(form);
    if (!validated.ok) {
      setError(validated.error);
      return;
    }

    setBusy(true);
    try {
      const credential = await createUserWithEmailAndPassword(
        auth,
        validated.value.email,
        validated.value.password,
      );
      const idToken = await credential.user.getIdToken();

      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, username: validated.value.username }),
      });

      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        setError(detail.error ?? "That account could not be created.");
        return;
      }

      await startSession(idToken);
      router.push("/home");
      router.refresh();
    } catch (caught) {
      const code = (caught as { code?: string }).code;
      setError(
        code === "auth/email-already-in-use"
          ? "That email already has an account. Sign in instead."
          : code === "auth/weak-password"
            ? "Choose a longer password."
            : "That account could not be created.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <Back />
      <form onSubmit={submit} className="flare-glass w-full rounded-3xl p-5">
        <div className="flex flex-col gap-3">
          {(
            [
              ["Username", "username", "text", "username"],
              ["Email", "email", "email", "email"],
              ["Password", "password", "password", "new-password"],
              ["Confirm password", "confirmPassword", "password", "new-password"],
            ] as const
          ).map(([label, key, type, complete]) => (
            <label key={key} className="flex flex-col gap-1.5 text-sm text-white">
              <span className="font-semibold">{label}</span>
              <input
                type={type}
                required
                autoComplete={complete}
                value={form[key]}
                onChange={set(key)}
                className={field}
              />
            </label>
          ))}

          {error && <p className="text-sm font-medium text-white">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="flare-label rounded-full bg-[image:var(--grad-cta)] px-6 py-2.5 text-sm text-white shadow disabled:opacity-60"
          >
            {busy ? "Creating…" : "Sign up"}
          </button>
        </div>
      </form>

      <p className="text-sm text-[var(--on-gradient-muted)]">
        Already registered?{" "}
        <Link href="/sign-in" className="font-semibold text-white underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </Shell>
  );
}
