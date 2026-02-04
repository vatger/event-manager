#!/bin/sh
set +e  # Nicht bei Fehlern abbrechen!

echo "========================================="
echo "🔍 Environment Check"
echo "========================================="
echo "Node: $(node --version)"
echo "Working Dir: $(pwd)"
echo ""

# DATABASE_URL Check
if [ -z "$DATABASE_URL" ]; then
  echo "⚠️  WARNING: DATABASE_URL is not set!"
  echo "The app will start, but database operations will fail."
  echo ""
else
  echo "✅ DATABASE_URL: ${DATABASE_URL:0:40}..."
  echo ""
  
  echo "🔄 Attempting database migrations..."
  npx prisma migrate deploy
  
  MIGRATION_EXIT_CODE=$?
  
  if [ $MIGRATION_EXIT_CODE -eq 0 ]; then
    echo "✅ Migrations completed successfully"
  else
    echo "⚠️  WARNING: Migration failed (exit code: $MIGRATION_EXIT_CODE)"
    echo "The app will start anyway, but database schema might be outdated."
    echo "Please check database connection and run migrations manually:"
    echo "  docker exec -it <container> npx prisma migrate deploy"
  fi
fi

echo ""
echo "========================================="
echo "🚀 Starting Next.js Application"
echo "========================================="
exec node server.js