# Export Layout System Documentation

## Overview

The Event Manager now supports FIR-specific export layouts, allowing each FIR (EDMM, EDGG, EDWW) to have its own customized export format and output Google Sheet.

## Features

- **FIR-Specific Layouts**: Each FIR can define its own export layout configuration
- **FIR-Specific Google Sheets**: Each FIR can export to its own dedicated Google Sheet
- **Fallback Mechanism**: If no FIR-specific configuration exists, the system falls back to the default EDMM layout
- **Flexible Configuration**: Layouts can customize headers, station rows, controller blocks, summaries, and formatting

## Configuration

### Environment Variables

Add the following environment variables to your `.env` file:

```env
# Default Google Sheet ID (fallback for all FIRs)
GOOGLE_SHEET_ID=your_default_sheet_id

# FIR-specific Google Sheet IDs (optional)
GOOGLE_SHEET_ID_EDMM=your_edmm_sheet_id
GOOGLE_SHEET_ID_EDGG=your_edgg_sheet_id
GOOGLE_SHEET_ID_EDWW=your_edww_sheet_id
```

**How it works:**
- When exporting an event for a specific FIR, the system first checks for `GOOGLE_SHEET_ID_{FIR_CODE}`
- If not found, it falls back to `GOOGLE_SHEET_ID`
- This allows you to use a single sheet for all FIRs or separate sheets per FIR

### Layout Configuration

Layout configurations are defined in `/config/exportLayouts.ts`.

#### Default Layout (EDMM)

The EDMM layout is the default and includes:
- User detail columns: "Preferred Stations", "Remarks", "Restrictions"
- Endorsement order: GND, TWR, APP, CTR, UNKNOWN
- 30-minute timeslot intervals
- Roboto font family
- Custom header with event name and remarks
- Station rows with staffed stations
- Controller blocks grouped by endorsement
- Summary section with statistics

#### Creating a New Layout

To create a layout for a different FIR (e.g., EDGG):

```typescript
export const EDGGLayout: ExportLayoutConfig = {
  name: "EDGG Layout",
  firCode: "EDGG",
  userDetailColumns: ["Preferred Stations", "Remarks", "Restrictions"],
  endorsementOrder: ["GND", "TWR", "APP", "CTR", "UNKNOWN"],
  timeslotInterval: 30,
  fontFamily: "Arial",
  
  generateHeader: (event, timeslots, currentDate) => {
    // Custom header for EDGG
    return [
      ["", `${event.name} - EDGG`],
      ["", `Stand: ${currentDate}`],
      ["", "Alle Zeiten in UTC"],
      [],
    ];
  },
  
  generateStationRows: (event, timeslots, userDetailColumns) => {
    // Custom station rows logic
    // ...
  },
  
  generateControllerBlocks: (event, timeslots, userDetailColumns, signupsByEndorsement, computedData) => {
    // Custom controller blocks logic
    // ...
  },
  
  generateSummary: (event, timeslots) => {
    // Custom summary logic
    // ...
  },
  
  generateFormatting: (allValues, timeslots, userDetailColumns, signupsByEndorsement, endorsementOrder) => {
    // Custom formatting logic
    // Return array of Google Sheets API formatting requests
    // ...
  }
};
```

Then add it to the registry:

```typescript
export const FIRLayoutRegistry: Record<string, ExportLayoutConfig> = {
  "EDMM": EDMMLayout,
  "EDGG": EDGGLayout,
  "EDWW": EDWWLayout, // If you have one
};
```

## Layout Functions

Each layout can define the following optional functions:

### generateHeader
Generates the header rows for the export.

**Parameters:**
- `event`: ConvertedEvent - The event data
- `timeslots`: string[] - Generated timeslots
- `currentDate`: string - Current date in German format

**Returns:** `string[][]` - Array of rows for the header

### generateStationRows
Generates the station header and data rows.

**Parameters:**
- `event`: ConvertedEvent - The event data
- `timeslots`: string[] - Generated timeslots
- `userDetailColumns`: string[] - Column headers for user details

**Returns:** `string[][]` - Array of rows for stations

### generateControllerBlocks
Generates the controller signup blocks grouped by endorsement.

**Parameters:**
- `event`: ConvertedEvent - The event data
- `timeslots`: string[] - Generated timeslots
- `userDetailColumns`: string[] - Column headers for user details
- `signupsByEndorsement`: Record<string, ConvertedSignup[]> - Signups grouped by endorsement
- `computedData`: Record<number, ComputedUserData> - Computed user data with groups and restrictions

**Returns:** `string[][]` - Array of rows for controller blocks

### generateSummary
Generates the summary section.

**Parameters:**
- `event`: ConvertedEvent - The event data
- `timeslots`: string[] - Generated timeslots

**Returns:** `string[][]` - Array of rows for summary

### generateFormatting
Generates Google Sheets API formatting requests.

**Parameters:**
- `allValues`: string[][] - All generated values
- `timeslots`: string[] - Generated timeslots
- `userDetailColumns`: string[] - Column headers for user details
- `signupsByEndorsement`: Record<string, ConvertedSignup[]> - Signups grouped by endorsement
- `endorsementOrder`: string[] - Order of endorsements

**Returns:** `any[]` - Array of Google Sheets API formatting requests

## Usage

The export system automatically uses the correct layout based on the event's FIR code:

1. User clicks "Zu Sheets synchronisieren" button for an event
2. The export API retrieves the event and its FIR code
3. The system looks up the layout for that FIR code using `getLayoutForFIR(firCode)`
4. If no specific layout exists, it uses the EDMM default layout
5. The system generates the export using the layout's functions
6. Data is written to the FIR-specific Google Sheet (or default sheet if not configured)

## Backward Compatibility

- Events without a FIR code default to EDMM layout
- If no FIR-specific sheet ID is configured, the default `GOOGLE_SHEET_ID` is used
- The current EDMM layout preserves all existing functionality
- No breaking changes to the export API

## Testing

To test the new layout system:

1. Configure environment variables for different FIR sheet IDs
2. Create events for different FIRs (EDMM, EDGG, EDWW)
3. Use the "Zu Sheets synchronisieren" button to export
4. Verify that each FIR's events export to the correct sheet with the correct layout

## Future Enhancements

Possible future improvements:
- UI for configuring layouts without code changes
- Layout templates for common patterns
- Export format selection per event (CSV, Excel, etc.)
- Preview of export before syncing to Google Sheets
