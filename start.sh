#!/bin/sh
set +e

echo "========================================="
echo "🔍 FULL ENVIRONMENT DEBUG"
echo "========================================="
echo "User: $(whoami)"
echo "Shell: $SHELL"
echo "PWD: $(pwd)"
echo ""
echo "--- All ENV variables ---"
env | sort
echo ""
echo "--- Prisma specific ---"
env | grep -i prisma || echo "No PRISMA vars"
echo ""
echo "--- Database specific ---"
env | grep -i database || echo "No DATABASE vars"
echo ""
echo "--- URL specific ---"
env | grep -i url || echo "No URL vars"
echo "========================================="
echo ""

# Migrations nur wenn DATABASE_URL da ist
if [ -n "$DATABASE_URL" ]; then
  echo "✅ Found: DATABASE_URL"
  echo "Value starts with: $(echo $DATABASE_URL | cut -c1-20)..."
  echo ""
  echo "🔄 Trying migration..."
  npx prisma migrate deploy
  echo "Migration exit code: $?"
else
  echo "❌ DATABASE_URL is empty or not set!"
fi

echo ""
echo "🚀 Starting app anyway..."
exec node server.js