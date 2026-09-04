import type { AuthorizationFailure } from "@/lib/users/profile";

/**
 * What a signed-in account sees when it is not (yet) allowed in.
 *
 * FLARE is restricted to authorized BFP personnel, so holding a valid session
 * is not the same as being admitted: an account waits at "pending" until an
 * administrator approves it, and a suspended one keeps its records but loses
 * access. Both need to be told which of those they are — "nothing happens
 * when I sign in" is the worst possible answer for someone waiting on a
 * human to act.
 */
export function AccountStatusNotice({ reason }: { reason: AuthorizationFailure }) {
  const { title, body } = describe(reason);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-3 px-6">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-muted">{body}</p>
    </main>
  );
}

function describe(reason: AuthorizationFailure): { title: string; body: string } {
  switch (reason) {
    case "pending":
      return {
        title: "Your account is waiting for approval",
        body:
          "FLARE is limited to authorized BFP personnel, so an administrator reviews every registration before it is activated. You will be able to open your training once yours is approved.",
      };
    case "suspended":
      return {
        title: "Your account is suspended",
        body:
          "Your training records are intact, but access is switched off. Contact your unit administrator to have it restored.",
      };
    case "no_profile":
      return {
        title: "This account is not set up yet",
        body:
          "You signed in successfully, but there is no FLARE personnel record attached to this account. Contact your unit administrator.",
      };
    // signed_out and not_admin are handled by redirects before this renders.
    default:
      return {
        title: "You cannot open this page",
        body: "Contact your unit administrator if you think that is wrong.",
      };
  }
}
