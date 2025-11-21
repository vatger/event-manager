# Event Calendar - Quick Start Guide

## Overview
The Event Calendar is a new feature in the VATGER Event Manager that provides a visual overview of all scheduled events and allows VATGER event leadership to block dates for organization-wide events.

## Accessing the Calendar

1. Log in to the Event Manager admin panel
2. Click on **"Event Calendar"** in the sidebar under "Tools"
3. You'll see the current month with all events displayed

## Features at a Glance

### For All Users

#### View Events
- **Blue boxes** = Scheduled events
- **Red boxes** = Blocked dates (no events should be planned)
- Each event shows the FIR badge (EDMM, EDGG, EDWW)
- Today is highlighted with a blue border

#### Navigate the Calendar
- Click **← →** arrows to move between months
- Click **"Heute"** to jump back to current month
- Calendar automatically loads events for the displayed month

#### View Day Details
1. Click on any day in the calendar
2. A dialog opens showing:
   - All events scheduled for that day (with time and FIR)
   - Any blocked dates affecting that day
   - Option to create a new event

#### Create Event from Calendar
1. Click on the day you want to schedule an event
2. Click **"Event erstellen"** in the dialog
3. Event creation form opens with the date pre-filled
4. Event is created as **DRAFT** status for review
5. Complete the event details and save

### For VATGER Event Leaders Only

#### Block a Date
Use this when you need to prevent FIRs from scheduling events (e.g., for VATGER-wide events).

1. Click **"Datum blockieren"** button in the top right
2. Fill in the form:
   - **Startdatum**: First day to block
   - **Enddatum**: Last day to block
   - **Grund**: Reason for blocking (required, e.g., "VATGER Cross the Pond")
   - **Beschreibung**: Optional additional details
3. Click **"Blockieren"** to save

**Example:**
- Start: 2024-06-15
- End: 2024-06-16
- Reason: "Cross the Pond Event"
- Description: "VATGER-weites Event, keine FIR-Events planen"

#### Delete Blocked Date
1. Click on a day with a red blocked date marker
2. In the dialog, find the blocked date
3. Click **"Löschen"** button
4. Confirm deletion

## Understanding the Display

### Calendar Cell Contents
Each day can show:
- **Date number** (top of cell)
- **Blocked date tags** (red, with ban icon)
- **Event tags** (blue, with FIR badge)
- **"+X weitere"** if more than 2 events on that day

### Legend
- 🟦 Blue = Event scheduled
- 🟥 Red = Date blocked
- Blue border = Today

## Tips & Best Practices

### For Event Teams
- ✅ Check calendar before planning new events
- ✅ Avoid scheduling on blocked dates
- ✅ Use calendar to find available dates
- ✅ Click day to see what's already scheduled

### For VATGER Leaders
- ✅ Block dates well in advance
- ✅ Use clear, descriptive reasons
- ✅ Add details in description field
- ✅ Remove blocks when no longer needed
- ✅ Communicate blocked dates to FIR teams

## Common Workflows

### Planning a New Event
1. Open Event Calendar
2. Navigate to desired month
3. Look for days without conflicts (no red blocks)
4. Click on available day
5. Review existing events for that day
6. Click "Event erstellen"
7. Complete event form (starts as DRAFT)

### Blocking Dates for Major Event
1. Determine event dates
2. Click "Datum blockieren"
3. Enter date range
4. Provide clear reason and details
5. Save
6. Verify blocking appears on calendar

### Reviewing Upcoming Schedule
1. Navigate through next few months
2. Note FIR distribution of events
3. Identify gaps or clusters
4. Plan accordingly

## FAQ

**Q: What happens if I create an event on a blocked date?**
A: Events can still be created on blocked dates, but the visual warning helps teams coordinate. VATGER leadership should review DRAFT events.

**Q: Can I block a single day?**
A: Yes, set both start and end date to the same day.

**Q: Who can see the calendar?**
A: All authenticated admin users can view the calendar.

**Q: Who can block dates?**
A: Only VATGER event leaders (Eventleitung) can block dates.

**Q: What if I need to change a blocked date?**
A: Delete the old block and create a new one with correct dates.

**Q: Do events automatically check for blocked dates?**
A: The calendar provides a visual warning. Event creators should manually check and coordinate with VATGER leadership.

## Troubleshooting

**Calendar not loading events:**
- Refresh the page
- Check your internet connection
- Clear browser cache

**Can't block dates (no button visible):**
- You need VATGER event leader permissions
- Contact system administrator

**Events not showing on calendar:**
- Check event status (DRAFT events show)
- Verify event dates
- Try different month

## Need Help?

If you encounter issues or have questions:
1. Check the calendar display legend
2. Review this quick start guide
3. Contact VATGER event management team
4. Report technical issues to system administrator

## Next Steps

- Explore the calendar for upcoming months
- Familiarize yourself with the interface
- Try creating a test event from calendar
- Review blocked dates for your planning

---

**Version**: 1.0  
**Last Updated**: November 2025  
**Feature Status**: Production Ready
