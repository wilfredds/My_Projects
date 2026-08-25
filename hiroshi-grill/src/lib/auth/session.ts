import "server-only";

import { redirect } from "next/navigation";

import { createClient } from "../supabase/server";
import type { Profile } from "../supabase/types";

/**
 * Who is asking, and what are they allowed to be?
 *
 * ---------------------------------------------------------------------------
 * getUser() vs getSession() — the one that matters
 * ---------------------------------------------------------------------------
 * `getSession()` reads the session out of the cookie and hands it back. It does
 * not check whether the cookie is genuine. On the client that is fine, because
 * the browser is only telling itself what it already believes. On the SERVER it
 * is a hole: the cookie arrives from the network, and anyone can send a cookie.
 *
 * `getUser()` asks the Supabase Auth server to verify the token before
 * answering. It costs a round trip and it is the only one of the two that can
 * be trusted to make an access decision. Server code uses getUser(). Always.
 *
 * ---------------------------------------------------------------------------
 * Being logged in is not the same as being staff
 * ---------------------------------------------------------------------------
 * A verified auth user with no `profiles` row is not crew, host or owner — they
 * are a stranger with an account. The role lives in the database, and it is
 * looked up on every request rather than read from the token, so demoting
 * someone takes effect on their next click instead of whenever their JWT
 * happens to expire.
 */

export type Staff = {
  id: string;
  email: string | null;
  profile: Profile;
};

/** Returns the signed-in staff member, or null. Never throws. */
export async function getStaff(): Promise<Staff | null> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) return null;

    /* The profile read is itself governed by RLS ("read own profile"), so this
       cannot return somebody else's row even if the id were wrong. */
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) return null;

    return { id: user.id, email: user.email ?? null, profile };
  } catch (error) {
    console.error("[auth] could not resolve the current staff member:", error);
    return null;
  }
}

/**
 * Same, but sends non-staff to the sign-in page.
 *
 * This runs in the page itself, even though `proxy.ts` already redirects
 * unauthenticated requests away from /portal/*. That repetition is deliberate.
 * Middleware is a convenience layer — it is easy to leave a path out of the
 * matcher, and Next has shipped more than one bug where a crafted request
 * skipped it. A page that checks for itself does not care.
 *
 * And neither check is the real protection. Even if both were removed, a crew
 * member still could not read a phone number, because Row Level Security
 * decides that in Postgres. These two layers exist to show people a sensible
 * page; the database is what makes the answer safe.
 */
export async function requireStaff(currentPath = "/portal/dashboard"): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) {
    redirect(`/portal?next=${encodeURIComponent(currentPath)}`);
  }
  return staff;
}
