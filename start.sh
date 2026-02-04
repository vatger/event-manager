#!/bin/sh
set -e

echo "🔄 Running database migrations..."
prisma migrate deploy

echo "✅ Migrations completed"
echo "🚀 Starting application..."
exec node server.js