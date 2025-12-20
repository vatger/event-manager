# Prisma 7 Upgrade Documentation

This document explains the changes made to upgrade the project to Prisma 7 and how to work with the new configuration.

## What Changed in Prisma 7?

Prisma 7 introduced several breaking changes:

1. **Database adapters are required**: The new "client" engine type requires database-specific adapters
2. **Configuration moved to `prisma.config.ts`**: Database URLs are now configured in this file instead of schema.prisma
3. **No more `url` in schema**: The `url` field in the `datasource` block of schema.prisma is deprecated
4. **Runtime connection via adapters**: PrismaClient instances must be created with an adapter

## Changes Made

### 1. Configuration Files

#### `prisma.config.ts`
- Added `dotenv/config` import to load environment variables
- Uses `env()` helper from `prisma/config` to access DATABASE_URL
- Removed incorrect `migrate` configuration

#### `prisma/schema.prisma`
- Removed deprecated `url` field from datasource block
- Kept `provider = "mysql"` (works for both MySQL and MariaDB)
- Generator remains `prisma-client-js`

### 2. Dependencies

Added new required packages:
```json
{
  "@prisma/adapter-mariadb": "^7.2.0",
  "mariadb": "^3.3.2"
}
```

### 3. PrismaClient Instantiation

All files that create PrismaClient instances now use the MariaDB adapter:

**Before:**
```typescript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
```

**After:**
```typescript
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const config = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 5,
};
const adapter = new PrismaMariaDb(config);
const prisma = new PrismaClient({ adapter });
```

### 4. Environment Variables

The application now supports two approaches for database configuration:

#### Option 1: Individual variables (recommended)
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=myuser
DB_PASSWORD=mypassword
DB_NAME=mydatabase
```

#### Option 2: Connection string
```env
DATABASE_URL="mysql://myuser:mypassword@localhost:3306/mydatabase"
```

**Note:** `DATABASE_URL` is required for Prisma CLI commands (migrate, generate, etc.), while the individual `DB_*` variables are used by the application runtime for the adapter.

## Files Modified

- `prisma.config.ts` - Updated configuration
- `prisma/schema.prisma` - Removed deprecated url field
- `lib/prisma.ts` - Updated to use adapter
- `prisma/seed.ts` - Updated to use adapter
- `prisma/migrationsDelete.ts` - Updated to use adapter
- `prisma/migrationsShow.ts` - Updated to use adapter
- `prisma/importUsersFromSQL.ts` - Updated to use adapter
- `scripts/setMainAdmin.ts` - Updated to use adapter
- `scripts/testEventReminder.ts` - Updated to use adapter
- `package.json` - Added new dependencies
- `.env.example` - Added DATABASE_URL documentation
- Removed `prisma/prisma.config.ts` (duplicate/incorrect file)

## Working with Prisma 7

### Running Prisma CLI commands

Ensure `DATABASE_URL` is set in your `.env` file:

```bash
# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Validate schema
npx prisma validate

# Format schema
npx prisma format

# Open Prisma Studio
npx prisma studio
```

### Creating New Database Scripts

When creating new scripts that need to access the database, use this pattern:

```typescript
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const config = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 5,
};
const adapter = new PrismaMariaDb(config);
const prisma = new PrismaClient({ adapter });

async function main() {
  // Your code here
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

### Application Code

For application code, always import the singleton instance from `lib/prisma.ts`:

```typescript
import { prisma } from "@/lib/prisma";

// Use prisma as usual
const users = await prisma.user.findMany();
```

## Troubleshooting

### Error: "Using engine type 'client' requires either 'adapter' or 'accelerateUrl'"

This error occurs when PrismaClient is instantiated without an adapter. Make sure you're:
1. Installing the adapter packages: `npm install @prisma/adapter-mariadb mariadb`
2. Creating the adapter before PrismaClient
3. Passing the adapter to the PrismaClient constructor

### Error: "Cannot resolve environment variable: DATABASE_URL"

This error occurs when running Prisma CLI commands without DATABASE_URL. Make sure:
1. You have a `.env` file in the project root
2. It contains `DATABASE_URL=mysql://...`
3. The connection string is properly formatted

### TypeScript Errors About Adapter

If you get TypeScript errors about the adapter type:
1. Make sure you've run `npx prisma generate` after updating the schema
2. Restart your TypeScript language server
3. Check that all dependencies are installed

## Benefits of Prisma 7

- **Better performance**: The new client engine is faster and more efficient
- **Smaller bundle sizes**: No Rust binaries in production builds
- **Better edge runtime support**: Works better in serverless/edge environments
- **Type-safe adapters**: Better TypeScript support for database-specific features

## References

- [Prisma 7 Upgrade Guide](https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7)
- [Prisma MariaDB Adapter Documentation](https://www.npmjs.com/package/@prisma/adapter-mariadb)
- [Prisma Configuration Reference](https://www.prisma.io/docs/orm/reference/prisma-config-reference)
