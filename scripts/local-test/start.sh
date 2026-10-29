#!/bin/bash
# Lokaler Testmodus: SQLite, Testnutzer, keine externen Schnittstellen.
# Aufruf: npm run dev:local            (Datenbank behalten)
#         npm run dev:local -- --reset (Datenbank neu anlegen)
# Siehe docs/LOCAL_TEST_MODE.md
set -euo pipefail
cd "$(dirname "$0")/../.."

DB_FILE="local-test.db"

export LOCAL_TEST_MODE=true
export USE_TEST_DB=true
export DATABASE_URL="file:./${DB_FILE}"
export NEXTAUTH_URL="${LOCAL_TEST_URL:-http://localhost:3000}"
export NEXTAUTH_SECRET="local-test-mode-only"
export MAIN_ADMIN_CIDS="1000001"
# Wird von lib/localTest/offlineFetch.ts beantwortet, nicht wirklich aufgerufen
export S1_THEORY_ROSTER_URL="http://s1-roster.local-test/roster/"
export S1_THEORY_ROSTER_TOKEN="local-test"
export NEXT_TELEMETRY_DISABLED=1
# Werte aus einer vorhandenen .env, die hier nichts zu suchen haben
export DEV_MODE=false
export EMBED_CROSS_SITE_COOKIES=false
unset VATGER_BOOKING_API VATGER_EVENT_BOOKING_CID GOOGLE_CLIENT_EMAIL GOOGLE_PRIVATE_KEY || true

if [[ "${1:-}" == "--reset" ]]; then
  rm -f "${DB_FILE}" "${DB_FILE}-journal"
fi

echo "Prisma-Client für SQLite erzeugen …"
npx prisma generate --schema=prisma/schema.sqlite.prisma >/dev/null

if [[ ! -f "${DB_FILE}" ]]; then
  echo "Datenbank ${DB_FILE} anlegen …"
  npx prisma db push --schema=prisma/schema.sqlite.prisma >/dev/null
  npx tsx prisma/seed.ts
  npx tsx scripts/local-test/seed.ts
else
  echo "Schema von ${DB_FILE} abgleichen …"
  npx prisma db push --schema=prisma/schema.sqlite.prisma >/dev/null
fi

echo
echo "Lokaler Testmodus: ${NEXTAUTH_URL}/auth/signin"
echo "Achtung: Der Prisma-Client ist jetzt der SQLite-Client. Für MySQL danach"
echo "  npx prisma generate --schema=prisma/schema.prisma"
echo
# Nur lokal erreichbar – im Testmodus kann sich jeder als jeder anmelden
exec npx next dev --turbopack -H 127.0.0.1 -p "${LOCAL_TEST_PORT:-3000}"
