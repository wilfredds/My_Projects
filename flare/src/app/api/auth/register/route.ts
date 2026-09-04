import { NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase/admin";
import { createProfile } from "@/lib/users/provisioning";
import { validateRegistration } from "@/lib/users/registration";

/**
 * Completes a sign-up.
 *
 * The browser creates the Firebase Auth account itself — that is the client
 * SDK's job and it means no password ever reaches this server — then sends
 * the resulting ID token here so the profile document can be written. The
 * token is what proves the caller owns the account it claims: without
 * verifying it, anyone could POST a uid and have a profile created for
 * somebody else's account.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { idToken, username } = (body ?? {}) as { idToken?: unknown; username?: unknown };
  if (typeof idToken !== "string" || !idToken) {
    return NextResponse.json({ error: "missing_token" }, { status: 400 });
  }

  let decoded;
  try {
    decoded = await getAdminAuth().verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  // Re-validated here rather than trusted from the form: the browser's copy
  // decides what the UI says, this one decides what is stored.
  const validated = validateRegistration({
    username,
    email: decoded.email ?? "",
    // The password never leaves the browser, so stand-in values satisfy the
    // shared validator without this endpoint ever seeing a credential.
    password: "x".repeat(12),
    confirmPassword: "x".repeat(12),
  });
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error, field: validated.field }, { status: 400 });
  }

  const created = await createProfile({
    uid: decoded.uid,
    username: validated.value.username,
    email: validated.value.email,
    request,
  });
  if (!created.ok) {
    return NextResponse.json({ error: created.error }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
