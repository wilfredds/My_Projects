#!/usr/bin/env bash
#
# Builds a throwaway Postgres database, applies the real schema to it, and runs
# the RLS policy tests against it.
#
#   npm run db:test
#
# Point it somewhere else with TEST_DATABASE_URL:
#
#   TEST_DATABASE_URL=postgres://user@localhost/hiroshi_test npm run db:test
#
# It needs a Postgres you can create databases on — a local install, or
# `docker run -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16`. It does
# NOT need a Supabase project: supabase/local/00-supabase-shim.sql stands in for
# the `auth` schema and the anon/authenticated roles, so the same policies can
# be tested offline, for free, in about a second.
#
# THE DATABASE IS DROPPED AND RECREATED. Never point this at anything real.

set -euo pipefail

DB_NAME="${TEST_DB_NAME:-hiroshi_test}"
DB_URL="${TEST_DATABASE_URL:-}"

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ -z "$DB_URL" ]; then
  # No URL given: assume a local server and a database we may drop.
  psql -d postgres -v ON_ERROR_STOP=1 -q \
    -c "drop database if exists ${DB_NAME};" \
    -c "create database ${DB_NAME};"
  DB_URL="postgres:///${DB_NAME}"
fi

echo "→ applying the Supabase shim (local only)"
psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$here/supabase/local/00-supabase-shim.sql"

echo "→ applying supabase/schema.sql"
psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$here/supabase/schema.sql" 2>&1 \
  | grep -v 'does not exist, skipping' || true

echo "→ running the RLS policy tests"
psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$here/supabase/verify-rls.sql"
