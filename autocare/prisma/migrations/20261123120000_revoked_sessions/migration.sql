-- Logged-out sign-ins, so "Log out" is final (see lib/session.ts). New table only.
CREATE TABLE "RevokedSession" (
    "sid" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevokedSession_pkey" PRIMARY KEY ("sid")
);

CREATE INDEX "RevokedSession_expiresAt_idx" ON "RevokedSession"("expiresAt");
