import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Event } from "@prisma/client";
import { google } from "googleapis";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { GroupService } from "@/lib/endorsements/groupService";
import { getRatingValue } from "@/utils/ratingToValue";
import { isVatgerEventleitung, userHasFirPermission } from "@/lib/acl/permissions";
import { getLayoutForFIR, getSheetIdForFIR } from "@/config/exportLayouts";
import { formatDateGerman } from "@/lib/export/exportUtils";
import type { 
  TimeSlot, 
  Availability, 
  User, 
  ConvertedSignup, 
  ConvertedEvent,
  ComputedUserData
} from "@/types/exportLayout";

// Type Definitions basierend auf Ihrem Schema
interface EventSignup {
  id: number;
  eventId: number;
  userCID: number;
  availability: unknown;
  breakrequests: string | null;
  preferredStations: string | null;
  remarks: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  user: User;
}

// Type Guards
function isTimeSlot(obj: unknown): obj is TimeSlot {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'start' in obj &&
    'end' in obj &&
    typeof (obj as TimeSlot).start === 'string' &&
    typeof (obj as TimeSlot).end === 'string'
  );
}

function isAvailability(obj: unknown): obj is Availability {
  if (typeof obj !== 'object' || obj === null) return false;
  
  const availability = obj as Record<string, unknown>;
  return (
    'available' in availability &&
    'unavailable' in availability &&
    Array.isArray(availability.available) &&
    Array.isArray(availability.unavailable) &&
    availability.available.every(isTimeSlot) &&
    availability.unavailable.every(isTimeSlot)
  );
}

function isStringArray(obj: unknown): obj is string[] {
  return Array.isArray(obj) && obj.every(item => typeof item === 'string');
}

// Konvertierungsfunktionen
function parseAvailability(availabilityData: unknown): Availability {
  try {
    // Wenn es bereits ein gültiges Availability-Objekt ist
    if (isAvailability(availabilityData)) {
      return availabilityData;
    }
    
    // Wenn es ein String ist, parsen wir es
    if (typeof availabilityData === 'string') {
      const parsed = JSON.parse(availabilityData);
      if (isAvailability(parsed)) {
        return parsed;
      }
    }
    
    // Fallback für ungültige Daten
    console.warn('Invalid availability data, using fallback');
    return { available: [], unavailable: [] };
  } catch (error) {
    console.error('Error parsing availability:', error);
    return { available: [], unavailable: [] };
  }
}

function parseStringArray(data: unknown): string[] {
  try {
    if (isStringArray(data)) {
      return data;
    }
    
    if (typeof data === 'string') {
      const parsed = JSON.parse(data);
      if (isStringArray(parsed)) {
        return parsed;
      }
    }
    
    return [];
  } catch (error) {
    console.error('Error parsing string array:', error);
    return [];
  }
}

function convertSignup(signupData: EventSignup): ConvertedSignup {
  return {
    ...signupData,
    availability: parseAvailability(signupData.availability),
    preferredStations: signupData.preferredStations || null,
    remarks: signupData.remarks || null,
  };
}

function convertEvent(eventData: Event): ConvertedEvent {
  return {
    ...eventData,
    startTime: eventData.startTime.toISOString(),
    endTime: eventData.endTime.toISOString(),
    signupDeadline: eventData.signupDeadline ? eventData.signupDeadline.toISOString() : null,
    airports: parseStringArray(eventData.airports),
    staffedStations: parseStringArray(eventData.staffedStations),
    signups: 'signups' in eventData && Array.isArray(eventData.signups)
      ? eventData.signups.map(convertSignup)
      : [],
  };
}

