"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { handleLogin } from "@/lib/auth/login";
import { checkLoginRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

/**
 * Sign-in runs on the SERVER, and that is a deliberate choice with a cost.
 *
 * The easy version is `supabase.auth.signInWithPassword()` straight from the
 * browser. It is fewer moving parts and Supabase supports it. But it means the
 * browser talks to Supabase directly, and our server never sees the attempt —
 * so there is nowhere to put a rate limit. Spec §6 asks for one on the login
 * endpoint, and you cannot limit a request that does not pass through you.
 *
 * Routing it through a server action puts our code back in the path, at the
 * price of one extra hop. Supabase Auth has its own limits as a backstop, but
 * they are theirs to tune, not ours.
 */

export type LoginState = { error: string | null };

export async function signInAction(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const next = formData.get("next");

  const result = await handleLogin(
    {
      email: formData.get("email"),
      password: formData.get("password"),
    },
    typeof next === "string" ? next : null,
    {
      rateLimit: async (email) => checkLoginRateLimit(await headers(), email),
      signIn: async ({ email, password }) => {
        const supabase = await createClient();
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          /* Returning false rather than rethrowing keeps the caller on the one
             generic message. Supabase's own text distinguishes "invalid login
             credentials" from other failures, and passing that through would
             leak exactly what we are trying not to say. */
          console.error("[login] supabase rejected the credentials:", error.message);
          return false;
        }
        return true;
      },
    },
  );

  if (!result.ok) {
    return { error: result.message };
  }

  /* redirect() throws a control-flow signal, so it must be outside the try
     blocks above — otherwise a catch would swallow it and the user would sit on
     the login page after a successful sign-in. */
  redirect(result.redirectTo);
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/portal");
}
