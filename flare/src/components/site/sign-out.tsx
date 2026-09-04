"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

/**
 * Signing out clears both halves of the session: the Firebase Auth session in
 * the browser, and the server's httpOnly cookie. Clearing only the cookie
 * would leave the browser still authenticated to Firebase — able to upload,
 * and silently signed back in on the next visit.
 */
export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleSignOut() {
    setBusy(true);
    try {
      await fetch("/api/auth/session", { method: "DELETE" });
      await signOut(auth);
    } finally {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={busy}
      className="flare-label mx-auto w-full max-w-xs rounded-full bg-[image:var(--grad-cta)] px-6 py-2.5 text-sm text-white shadow disabled:opacity-60"
    >
      {busy ? "Signing out…" : "Log out"}
    </button>
  );
}
