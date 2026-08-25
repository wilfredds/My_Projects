"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { signInAction, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

export function SignInForm({ next }: { next: string }) {
  const [state, formAction] = useActionState(signInAction, initialState);

  /**
   * The email is a controlled input purely so it survives a failed attempt.
   *
   * React resets a form after its action completes, which meant a mistyped
   * password wiped the email too and staff retyped their address on every
   * retry. Holding it in state keeps it through the re-render.
   *
   * The password is deliberately left uncontrolled, so it DOES clear. Nobody
   * wants a wrong password sitting in the box waiting to be submitted again,
   * and it is one less place for it to linger.
   */
  const [email, setEmail] = useState("");

  return (
    <form action={formAction} className="w-full max-w-sm">
      {/* Carried through the form rather than read from the URL on submit, so
          the value the server validates is the one that was on the page when it
          rendered. `safeRedirectPath` refuses anything outside /portal. */}
      <input type="hidden" name="next" value={next} />

      <div className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-sumi">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-lg border border-paper-edge bg-white/70 px-3.5 py-2.5 text-sumi focus:border-lacquer focus:outline-none"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-sumi">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            /* current-password lets a password manager offer the saved one, and
               keeps it from being confused with a new-password field. */
            autoComplete="current-password"
            required
            className="w-full rounded-lg border border-paper-edge bg-white/70 px-3.5 py-2.5 text-sumi focus:border-lacquer focus:outline-none"
          />
        </div>
      </div>

      {/* One message for every kind of failure — see login.ts. Announced
          politely so a screen reader hears it without losing the cursor. */}
      <div aria-live="polite" className="mt-4 empty:mt-0">
        {state.error ? (
          <p className="rounded-lg border border-lacquer bg-lacquer/10 px-4 py-3 text-sm text-sumi">
            {state.error}
          </p>
        ) : null}
      </div>

      <SubmitButton />

      <p className="mt-6 text-center text-sm text-sumi-muted">
        Staff accounts are created by the owner. There is no sign-up.
      </p>
      <p className="mt-2 text-center text-sm">
        <Link href="/" className="text-lacquer underline underline-offset-4 hover:text-lacquer-deep">
          Back to the site
        </Link>
      </p>
    </form>
  );
}

function SubmitButton() {
  /* useFormStatus has to live in a child of the form — it reads the status of
     the form above it, so calling it in SignInForm would always report idle. */
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-6 w-full rounded-full bg-lacquer px-6 py-3 text-sm font-semibold text-paper transition-colors hover:bg-lacquer-deep disabled:opacity-60"
    >
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}
