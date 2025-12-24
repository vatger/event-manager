# Multi-Airport Event System Implementation

## Overview
This implementation adds comprehensive support for multi-airport events with **automatic airport assignment** based on controller endorsements. Controllers are automatically registered for all airports they can staff, with the ability to opt-out using the `!ICAO` syntax in remarks.

## Key Features

### 1. Event Management
- Events can now have multiple airports instead of just one
- Admin UI with intuitive airport chips/tags for adding/removing airports
- Real-time validation ensures at least one airport is selected
- Utility functions for consistent airport code normalization

### 2. Controller Signup - Automatic Assignment ⭐ NEW
- **Automatic Airport Assignment**: Controllers are automatically registered for ALL airports they can staff based on their endorsements
- **No Manual Selection**: System determines staffable airports automatically by checking endorsements for each airport
- **Opt-Out Mechanism**: Controllers can exclude specific airports by adding `!ICAO` in remarks (e.g., `!EDDM`)
- **Real-Time Validation**: UI shows which airports will be assigned with visual indicators
- selectedAirports field automatically populated based on endorsements and opt-outs

### 3. Signup Display & Statistics
- **Tabbed Interface** for multi-airport events:
  - "All Airports" overview tab with aggregated statistics
  - Individual tabs per airport with filtered signups
- **Per-Airport Statistics**:
  - Total controllers per airport
  - Breakdown by endorsement group (DEL, GND, TWR, APP, CTR)
- Airport badges in signup table
- Automatic signup filtering by selected airport

## How Automatic Assignment Works

### Signup Flow
1. Controller opens signup form
2. System automatically checks endorsements for EACH airport in the event
3. Controller sees real-time feedback:
   - ✓ Green = Will be assigned (has endorsement)
   - ✗ Orange = Opted out (via `!ICAO` in remarks)
   - ○ Gray = Not qualified (no endorsement)
4. Controller can add `!ICAO` in remarks to opt-out of specific airports
5. Final airport list = (endorsed airports) - (opted-out airports)
6. Signup is submitted with automatically calculated airport list

### Example Scenarios

**Scenario 1: Full Assignment**
```
Event Airports: EDDM, EDDN, EDDP
User Endorsements: TWR for all three airports
User Remarks: "Prefer afternoon slots"
Result: Assigned to EDDM, EDDN, EDDP
```

**Scenario 2: Partial Endorsement**
```
Event Airports: EDDM, EDDN, EDDP
User Endorsements: TWR for EDDM and EDDN only
User Remarks: ""
Result: Assigned to EDDM, EDDN (EDDP grayed out - no endorsement)
```

**Scenario 3: Opt-Out**
```
Event Airports: EDDM, EDDN, EDDP
User Endorsements: TWR for all three
User Remarks: "Prefer TWR positions. !EDDN !EDDP"
Result: Assigned to EDDM only
```

### Opt-Out Syntax
Controllers can exclude airports by adding `!ICAO` anywhere in their remarks:
- `!EDDM` - Opt out of Munich
- `!EDDN !EDDP` - Opt out of Nuremberg and Leipzig
- `Prefer afternoon slots. !EDDM` - Mixed content works fine
- Case-sensitive: Must use uppercase ICAO codes

## Technical Implementation

### Database Schema Changes
```prisma
model EventSignup {
  // ... existing fields
  selectedAirports  Json?  // Array of ICAO codes automatically assigned based on endorsements
}
```

### Key Logic

#### Automatic Endorsement Checking
```typescript
// Check endorsements for each airport in the event
for (const airport of eventAirports) {
  const res = await fetch("/api/endorsements/group", {
    method: "POST",
    body: JSON.stringify({
      user: { userCID, rating },
      event: { airport, fir }
    })
  });
  endorsementResults[airport] = !!data.group;
}
```

#### Opt-Out Parsing
```typescript
// Parse !ICAO from remarks
const parseOptOutAirports = (remarks: string): string[] => {
  const optOutPattern = /!([A-Z]{4})/g;
  const matches = remarks.matchAll(optOutPattern);
  return Array.from(matches, m => m[1]);
};
```

#### Final Airport Calculation
```typescript
const getSelectedAirports = (): string[] => {
  const optedOut = parseOptOutAirports(remarks);
  return eventAirports.filter(airport => 
    airportEndorsements[airport] && !optedOut.includes(airport)
  );
};
```

### Updated Components

