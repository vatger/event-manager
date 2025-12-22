# Multi-Airport Event System Implementation

## Overview
This implementation adds comprehensive support for multi-airport events, allowing event organizers to create events spanning multiple airports (e.g., EDDM, EDDN, EDDP for a FIR München evening event).

## Key Features

### 1. Event Management
- Events can now have multiple airports instead of just one
- Admin UI with intuitive airport chips/tags for adding/removing airports
- Real-time validation ensures at least one airport is selected
- Utility functions for consistent airport code normalization

### 2. Controller Signup
- Controllers can select which airports they can staff
- Clean checkbox interface for multi-airport events
- Validation ensures at least one airport selection for multi-airport events
- selectedAirports field tracks airport capabilities per signup

### 3. Signup Display & Statistics
- **Tabbed Interface** for multi-airport events:
  - "All Airports" overview tab with aggregated statistics
  - Individual tabs per airport with filtered signups
- **Per-Airport Statistics**:
  - Total controllers per airport
  - Breakdown by endorsement group (DEL, GND, TWR, APP, CTR)
- Airport badges in signup table
- Automatic signup filtering by selected airport

## Technical Implementation

### Database Schema Changes
```prisma
model EventSignup {
  // ... existing fields
  selectedAirports  Json?  // Array of ICAO codes the user can staff
}
```

### New Components

#### AirportSignupTabs (`components/AirportSignupTabs.tsx`)
- Manages tabbed airport view with real-time statistics
- Fetches signup data and filters by airport
- Responsive grid layout adapting to number of airports

#### Utility Functions (`utils/airportUtils.ts`)
- `normalizeAirportCode(code: string): string` - Trim and uppercase
- `isValidAirportCode(code: string): boolean` - Validate ICAO format
- `normalizeSelectedAirports(airports: unknown): string[]` - Safe array normalization

### Updated Components

#### AdminEventForm
- Multi-airport input with add/remove functionality
- Visual feedback with airport badges
- Enhanced validation using utility functions

#### SignupForm
- Conditional airport selection checkboxes
- Auto-selects all airports for backward compatibility
- Validation for multi-airport events

#### SignupsTable
- New "airports" column type
- Airport badges for multi-airport events
- Support for filtered signups from parent component

### API Updates
- `POST /api/events/[eventId]/signup` - Accepts selectedAirports
- `PUT /api/events/[eventId]/signup/[userId]` - Tracks airport changes
- Cache system updated to include selectedAirports

## Backward Compatibility
- Single-airport events work unchanged
- selectedAirports defaults to all event airports if not specified
- UI adapts: tabs shown only for multi-airport events
- Existing events continue to function normally

## Usage Example

### Creating a Multi-Airport Event
1. Navigate to event creation form
2. Add multiple airports using the airport input
3. Configure staffed stations (uses first airport)
4. Set event details and publish

### Controller Signup
1. View event with multiple airports
2. Select desired airports from checkbox list
3. Set availability and preferred positions
4. Submit signup

### Viewing Signups
1. Event page shows tabbed interface for multi-airport events
2. "All Airports" tab shows complete overview
3. Individual airport tabs show filtered signups
4. Statistics displayed per airport and per group

## Files Modified
- `prisma/schema.prisma` - Added selectedAirports field
- `types/event.ts`, `types/signup.ts` - Updated type definitions
- `lib/cache/types.ts`, `lib/cache/signupTableCache.ts` - Cache updates
- `app/admin/events/_components/AdminEventForm.tsx` - Multi-airport input
- `components/SignupForm.tsx` - Airport selection UI
- `components/SignupsTable.tsx` - Airport badges and filtering
- `components/AirportSignupTabs.tsx` - New tabbed interface
- `app/events/[id]/page.tsx` - Integration of new components
- `app/api/events/[eventId]/signup/route.ts` - API updates
- `app/api/events/[eventId]/signup/[userId]/route.ts` - API updates

## Files Created
- `utils/airportUtils.ts` - Airport code utilities
- `components/AirportSignupTabs.tsx` - Tabbed airport interface

## Migration Notes
Database migration required to add the `selectedAirports` field to the `EventSignup` table. Existing signups will have `null` for this field, which is handled gracefully by defaulting to all event airports.

```bash
# Generate migration
npx prisma migrate dev --name add_selected_airports

# Or for production
npx prisma migrate deploy
```

## Testing Checklist
- [ ] Create event with single airport (existing behavior)
- [ ] Create event with multiple airports (new feature)
- [ ] Edit event airports
- [ ] Controller signup for multi-airport event
- [ ] View signups in tabbed interface
- [ ] Verify statistics accuracy
- [ ] Test airport filtering
- [ ] Check responsive design
- [ ] Verify backward compatibility
