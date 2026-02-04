#!/bin/sh
set +e

echo "🔍 Starting application..."

if [ -n "$DATABASE_URL" ]; then
  echo "✅ DATABASE_URL found"
  echo "🔄 Running migrations..."
  
  # Direkt die binary nutzen, NICHT npx!
  node_modules/.bin/prisma migrate deploy || \
  echo "⚠️  Migration failed - continuing anyway"
else
  echo "⚠️  DATABASE_URL not set - skipping migrations"
fi

echo "🚀 Starting server..."
exec node server.js