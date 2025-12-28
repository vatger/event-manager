# Multi-Airport Utilities - Server/Client Separation

## Problem
The original implementation had server-side code (using `GroupService` and database access) mixed with client-safe utilities in the same file. This caused the error "Module not found: Can't resolve 'fs'" when client components tried to import these utilities.

## Solution
Separated utilities into two distinct files:

### 1. `selectedAirportsUtils.ts` (Client-Safe)
- Contains ONLY utilities that can be safely imported by client components
- No database access, no Node.js modules
- Exports: `getSelectedAirportsForDisplay()`

### 2. `selectedAirportsUtils.server.ts` (Server-Only)
- Contains utilities that use server-side modules (GroupService, database)
- Should ONLY be imported by server-side code (API routes, cache layer)
- Exports: `computeSelectedAirports()`, `computeSelectedAirportsSync()`

### 3. `index.ts` (Client-Safe Exports Only)
- Only re-exports client-safe utilities
- Client components can safely import from `@/lib/multiAirport`
- Server code must explicitly import from `.server.ts` files

## Import Rules

### ✅ Client Components (use `@/lib/multiAirport`)
```typescript
import {
  parseEventAirports,
  parseOptOutAirports,
  fetchAirportEndorsements,
  getSelectedAirportsForDisplay,
  // ... other client-safe utilities
} from "@/lib/multiAirport";
```

### ✅ Server Code (use explicit .server.ts imports)
```typescript
import { 
  computeSelectedAirports,
  computeSelectedAirportsSync 
} from "@/lib/multiAirport/selectedAirportsUtils.server";
```

### ❌ NEVER do this in client components
```typescript
// This will cause "Can't resolve 'fs'" error!
import { computeSelectedAirports } from "@/lib/multiAirport/selectedAirportsUtils.server";
```

## Files Changed
- `lib/multiAirport/selectedAirportsUtils.ts` - Now client-safe only
- `lib/multiAirport/selectedAirportsUtils.server.ts` - NEW, server-only functions
- `lib/multiAirport/index.ts` - Only exports client-safe utilities
- `lib/cache/signupTableCache.ts` - Updated to import from .server.ts

## Client Components (verified safe)
- `components/SignupForm.tsx` ✅
- `components/SignupsTable.tsx` ✅
- `components/AirportSignupTabs.tsx` ✅

## Server-Side Code (using .server.ts)
- `lib/cache/signupTableCache.ts` ✅
