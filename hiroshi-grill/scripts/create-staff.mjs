#!/usr/bin/env node
/**
 * Creates a staff account.
 *
 *   node scripts/create-staff.mjs <email> <crew|host|owner> "Full Name"
 *
 * WHY THIS IS A SCRIPT AND NOT A SIGN-UP PAGE
 *
 * Spec §6, least privilege: staff accounts are created by the owner, and no
 * public route creates a host or an owner. That rule is enforced in the
 * database, not here — `schema.sql` deliberately writes NO insert policy on
 * `profiles`, so there is no request any browser can make, with any key it can
 * obtain, that grants anyone a role. Not "the button is hidden": there is no
 * door.
 *
 * The consequence is that creating staff has to happen outside that model, with
 * the service-role key, which bypasses RLS. That is what this script is: the
 * one deliberate, offline, human-run exception. Run it from your own machine,
 * never from a deployed route.
 *
 * Before running, in the Supabase dashboard:
 *   Authentication → Providers → Email → turn OFF "Enable sign ups"
 * Otherwise anyone can create a login. They would land with no profile row and
 * therefore no access to anything (that is the second layer working), but there
 * is no reason to let strangers fill your auth table.
 */

import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

/* Read .env.local by hand — this is a plain node script, so there is no Next.js
   around to load it for us. */
function loadEnv(file = ".env.local") {
  try {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    /* No .env.local — fall through to the check below. */
  }
}

const ROLES = ["crew", "host", "owner"];

async function main() {
  loadEnv();

  const [email, role, ...nameParts] = process.argv.slice(2);
  const fullName = nameParts.join(" ").trim();

  if (!email || !ROLES.includes(role)) {
    console.error("Usage: node scripts/create-staff.mjs <email> <crew|host|owner> \"Full Name\"");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
        "Copy .env.example to .env.local and fill them in.",
    );
    process.exit(1);
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  /* A generated password beats one you invent. 24 random bytes is far past
     anything brute-forceable, and because it is printed once and then only
     known to the person you hand it to, nobody is tempted to reuse a password
     they already use elsewhere. */
  const password = randomBytes(24).toString("base64url");

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName || null },
  });

  if (createError) {
    console.error(`Could not create the auth user: ${createError.message}`);
    process.exit(1);
  }

  const userId = created.user.id;

  /* Second step, and the one that actually grants access. An auth user with no
     profile row can log in and see precisely nothing — `staff_role()` returns
     NULL and every staff policy denies. The role is granted here or nowhere. */
  const { error: profileError } = await admin
    .from("profiles")
    .insert({ id: userId, full_name: fullName || null, role });

  if (profileError) {
    console.error(`Auth user created but the profile insert failed: ${profileError.message}`);
    console.error(`Clean up with: delete the user ${userId} in the Supabase dashboard.`);
    process.exit(1);
  }

  console.log(`\nCreated ${role} account for ${email}`);
  console.log(`  user id:           ${userId}`);
  console.log(`  temporary password: ${password}`);
  console.log(
    "\nHand that password over in person or by a channel you trust, and have\n" +
      "them change it on first sign-in. It is not stored anywhere and will not\n" +
      "be shown again.\n",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
