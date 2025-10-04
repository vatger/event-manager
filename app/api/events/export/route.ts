import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Event } from "@prisma/client";
import { google } from "googleapis";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

// Type Definitions basierend auf Ihrem Schema
interface TimeSlot {
  start: string;
  end: string;
}

interface Availability {
  available: TimeSlot[];
  unavailable: TimeSlot[];
}


interface User {
  id: number;
  cid: number;
  name: string;
  rating: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

interface EventSignup {
  id: number;
  eventId: number;
  userCID: number;
  availability: unknown;
  endorsement: string | null;
  breakrequests: string | null;
  preferredStations: string | null;
  remarks: string | null;
  createdAt: Date;
  updatedAt: Date;
  user: User;
}

// Konvertierte Typen für die Anwendung
interface ConvertedSignup {
  id: number;
  eventId: number;
  userCID: number;
  availability: Availability;
  endorsement: string | null;
  breakrequests: string | null;
  preferredStations: string | null;
  remarks: string | null;
  createdAt: Date;
  updatedAt: Date;
  user: User;
}

interface ConvertedEvent {
  id: number;
  name: string;
  description: string;
  bannerUrl: string;
  startTime: string | null;
  endTime: string | null;
  airports: string[];
  signupDeadline: string | null;
  staffedStations: string[];
  status: string;
  createdById: number | null;
  createdAt: Date;
  updatedAt: Date;
  signups: ConvertedSignup[];
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
    endorsement: signupData.endorsement || null,
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

function getUserDetails(user: ConvertedSignup): [string, string] {
  const remarks = user.remarks || "";
  const preferredStations = user.preferredStations || "";
  return [preferredStations, remarks];
}

function formatDateGerman(date: Date): string {
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function isUserAvailable(user: ConvertedSignup, timeslot: string): boolean {
  const [slotStart] = timeslot.split('\n');
  const slotTimeFormatted = `${slotStart.substring(0, 2)}:${slotStart.substring(2, 4)}`;
  const slotTime = new Date(`2025-09-29T${slotTimeFormatted}:00.000Z`);
  
  for (const avail of user.availability.available) {
    const availStart = new Date(`2025-09-29T${avail.start}:00.000Z`);
    const availEnd = new Date(`2025-09-29T${avail.end}:00.000Z`);
    
    if (slotTime >= availStart && slotTime < availEnd) {
      return true;
    }
  }
  return false;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
    if (
      !session || 
      (session.user.role !== "ADMIN" && session.user.role !== "MAIN_ADMIN")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  try {
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
    const sheetId = process.env.GOOGLE_SHEET_ID;

    if (!clientEmail || !privateKey || !sheetId) {
      throw new Error("Missing Google Sheets environment variables");
    }

    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });

    // ===== EVENT DATEN =====
    const { eventId } = await req.json();

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

    // Event konvertieren
    const event = convertEvent(rawEvent);
    const timeslots = generateTimeslots(event.startTime!, event.endTime!, 30);
    const currentDate = formatDateGerman(new Date());
    const userDetailColumns = ["Preferred Stations", "Remarks"];

    // Stations aus den Event-Daten verwenden
    const stations = event.staffedStations;
    
    //Berechnung für zentrierten Header
    const totalColumns = timeslots.length + userDetailColumns.length;
    const headerMergeLength = timeslots.length; // Header soll über die Timeline-Spalten gemergt werden
    const headerMergeStartCol = 1; // Startet bei Spalte B (Index 1)
    const headerMergeEndCol = 1 + headerMergeLength; // Endet nach den Timeslots
    // Header-Bereich
    const header = [
      ["", event.name], // Wird später über die Timeline-Spalten gemergt
      ["", `Remarks: Version 1.0 – ${currentDate} – (${event.startTime!.substring(11, 16)}–${event.endTime!.substring(11, 16)})`],
      ["", "Alle Zeiten in UTC"],
      [], // Leerzeile
    ];

    // Stations-Besetzungsplan mit Timeline-Header
    const stationHeader = [
      ["Stationen", ...timeslots, ...userDetailColumns],
    ];

    const stationRows = stations.map((station: string) => [
      station,
      ...timeslots.map(() => ""),
      ...Array(userDetailColumns.length).fill(""),
    ]);

    stationRows.push([]); // Leerzeile nach Stationsbereich

    // Controller nach Endorsement gruppieren
    const signupsByEndorsement: Record<string, ConvertedSignup[]> = {};
    for (const s of event.signups) {
      const endorsement = s.endorsement || "UNKNOWN";
      if (!signupsByEndorsement[endorsement]) {
        signupsByEndorsement[endorsement] = [];
      }
      signupsByEndorsement[endorsement].push(s);
    }

    // Controller-Blöcke für jedes Endorsement in der gewünschten Reihenfolge
    const controllerBlocks: string[][] = [];
    
    // Definierte Reihenfolge: GND, TWR, APP, CTR
    const endorsementOrder = ["GND", "TWR", "APP", "CTR", "UNKNOWN"];
    
    for (const endorsement of endorsementOrder) {
      const users = signupsByEndorsement[endorsement];
      if (users && users.length > 0) {
        // // Endorsement-Header
        // controllerBlocks.push([endorsement, ...timeslots.map(() => ""), ...userDetailColumns.map(() => "")]);
        controllerBlocks.push([endorsement, ...timeslots, ...userDetailColumns]);
        
        // Nutzer-Zeilen
        for (const user of users) {
          const userName = user.user.name;
          const userDetails = getUserDetails(user);
          const userRow = [
            userName,
            ...timeslots.map((timeslot) => (isUserAvailable(user, timeslot) ? "" : "")),
            ...userDetails
          ];
          
          controllerBlocks.push(userRow);
        }
        
        controllerBlocks.push([]); // Leerzeile nach jedem Endorsement
      }
    }

    // Summary
    const summary = [
      ["ZUSAMMENFASSUNG"],
      [`Gesamtanmeldungen: ${event.signups.length}`],
      [`Stations: ${stations.length}`],
      [`Zeitslots: ${timeslots.length}`],
    ];

    // Alle Werte kombinieren
    const allValues = [
      ...header,
      ...stationHeader,
      ...stationRows,
      ...controllerBlocks,
      ...summary,
    ];

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
    const requests = [
      // Globale Schriftart auf Roboto setzen für alle Zellen
      {
        repeatCell: {
          range: {
            sheetId: 0,
            startRowIndex: 0,
            endRowIndex: allValues.length,
            startColumnIndex: 0,
            endColumnIndex: 1 + timeslots.length + userDetailColumns.length
          },
          cell: {
            userEnteredFormat: {
              textFormat: {
                fontFamily: "Roboto"
              }
            }
          },
          fields: "userEnteredFormat.textFormat.fontFamily"
        }
      },
      // Event-Name mergen (über die Timeline-Spalten)
      {
        mergeCells: {
          range: {
            sheetId: 0,
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: headerMergeStartCol,
            endColumnIndex: headerMergeEndCol // Mergt über Station + alle Timeslots
          }
        }
      },
  
      // Remarks-Zeile mergen
      {
        mergeCells: {
          range: {
            sheetId: 0,
            startRowIndex: 1,
            endRowIndex: 2,
            startColumnIndex: headerMergeStartCol,
            endColumnIndex: headerMergeEndCol
          }
        }
      },
      // "Alle Zeiten in UTC" mergen
      {
        mergeCells: {
          range: {
            sheetId: 0,
            startRowIndex: 2,
            endRowIndex: 3,
            startColumnIndex: headerMergeStartCol,
            endColumnIndex: headerMergeEndCol
          }
        }
      },
      // Event-Name Formatierung (groß, bold, zentriert)
      {
        repeatCell: {
          range: {
            sheetId: 0,
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: headerMergeStartCol,
            endColumnIndex: headerMergeEndCol
          },
          cell: {
            userEnteredFormat: {
              textFormat: {
                fontSize: 20, // Größere Schrift
                bold: true
              },
              horizontalAlignment: "CENTER",
              verticalAlignment: "MIDDLE"
            }
          },
          fields: "userEnteredFormat(textFormat,horizontalAlignment,verticalAlignment)"
        }
      },
      // Remarks Formatierung
      {
        repeatCell: {
          range: {
            sheetId: 0,
            startRowIndex: 1,
            endRowIndex: 2,
            startColumnIndex: headerMergeStartCol,
            endColumnIndex: headerMergeEndCol
          },
          cell: {
            userEnteredFormat: {
              textFormat: {
                fontSize: 11,
                italic: true
              },
              horizontalAlignment: "CENTER",
              verticalAlignment: "MIDDLE"
            }
          },
          fields: "userEnteredFormat(textFormat,horizontalAlignment,verticalAlignment)"
        }
      },
      // "Alle Zeiten in UTC" Formatierung
      {
        repeatCell: {
          range: {
            sheetId: 0,
            startRowIndex: 2,
            endRowIndex: 3,
            startColumnIndex: headerMergeStartCol,
            endColumnIndex: headerMergeEndCol
          },
          cell: {
            userEnteredFormat: {
              textFormat: {
                fontSize: 11,
                italic: true
              },
              horizontalAlignment: "CENTER",
              verticalAlignment: "MIDDLE"
            }
          },
          fields: "userEnteredFormat(textFormat,horizontalAlignment,verticalAlignment)"
        }
      },
      // Stations-Header Formatierung
      {
        repeatCell: {
          range: {
            sheetId: 0,
            startRowIndex: 4,
            endRowIndex: 5
          },
          cell: {
            userEnteredFormat: {
              textFormat: {
                bold: true
              },
              horizontalAlignment: "CENTER"
            }
          },
          fields: "userEnteredFormat(textFormat,horizontalAlignment)"
        }
      },
      // Timeslot-Zellen Textumbruch und Zentrierung
      {
        repeatCell: {
          range: {
            sheetId: 0,
            startRowIndex: 4,
            endRowIndex: allValues.length,
            startColumnIndex: 1,
            endColumnIndex: 1 + timeslots.length
          },
          cell: {
            userEnteredFormat: {
              wrapStrategy: "WRAP",
              horizontalAlignment: "CENTER",
              verticalAlignment: "MIDDLE"
            }
          },
          fields: "userEnteredFormat(wrapStrategy,horizontalAlignment,verticalAlignment)"
        }
      },
      // User-Detail-Spalten linksbündig formatieren
      {
        repeatCell: {
          range: {
            sheetId: 0,
            startRowIndex: 4,
            endRowIndex: allValues.length,
            startColumnIndex: 1 + timeslots.length,
            endColumnIndex: 1 + timeslots.length + userDetailColumns.length
          },
          cell: {
            userEnteredFormat: {
              wrapStrategy: "WRAP",
              horizontalAlignment: "LEFT",
              verticalAlignment: "MIDDLE"
            }
          },
          fields: "userEnteredFormat(wrapStrategy,horizontalAlignment,verticalAlignment)"
        }
      },
      // Endorsement-Überschriften formatieren
      {
        repeatCell: {
          range: {
            sheetId: 0,
            startRowIndex: 4 + stationHeader.length + stationRows.length,
            endRowIndex: allValues.length - summary.length
          },
          cell: {
            userEnteredFormat: {
              textFormat: {
                bold: true
              }
            }
          },
          fields: "userEnteredFormat.textFormat"
        }
      },
      // Weiße Hintergrundfarbe für alle Zellen
      {
        repeatCell: {
          range: {
            sheetId: 0,
            startRowIndex: 0,
            endRowIndex: allValues.length,
            startColumnIndex: 0,
            endColumnIndex: 1 + timeslots.length + userDetailColumns.length
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: {
                red: 1,
                green: 1,
                blue: 1
              }
            }
          },
          fields: "userEnteredFormat.backgroundColor"
        }
      }
    ];

    // Rote Formatierung für N/A-Zellen hinzufügen
    let currentRow = 4 + stationHeader.length + stationRows.length;
    
    for (const endorsement of endorsementOrder) {
      const users = signupsByEndorsement[endorsement];
      if (users && users.length > 0) {
        // Überspringen der Endorsement-Header (1 Zeile)
        currentRow += 1;
        
        // Für jeden Nutzer
        for (const user of users) {
          for (let col = 1; col <= timeslots.length; col++) {
            if (!isUserAvailable(user, timeslots[col - 1])) {
              requests.push({
                repeatCell: {
                  range: {
                    sheetId: 0,
                    startRowIndex: currentRow,
                    endRowIndex: currentRow + 1,
                    startColumnIndex: col,
                    endColumnIndex: col + 1
                  },
                  cell: {
                    userEnteredFormat: {
                      backgroundColor: {
                        red: 1,
                        green: 0.8,
                        blue: 0.8
                      }
                    }
                  },
                  fields: "userEnteredFormat.backgroundColor"
                }
              });
            }
          }
          currentRow += 1;
        }
        currentRow += 1; // Leerzeile
      }
    }

    // Summary Formatierung
    requests.push({
      repeatCell: {
        range: {
          sheetId: 0,
          startRowIndex: allValues.length - 4,
          endRowIndex: allValues.length
        },
        cell: {
          userEnteredFormat: {
            textFormat: {
              bold: true
            }
          }
        },
        fields: "userEnteredFormat.textFormat"
      }
    });

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