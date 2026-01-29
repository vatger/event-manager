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

# Start Discord bot if DISCORD_BOT_TOKEN is set
if [ -n "$DISCORD_BOT_TOKEN" ]; then
  echo "Starting Discord bot..."
  tsx discord-bot/index.ts &
  DISCORD_BOT_PID=$!
  echo "✓ Discord bot started (PID: $DISCORD_BOT_PID)"
else
  echo "ℹ DISCORD_BOT_TOKEN not set. Discord bot will not start."
fi

# Function to handle shutdown gracefully
shutdown() {
  echo "Shutting down..."
  if [ -n "$DISCORD_BOT_PID" ]; then
    echo "Stopping Discord bot..."
    kill -TERM "$DISCORD_BOT_PID" 2>/dev/null || true
  fi
  exit 0
}

# Trap signals for graceful shutdown
trap shutdown SIGTERM SIGINT

# Start the Next.js application
echo "Starting Node.js server..."
exec node server.js
