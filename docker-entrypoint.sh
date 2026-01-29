#!/bin/sh
set -e

echo "Starting application..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "WARNING: DATABASE_URL is not set. Skipping migrations."
else
  echo "Running Prisma migrations..."
  npx prisma migrate deploy
  echo "Migrations completed successfully."
fi

# Start the application
echo "Starting Node.js server..."
exec node server.js
