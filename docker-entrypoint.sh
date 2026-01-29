#!/bin/sh
set -e

echo "Starting application..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "WARNING: DATABASE_URL is not set. Skipping migrations."
else
  echo "Running Prisma migrations..."
  if npx prisma migrate deploy; then
    echo "✓ Migrations completed successfully. Database is up to date."
  else
    echo "✗ ERROR: Failed to run migrations. Please check the DATABASE_URL and database connectivity."
    exit 1
  fi
fi

# Start the application
echo "Starting Node.js server..."
exec node server.js
