# Event Calendar Feature

## Overview
The Event Calendar provides a comprehensive overview of upcoming events and date availability for VATGER event teams and leadership. It integrates seamlessly with the existing event management system.

## Features

### For All Users
- **Monthly Calendar View**: Navigate through months to see all scheduled events
- **Event Display**: Events are shown with FIR badges and color coding
- **Day Details**: Click any day to see events and blocked dates
- **Event Creation**: Create new events directly from calendar by selecting a date
- **Responsive Design**: Works on desktop and mobile devices

### For VATGER Event Leaders
- **Date Blocking**: Block dates or date ranges for VATGER-wide events
- **Block Management**: Edit and delete blocked dates
- **Event Coordination**: Prevent FIRs from scheduling events on blocked dates

## Usage

### Viewing the Calendar
1. Navigate to "Event Calendar" in the admin sidebar
2. Use arrow buttons to navigate between months
3. Click "Heute" button to jump to current month
4. Events appear in blue, blocked dates appear in red

### Creating an Event from Calendar
1. Click on any day in the calendar
2. A dialog shows existing events and blocked dates for that day
3. Click "Event erstellen" to create a new event
4. Event form pre-fills with selected date
5. New events start as DRAFT status

### Blocking Dates (VATGER Leaders Only)
1. Click "Datum blockieren" button in header
2. Select start and end dates
3. Enter a reason (required) and optional description
4. Click "Blockieren" to save

### Viewing/Deleting Blocked Dates
1. Click on a day with blocked dates
2. Blocked dates appear in red in the dialog
3. VATGER leaders can click "Löschen" to remove blocks

## Technical Details

### Database Schema
```prisma
model CalendarBlockedDate {
  id          Int      @id @default(autoincrement())
  startDate   DateTime
  endDate     DateTime
  reason      String
  description String?
  createdById Int
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### API Endpoints

#### GET /api/calendar/blocked-dates
Fetch blocked dates, optionally filtered by date range.

**Query Parameters:**
- `start` (optional): ISO date string for range start
- `end` (optional): ISO date string for range end

**Response:** Array of blocked date objects

#### POST /api/calendar/blocked-dates
Create a new blocked date. Requires VATGER event leader permission.

**Request Body:**
```json
{
  "startDate": "2024-01-01T00:00:00.000Z",
  "endDate": "2024-01-03T23:59:59.999Z",
  "reason": "VATGER-weites Event",
  "description": "Optional additional info"
}
```

#### DELETE /api/calendar/blocked-dates/[id]
Delete a blocked date. Requires VATGER event leader permission.

#### PATCH /api/calendar/blocked-dates/[id]
Update a blocked date. Requires VATGER event leader permission.

**Request Body:** (all fields optional)
```json
{
  "startDate": "2024-01-01T00:00:00.000Z",
  "endDate": "2024-01-03T23:59:59.999Z",
  "reason": "Updated reason",
  "description": "Updated description"
}
```

### Components

**Main Component:** `app/admin/event-calendar/page.tsx`
- Monthly calendar grid
- Event and blocked date display
- Navigation controls
- Dialogs for interactions

**Integration Points:**
- `app/admin/events/create/page.tsx` - Accepts `?date=YYYY-MM-DD` parameter
- `app/admin/events/_components/AdminEventForm.tsx` - Pre-fills date from `initialDate` prop
- `/api/events` - Fetches events for calendar display

### Permissions
- Viewing calendar: All authenticated admin users
- Creating events: Users with `event.create` permission in their FIR
- Blocking dates: Only VATGER event leaders (`isVatgerEventleitung()`)

### Styling
- Follows existing UI design patterns
- Uses shadcn/ui components (Card, Button, Dialog, etc.)
- Responsive grid layout
- Color coding: Blue for events, Red for blocked dates
- Dark mode support

## Database Migration

Run the migration to create the CalendarBlockedDate table:

```bash
npx prisma migrate deploy
```

Or in development:

```bash
npx prisma migrate dev
```

## Future Enhancements

Potential improvements for future iterations:
- Week view option
- Export calendar to iCal format
- Email notifications for blocked dates
- Bulk date blocking
- Recurring blocked dates
- Filter events by FIR in calendar view
- Integration with external calendar systems
