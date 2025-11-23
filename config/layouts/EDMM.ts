//Layoutkonfiguration für EDMM Export
import { isUserAvailable } from "@/lib/export/exportUtils";
import { ComputedUserData, ConvertedEvent, ConvertedSignup, ExportLayoutConfig } from "@/types/exportLayout";

const userDetailColumns = ["Preferred Stations", "Remarks", "Restrictions"];
const endorsementOrder = ["GND", "TWR", "APP", "CTR", "UNKNOWN"];

export const EDMMLayout: ExportLayoutConfig = {
  name: "EDMM Default Layout",
  firCode: "EDMM",
  userDetailColumns: userDetailColumns,
  endorsementOrder: endorsementOrder,
  timeslotInterval: 30,
  fontFamily: "Roboto",
  
  generateHeader: (event: ConvertedEvent, timeslots: string[], currentDate: string) => {
    return [
      ["", event.name],
      ["", `Remarks: Version 1.0 – ${currentDate} – (${event.startTime!.substring(11, 16)}–${event.endTime!.substring(11, 16)})`],
      ["", "Alle Zeiten in UTC"],
      [],
    ];
  },
  
  generateStationRows: (event: ConvertedEvent, timeslots: string[], userDetailColumns: string[]) => {
    const stationHeader = [
      ["Stationen", ...timeslots, ...userDetailColumns],
    ];
    
    const stationRows = event.staffedStations.map((station: string) => [
      station,
      ...timeslots.map(() => ""),
      ...Array(userDetailColumns.length).fill(""),
    ]);
    
    stationRows.push([]);
    
    return [...stationHeader, ...stationRows];
  },
  
  generateControllerBlocks: (
    event: ConvertedEvent,
    timeslots: string[],
    userDetailColumns: string[],
    signupsByEndorsement: Record<string, ConvertedSignup[]>,
    computedData: Record<number, ComputedUserData>
  ) => {
    const controllerBlocks: string[][] = [];
    
    for (const endorsement of endorsementOrder) {
      const users = signupsByEndorsement[endorsement];
      if (users && users.length > 0) {
        controllerBlocks.push([endorsement, ...timeslots, ...userDetailColumns]);
        
        for (const user of users) {
          const userName = user.user.name;
          const pref = user.preferredStations || "";
          const rmk = user.remarks || "";
          const restr = (computedData[user.userCID]?.restrictions || []).join("; ");
          const userRow = [
            userName,
            ...timeslots.map((timeslot) => (isUserAvailable(user, timeslot) ? "" : "")),
            pref,
            rmk,
            restr
          ];
          
          controllerBlocks.push(userRow);
        }
        
        controllerBlocks.push([]);
      }
    }
    
    return controllerBlocks;
  },
  
  generateSummary: (event: ConvertedEvent, timeslots: string[]) => {
    return [
      ["ZUSAMMENFASSUNG"],
      [`Gesamtanmeldungen: ${event.signups.length}`],
      [`Stations: ${event.staffedStations.length}`],
      [`Zeitslots: ${timeslots.length}`],
    ];
  },
  
  generateFormatting: (
    allValues: string[][],
    timeslots: string[],
    userDetailColumns: string[],
    signupsByEndorsement: Record<string, ConvertedSignup[]>,
    endorsementOrder: string[]
  ) => {
    const headerMergeLength = timeslots.length;
    const headerMergeStartCol = 1;
    const headerMergeEndCol = 1 + headerMergeLength;
    const headerRows = 4; // Header has 4 rows
    const stationHeaderRows = 1;
    const stationDataRows = Object.keys(signupsByEndorsement).length > 0 
      ? (allValues.findIndex(row => endorsementOrder.includes(row[0])) - headerRows - stationHeaderRows)
      : 0;
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const requests: any[] = [
      // Globale Schriftart setzen
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
      // Event-Name mergen
      {
        mergeCells: {
          range: {
            sheetId: 0,
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: headerMergeStartCol,
            endColumnIndex: headerMergeEndCol
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
      // Event-Name Formatierung
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
                fontSize: 20,
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
      // Timeslot-Zellen Formatierung
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
      // User-Detail-Spalten Formatierung
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
      // White background for all cells
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
    
    // Add red background for unavailable cells
    let currentRow = headerRows + stationHeaderRows + stationDataRows;
    
    for (const endorsement of endorsementOrder) {
      const users = signupsByEndorsement[endorsement];
      if (users && users.length > 0) {
        currentRow += 1; // Skip endorsement header
        
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
        currentRow += 1; // Empty row
      }
    }
    
    // Summary bold formatting
    requests.push({
      repeatCell: {
        range: {
          sheetId: 0,
          startRowIndex: allValues.length - 4,
          endRowIndex: allValues.length,
          startColumnIndex: 0,
          endColumnIndex: 1 + timeslots.length + userDetailColumns.length
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
    
    return requests;
  }
};