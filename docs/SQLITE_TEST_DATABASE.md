# Using SQLite Test Database for Development

This guide explains how to use the SQLite test database feature for local development without needing to install MySQL/MariaDB.

## Overview

The Event Manager now supports two database options:

1. **SQLite (Test Database)** - For local development and testing
2. **MySQL/MariaDB** - For production and when you need full MySQL compatibility

## Why SQLite for Development?

- ✅ **No installation required** - SQLite is file-based, no server needed
- ✅ **Quick setup** - Get started in seconds
- ✅ **Portable** - Database is just a file
- ✅ **Perfect for testing** - Easy to reset and recreate
- ✅ **Compatible migrations** - Same migrations work for both SQLite and MySQL

## How to Use SQLite for Development

### 1. Enable SQLite in Your Environment

In your `.env` file, set:

```env
USE_TEST_DB=true
DATABASE_URL=file:./dev.db
```

**Important:** Leave the `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` variables empty or commented out when using SQLite.

### 2. Initialize Your Database

```bash
# Generate Prisma Client from SQLite schema
npx prisma generate --schema=prisma/schema.sqlite.prisma

# Create/update the database
npx prisma db push --schema=prisma/schema.sqlite.prisma
```

This will:
- Create the `dev.db` file in your project root
- Apply the schema to SQLite
- Generate the Prisma Client compatible with SQLite

### 3. Seed the Database (Optional)

Populate your database with initial data:

```bash
npx tsx prisma/seed.ts
```

### 4. Start Development

```bash
npm run dev
```

Your application will now use the SQLite database!

## Switching Between SQLite and MySQL

### To Use SQLite (Development)

```env
USE_TEST_DB=true
DATABASE_URL=file:./dev.db
```

### To Use MySQL/MariaDB (Production)

```env
USE_TEST_DB=false
DATABASE_URL=mysql://user:password@localhost:3306/eventmanager
DB_HOST=localhost
DB_PORT=3306
DB_USER=user
DB_PASSWORD=password
DB_NAME=eventmanager
```

## Working with the Database

### Using SQLite (Development)

When `USE_TEST_DB=true`, always use the `--schema=prisma/schema.sqlite.prisma` flag:

```bash
# Apply schema changes to SQLite
npx prisma db push --schema=prisma/schema.sqlite.prisma

# Regenerate Prisma Client after schema changes
npx prisma generate --schema=prisma/schema.sqlite.prisma

# Open Prisma Studio
npx prisma studio --schema=prisma/schema.sqlite.prisma

# Seed the database
npx tsx prisma/seed.ts
```

**Important:** Always regenerate the Prisma Client from the SQLite schema when using SQLite to ensure adapter compatibility.

### Creating New Migrations (MySQL/Production)

When you need to create a new migration for production:

1. **Update BOTH schema files**:
   - Edit `prisma/schema.prisma` (MySQL schema - main version)
   - Make the **same changes** to `prisma/schema.sqlite.prisma`
   
   **Note:** The only differences between the schemas should be:
   - `provider` field (mysql vs sqlite)
   - JSON columns (MySQL uses `Json` type, SQLite uses `String`)

2. **Create migration with MySQL**:
   ```bash
   # Temporarily switch to MySQL in .env or use a test MySQL instance
   npx prisma migrate dev --name your_migration_name
   ```

3. **Apply to SQLite**:
   ```bash
   # Switch back to SQLite settings
   npx prisma db push --schema=prisma/schema.sqlite.prisma
   npx prisma generate --schema=prisma/schema.sqlite.prisma
   ```

This ensures migrations are created in MySQL format (for production) while keeping SQLite development working.

## Prisma Studio

You can use Prisma Studio to visually inspect and edit your database:

```bash
# For SQLite
npx prisma studio --schema=prisma/schema.sqlite.prisma

# For MySQL
npx prisma studio --schema=prisma/schema.prisma
```

## Resetting Your Database

To completely reset your SQLite database:

```bash
# Delete the database file
rm dev.db dev.db-journal

# Recreate from schema
npx prisma db push --schema=prisma/schema.sqlite.prisma

# Regenerate client
npx prisma generate --schema=prisma/schema.sqlite.prisma

# Optionally seed
npx tsx prisma/seed.ts
```

## Database Files

When using SQLite, you'll see these files in your project:

- `dev.db` - The actual SQLite database
- `dev.db-journal` - SQLite journal file (can be ignored/deleted when database is not in use)

**Add to `.gitignore`:**
```
dev.db
dev.db-journal
```

## Troubleshooting

### "Cannot find module @libsql/client" or adapter errors

Install the required dependencies:

```bash
npm install @prisma/adapter-libsql @libsql/client
```

And make sure you've generated the client from the SQLite schema:

```bash
npx prisma generate --schema=prisma/schema.sqlite.prisma
```

### Migrations fail on SQLite

Migration files are in MySQL format. Use `npx prisma db push` instead of `npx prisma migrate dev` when working with SQLite.

To create new migrations:
1. Temporarily switch to MySQL in your `.env`
2. Run `npx prisma migrate dev --name migration_name`
3. Switch back to SQLite and run `npx prisma db push`

### Runtime Errors

If you get adapter-related errors:

1. Check that `USE_TEST_DB` is set correctly
2. Ensure `DATABASE_URL` matches your choice:
   - SQLite: `file:./dev.db`
   - MySQL: `mysql://...`
3. Run `npx prisma generate` after changing databases

## Technical Details

### How It Works

The system uses different database adapters based on the `USE_TEST_DB` environment variable:

- **When `USE_TEST_DB=true`**: Uses `@prisma/adapter-libsql` with the `@libsql/client` library
- **When `USE_TEST_DB=false`**: Uses `@prisma/adapter-mariadb` with the `mariadb` library

The adapter selection happens in `lib/db-adapter.ts`, which is used by:
- `lib/prisma.ts` - Main application database client
- `prisma/seed.ts` - Database seeding script
- All scripts in `scripts/` directory
- All scripts in `prisma/` directory

### Schema Provider

The `schema.prisma` file specifies `provider = "mysql"` because:
1. Production uses MySQL/MariaDB
2. Migrations are stored in MySQL format for production deployment
3. SQLite development uses `prisma db push` (bypasses migrations)
4. The SQLite adapter handles runtime translation for development

This approach ensures:
- ✅ Production migrations are always MySQL-compatible
- ✅ SQLite can be used for quick local development
- ✅ No risk of SQLite-specific code reaching production
- ✅ Easy switching between databases

## Production Deployment

**Never use SQLite in production!** Always use MySQL/MariaDB for production:

1. Set `USE_TEST_DB=false` in production environment
2. Configure `DATABASE_URL` with your production MySQL connection string
3. Set all `DB_*` variables for the MariaDB adapter
4. Run migrations: `npx prisma migrate deploy`

## Additional Resources

- [Prisma Adapters Documentation](https://www.prisma.io/docs/orm/overview/databases/database-drivers)
- [Prisma SQLite Documentation](https://www.prisma.io/docs/orm/overview/databases/sqlite)
- [Prisma MySQL Documentation](https://www.prisma.io/docs/orm/overview/databases/mysql)
