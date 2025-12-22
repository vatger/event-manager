#!/bin/bash
# Quick setup script for SQLite development database
# This script helps developers get started quickly without installing MySQL

set -e

# Trap to clean up backup files
cleanup() {
    rm -f .env.bak
}
trap cleanup EXIT

# Helper function for cross-platform sed
update_env_var() {
    local key=$1
    local value=$2
    if grep -q "^${key}=" .env; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i.bak "s|^${key}=.*|${key}=${value}|" .env
        else
            sed -i "s|^${key}=.*|${key}=${value}|" .env
        fi
    else
        echo "${key}=${value}" >> .env
    fi
}

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║   SQLite Test Database Setup for Event Manager          ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from .env.example..."
    cp .env.example .env
else
    echo "✓ .env file already exists"
fi

# Configure for SQLite
echo "⚙️  Configuring .env for SQLite..."
update_env_var "USE_TEST_DB" "true"
update_env_var "DATABASE_URL" "file:./dev.db"

echo "✓ .env configured for SQLite"
echo ""

# Generate Prisma Client
echo "🔨 Generating Prisma Client from SQLite schema..."
npx prisma generate --schema=prisma/schema.sqlite.prisma

# Create database
echo ""
echo "📦 Creating SQLite database..."
npx prisma db push --schema=prisma/schema.sqlite.prisma

# Ask about seeding
echo ""
read -p "❓ Do you want to seed the database with initial data (FIRs, permissions, sample user)? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🌱 Seeding database..."
    npx tsx prisma/seed.ts
    echo "✓ Database seeded successfully!"
fi

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                    ✅ Setup Complete!                     ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "📝 Next steps:"
echo "   1. Configure remaining environment variables in .env"
echo "      (Google Sheets, VATGER API, etc.)"
echo "   2. Run 'npm run dev' to start the development server"
echo "   3. Use 'npx prisma studio --schema=prisma/schema.sqlite.prisma'"
echo "      to visually explore your database"
echo ""
echo "💡 Tip: The database file is 'dev.db' in your project root"
echo "    To reset: rm dev.db && ./scripts/setup-sqlite.sh"
echo ""
