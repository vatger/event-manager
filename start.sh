#!/bin/sh
set -e

echo "🔄 Running database migrations..."
node_modules/.bin/prisma migrate deploy

echo "✅ Migrations completed"
echo "🚀 Starting application..."
exec node server.js