// Hilfsfunktionen
function generateTimeslots(start: string, end: string, interval = 30): string[] {
  const slots: string[] = [];
  const startDate = new Date(start);
  const endDate = new Date(end);

  let current = new Date(startDate);
  while (current < endDate) {
    const next = new Date(current.getTime() + interval * 60000);
    const startTime = current.toISOString().substring(11, 16).replace(':', '');
    const endTime = next.toISOString().substring(11, 16).replace(':', '');
    slots.push(`${startTime}\n- \n${endTime}`);
    current = next;
  }
  return slots;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  try {
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

    if (!clientEmail || !privateKey) {
      throw new Error("Missing Google Sheets environment variables");
    }

    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });

    // ===== EVENT DATEN =====
    const { eventId, airport: selectedAirport } = await req.json();

    const rawEvent = await prisma.event.findUnique({
      where: { id: parseInt(eventId) },
      include: {
        signups: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!rawEvent) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    //Permission abfrage
    if(!await userHasFirPermission(Number(session.user.cid), rawEvent.firCode!, "event.export") && !await isVatgerEventleitung(Number(session.user.cid))){
      return NextResponse.json({ error: "Unauthorized", message: "User has no permission to export this event (event.export needed)"}, { status: 401 })
    }
    
    // Get FIR-specific layout and sheet ID
    const firCode = rawEvent.firCode || "EDMM";
    const layout = getLayoutForFIR(firCode);
    const sheetId = getSheetIdForFIR(firCode);
    
    if (!sheetId) {
      throw new Error(`Missing Google Sheet ID for FIR ${firCode}. Please configure GOOGLE_SHEET_ID_${firCode} or GOOGLE_SHEET_ID in environment variables.`);
    }
    
    // Event konvertieren
    const event = convertEvent(rawEvent);
    const timeslots = generateTimeslots(event.startTime!, event.endTime!, layout.timeslotInterval);
    const currentDate = formatDateGerman(new Date());
    
    // Determine user detail columns based on whether we're filtering by airport
    const isMultiAirport = Array.isArray(event.airports) && event.airports.length > 1;
    let userDetailColumns = [...layout.userDetailColumns];
    
    if (selectedAirport) {
      // For single airport export, add airport-specific label to Restrictions
      userDetailColumns = userDetailColumns.map(col => 
        col === "Restrictions" ? `Restrictions (${selectedAirport})` : col
      );
      // Remove "Airports" column if present
      userDetailColumns = userDetailColumns.filter(col => col !== "Airports");
    } else if (isMultiAirport) {
      // For multi-airport event "all airports" export, ensure "Airports" column is present
      if (!userDetailColumns.includes("Airports")) {
        userDetailColumns.push("Airports");
      }
    }

    // Compute live group + restrictions via GroupService
    const airport = selectedAirport || (Array.isArray(event.airports) ? (event.airports[0] || "") : "");
    const eventAirports = Array.isArray(event.airports) ? event.airports : [];
    
    // Compute endorsements for all airports if multi-airport and no filter
    const computed = await Promise.all(event.signups.map(async (s) => {
      try {
        if (selectedAirport) {
          // Single airport - get endorsement for that airport only
          const res = await GroupService.getControllerGroup({
            user: { userCID: s.userCID, rating: getRatingValue(s.user.rating) },
            event: { airport: selectedAirport, fir: firCode}
          });
          return { 
            cid: s.userCID, 
            group: res.group || "UNKNOWN", 
            restrictions: res.restrictions,
            airportEndorsements: { [selectedAirport]: res }
          };
        } else if (isMultiAirport) {
          // Multi-airport - get endorsements for all airports
          const airportEndorsements: Record<string, { group?: string; restrictions: string[] }> = {};
          let highestGroup = "UNKNOWN";
          let highestPriority = -1;
          const groupPriority: Record<string, number> = { "DEL": 0, "GND": 1, "TWR": 2, "APP": 3, "CTR": 4 };
          
          for (const apt of eventAirports) {
            const res = await GroupService.getControllerGroup({
              user: { userCID: s.userCID, rating: getRatingValue(s.user.rating) },
              event: { airport: apt, fir: firCode}
            });
            airportEndorsements[apt] = { ...res, group: res.group ?? undefined };
            
            const priority = groupPriority[res.group || ""] || -1;
            if (priority > highestPriority) {
              highestPriority = priority;
              highestGroup = res.group || "UNKNOWN";
            }
          }
          
          return { 
            cid: s.userCID, 
            group: highestGroup,
            restrictions: [],
            airportEndorsements
          };
        } else {
          // Single airport event
          const res = await GroupService.getControllerGroup({
            user: { userCID: s.userCID, rating: getRatingValue(s.user.rating) },
            event: { airport, fir: firCode}
          });
          return { cid: s.userCID, group: res.group || "UNKNOWN", restrictions: res.restrictions };
        }
      } catch {
        return { cid: s.userCID, group: "UNKNOWN", restrictions: [] as string[] };
      }
    }));
    const byCid: Record<number, ComputedUserData> = Object.fromEntries(
      computed.map(r => [r.cid, { ...r, airportEndorsements: Object.fromEntries(
        Object.entries(r.airportEndorsements ?? {}).map(([key, value]) => [String(key), value])
      ) }])
    );

    // Controller nach ermittelter Group gruppieren
    const signupsByEndorsement: Record<string, ConvertedSignup[]> = {};
    for (const s of event.signups) {
      const grp = byCid[s.userCID]?.group || "UNKNOWN";
      if (!signupsByEndorsement[grp]) {
        signupsByEndorsement[grp] = [];
      }
      signupsByEndorsement[grp].push(s);
    }

    // Generate layout-specific sections using the layout configuration
    const header = layout.generateHeader 
      ? layout.generateHeader(event, timeslots, currentDate)
      : [];
      
    const stationRows = layout.generateStationRows
      ? layout.generateStationRows(event, timeslots, userDetailColumns)
      : [];
      
    const controllerBlocks = layout.generateControllerBlocks
      ? layout.generateControllerBlocks(event, timeslots, userDetailColumns, signupsByEndorsement, byCid)
      : [];
      
    const summary = layout.generateSummary
      ? layout.generateSummary(event, timeslots)
      : [];

    // Alle Werte kombinieren
    const allValues = [
      ...header,
      ...stationRows,
      ...controllerBlocks,
      ...summary,
    ];
    
    const totalColumns = timeslots.length + userDetailColumns.length;

    // ===== Daten schreiben =====
    //Komplette Tabelle clearen
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        requests: [
          {
            updateSheetProperties: {
              properties: {
                sheetId: 0,
                gridProperties: {
                  rowCount: 1000, // Setze auf ausreichend Zeilen
                  columnCount: Math.max(50, totalColumns) // Setze auf ausreichend Spalten
                }
              },
              fields: "gridProperties(rowCount,columnCount)"
            }
          }
        ]
      }
    });
    //Alle Merges entfernen
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        requests: [
          {
            unmergeCells: {
              range: {
                sheetId: 0,
                startRowIndex: 0,
                endRowIndex: 1000,
                startColumnIndex: 0,
                endColumnIndex: 1000
              }
            }
          }
        ]
      }
    });
    
    //Alle Werte und Formatierungen entfernen
    await sheets.spreadsheets.values.clear({
      spreadsheetId: sheetId,
      range: "A1:ZZ1000", // Sehr großer Bereich um alles zu clearen
    });
    
    //Auch alle Formatierungen zurücksetzen
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: 0,
                startRowIndex: 0,
                endRowIndex: 1000,
                startColumnIndex: 0,
                endColumnIndex: 1000
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: {
                    red: 1,
                    green: 1,
                    blue: 1
                  },
                  textFormat: {
                    fontFamily: "Arial", // Standard zurücksetzen
                    fontSize: 10,
                    bold: false
                  },
                  horizontalAlignment: "LEFT",
                  verticalAlignment: "BOTTOM"
                }
              },
              fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)"
            }
          }
        ]
      }
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: "A1",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: allValues },
    });

    // ===== Zellformatierung =====
    // Use layout-specific formatting if available
    const requests = layout.generateFormatting
      ? layout.generateFormatting(allValues, timeslots, userDetailColumns, signupsByEndorsement, layout.endorsementOrder)
      : [];

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        requests: requests
      }
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error(err);
    const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

