#!/bin/sh
set +e

echo "========================================="
echo "🚀 Starting Application"
echo "========================================="

# Database Migration
if [ -n "$DATABASE_URL" ]; then
  echo "✅ DATABASE_URL is configured"
  echo "🔄 Running database migrations..."
  
  npx prisma migrate deploy
  
  if [ $? -eq 0 ]; then
    echo "✅ Migrations completed successfully"
  else
    echo "⚠️  WARNING: Migrations failed"
    echo "   The application will start anyway."
    echo "   Check database connection and schema."
  fi
else
  echo "⚠️  WARNING: DATABASE_URL not set"
  echo "   Skipping migrations."
fi

echo ""
echo "========================================="
echo "🌐 Starting Next.js Server on port 8000"
echo "========================================="

exec node server.js