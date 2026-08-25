import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { hardenedCookieOptions } from "./cookie-options";
import { publicSupabaseEnv, serviceRoleKey } from "./env";
import type { Database } from "./types";

/**
 * `import "server-only"` at the top is a build-time tripwire: if any file with
 * `"use client"` ever imports this module, the build fails instead of quietly
 * bundling server code — and possibly the service-role key — into the browser.
 */

/**
 * The client for server components, route handlers and server actions.
 *
 * Still the anon key, still fully subject to RLS. What it adds is the session:
 * it reads the auth cookies of the person making the request, so the database
 * knows who is asking and `auth.uid()` returns their id. Without the cookie
 * wiring, every server-side query would look like an anonymous one and the
 * staff policies would all deny.
 */
export async function createClient() {
  const { url, anonKey } = publicSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, hardenedCookieOptions(options));
          }
        } catch {
          /* Server components are not allowed to set cookies. Refreshing the
             session is the middleware's job (milestone 4); swallowing the
             error here is the pattern Supabase documents for this split. */
        }
      },
    },
  });
}

/**
 * The admin client. Uses the service-role key, which **bypasses Row Level
 * Security entirely** — every policy in schema.sql is simply not consulted.
 *
 * Reach for this only where the job genuinely has no user to act as, and where
 * bypassing the policies is the point:
 *
 *   · creating staff accounts (there is deliberately no policy that lets
 *     anyone insert a profile, so nothing else can do it)
 *   · a scheduled cleanup job with no logged-in user
 *
 * Do NOT use it to serve a page "because the query was easier that way". The
 * moment a request is made on behalf of a logged-in person, use `createClient`
 * above and let the database enforce their role. Every use of this function is
 * a place where the security model is switched off and you are the only thing
 * standing in for it.
 */
export function createAdminClient() {
  const { url } = publicSupabaseEnv();

  return createServerClient<Database>(url, serviceRoleKey(), {
    cookies: {
      /* No cookies on purpose. This client must never pick up a visitor's
         session and accidentally act as them with god-mode privileges. */
      getAll: () => [],
      setAll: () => {},
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