#### SignupForm - Complete Rework
- **ADDED**: Automatic endorsement checking for all airports
- **ADDED**: Opt-out parsing and visual feedback
- **ADDED**: Real-time airport assignment display
- **ADDED**: Help text explaining automatic assignment
- **REMOVED**: Manual airport selection checkboxes
- **REMOVED**: User airport choice UI

#### AdminEventForm
- Multi-airport input with add/remove functionality
- Visual feedback with airport badges
- Enhanced validation using utility functions

#### SignupsTable
- New "airports" column type
- Airport badges for multi-airport events
- Support for filtered signups from parent component

#### AirportSignupTabs
- Manages tabbed airport view with real-time statistics
- Fetches signup data and filters by airport
- Responsive grid layout adapting to number of airports

### API Updates
- `POST /api/events/[eventId]/signup` - Accepts selectedAirports (auto-calculated)
- `PUT /api/events/[eventId]/signup/[userId]` - Tracks airport changes
- Cache system includes selectedAirports

## Backward Compatibility
- Single-airport events work unchanged (no UI changes for single-airport)
- selectedAirports automatically populated based on endorsements
- UI adapts: automatic assignment info shown only for multi-airport events
- Existing events continue to function normally

## Usage Guide

### For Event Organizers

#### Creating a Multi-Airport Event
1. Navigate to admin event creation form
2. Click the airport input field
3. Enter ICAO code (e.g., "EDDM") and click + button
4. Repeat for all airports (e.g., add EDDN, EDDP)
5. Configure other event details
6. Publish event

### For Controllers

#### Signing Up for Multi-Airport Event
1. Open event page
2. Click "Jetzt anmelden" button
3. See automatic airport assignment:
   - System shows which airports you'll be assigned to
   - Green checkmarks = you'll be assigned
   - Gray circles = not qualified
4. Fill in availability and preferred positions
5. (Optional) Add `!ICAO` in remarks to opt-out:
   - Example: "Prefer TWR. !EDDM" to exclude Munich
6. Submit signup

#### Opting Out of Specific Airports
Add `!ICAO` anywhere in your remarks:
```
Good examples:
- "!EDDM"
- "Prefer afternoon slots. !EDDN"
- "!EDDM !EDDP - only want EDDN"

Won't work:
- "!eddm" (must be uppercase)
- "! EDDM" (no space after !)
```

### For Viewing Signups

1. Navigate to event page
2. Multi-airport events show tabbed interface:
   - Click "Alle Airports" for complete overview
   - Click specific airport tabs (EDDM, EDDN, etc.) for filtered view
3. Statistics shown at top of each tab
4. Airport badges visible in signup table

## Files Modified
- `prisma/schema.prisma` - Added selectedAirports field
- `types/event.ts`, `types/signup.ts` - Updated type definitions
- `lib/cache/types.ts`, `lib/cache/signupTableCache.ts` - Cache updates
- `app/admin/events/_components/AdminEventForm.tsx` - Multi-airport input
- **`components/SignupForm.tsx` - Complete rework with automatic assignment** ⭐
- `components/SignupsTable.tsx` - Airport badges and filtering
- `components/AirportSignupTabs.tsx` - New tabbed interface
- `app/events/[id]/page.tsx` - Integration of new components
- `app/api/events/[eventId]/signup/route.ts` - API updates
- `app/api/events/[eventId]/signup/[userId]/route.ts` - API updates

## Files Created
- `utils/airportUtils.ts` - Airport code utilities
- `components/AirportSignupTabs.tsx` - Tabbed airport interface
- `MULTI_AIRPORT_IMPLEMENTATION.md` - This documentation

## Migration Notes
Database migration required to add the `selectedAirports` field to the `EventSignup` table. Existing signups will have `null` for this field, which is handled gracefully.

```bash
# Generate migration
npx prisma migrate dev --name add_selected_airports

# Or for production
npx prisma migrate deploy
```

## Testing Checklist
- [ ] Create event with single airport (existing behavior)
- [ ] Create event with multiple airports (EDDM, EDDN, EDDP)
- [ ] Edit event airports
- [ ] Controller signup sees automatic airport assignment
- [ ] Test endorsement checking for all airports
- [ ] Test opt-out with `!EDDM` syntax
- [ ] Test multiple opt-outs: `!EDDM !EDDN`
- [ ] View signups in tabbed interface
- [ ] Verify per-airport statistics
- [ ] Test airport filtering in tabs
- [ ] Check responsive design
- [ ] Verify backward compatibility with single-airport events
