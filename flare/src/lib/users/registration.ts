// Validation for the Sign Up screen.
//
// Pure, so `node --test` runs it directly — hence relative imports with
// extensions and no Firebase in sight.

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 32;
export const PASSWORD_MIN = 8;

/** Letters, digits, dot, dash, underscore. Enough for "fo1santos". */
const USERNAME_SHAPE = /^[A-Za-z0-9._-]+$/;

/**
 * Deliberately loose. Anything stricter rejects real addresses — the only
 * check that actually proves an address exists is sending mail to it, and
 * Firebase Auth is what ultimately accepts or refuses it.
 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type RegistrationDraft = {
  username: string;
  email: string;
  password: string;
};

export type RegistrationField = "username" | "email" | "password" | "confirm";

export type RegistrationResult =
  | { ok: true; value: RegistrationDraft }
  | { ok: false; field: RegistrationField; error: string };

export function validateRegistration(input: {
  username?: unknown;
  email?: unknown;
  password?: unknown;
  confirmPassword?: unknown;
}): RegistrationResult {
  const username = str(input.username);
  if (!username) return fail("username", "Choose a username.");
  if (username.length < USERNAME_MIN) {
    return fail("username", `Usernames are at least ${USERNAME_MIN} characters.`);
  }
  if (username.length > USERNAME_MAX) {
    return fail("username", `Usernames are at most ${USERNAME_MAX} characters.`);
  }
  if (!USERNAME_SHAPE.test(username)) {
    return fail("username", "Usernames can use letters, numbers, dots, dashes and underscores.");
  }

  const email = str(input.email).toLowerCase();
  if (!email) return fail("email", "Enter your email address.");
  if (!EMAIL_SHAPE.test(email)) return fail("email", "That does not look like an email address.");

  // Not trimmed: leading and trailing spaces are legitimate password
  // characters, and silently removing them locks people out of an account
  // they can no longer type the password for.
  const password = typeof input.password === "string" ? input.password : "";
  if (!password) return fail("password", "Choose a password.");
  if (password.length < PASSWORD_MIN) {
    return fail("password", `Passwords are at least ${PASSWORD_MIN} characters.`);
  }

  const confirm = typeof input.confirmPassword === "string" ? input.confirmPassword : "";
  if (password !== confirm) return fail("confirm", "The two passwords do not match.");

  return { ok: true, value: { username, email, password } };
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function fail(field: RegistrationField, error: string): RegistrationResult {
  return { ok: false, field, error };
}
