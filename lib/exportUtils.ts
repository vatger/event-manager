import { SignupTableEntry } from "./cache/types";
import { parseOptOutAirports } from "./multiAirport";

/**
 * Generate CSV content from signup data
 */
export function generateSignupCSV(
  signups: SignupTableEntry[],
  selectedAirport?: string
): string {
  const headers = selectedAirport
    ? [
        "Name",
        "CID",
        `Group (${selectedAirport})`,
        "Email",
        "Preferred Stations",
        "Remarks",
        "Status",
      ]
    : ["Name", "CID", "Group", "Email", "Preferred Stations", "Remarks", "Airports", "Status"];

  const rows = signups.map((signup) => {
    const optedOut = parseOptOutAirports(signup.remarks || "");
    const isOptedOut = selectedAirport && optedOut.includes(selectedAirport);

    let group = "UNSPEC";
    let airports = "";

    if (selectedAirport) {
      // For airport-specific export, show group for that airport
      const endorsement = signup.airportEndorsements?.[selectedAirport];
      group = endorsement?.group || "UNSPEC";
    } else {
      // For full export, show highest group and all airports
      group = signup.endorsement?.group || signup.user.rating || "UNSPEC";
      
      // List all airports user can staff
      const staffedAirports: string[] = [];
      if (signup.airportEndorsements) {
        Object.entries(signup.airportEndorsements).forEach(([airport, endorsement]) => {
          if (endorsement?.group && !optedOut.includes(airport)) {
            staffedAirports.push(airport);
          }
        });
      }
      airports = staffedAirports.join("|");
    }

    const status = signup.deletedAt
      ? "Deleted"
      : isOptedOut
      ? "Opted Out"
      : "Active";

    return selectedAirport
      ? [
          escapeCsv(signup.user.name),
          signup.user.cid.toString(),
          group,
          escapeCsv(signup.preferredStations || ""),
          escapeCsv(signup.remarks || ""),
          status,
        ]
      : [
          escapeCsv(signup.user.name),
          signup.user.cid.toString(),
          group,
          escapeCsv(signup.preferredStations || ""),
          escapeCsv(signup.remarks || ""),
          airports,
          status,
        ];
  });

  const csvLines = [headers, ...rows];
  return csvLines.map((row) => row.join(",")).join("\n");
}

/**
 * Escape CSV field
 */
function escapeCsv(field: string): string {
  if (!field) return '""';
  
  // If field contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (field.includes(",") || field.includes('"') || field.includes("\n")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  
  return `"${field}"`;
}

/**
 * Generate filename for CSV export
 */
export function generateExportFilename(
  eventName: string,
  selectedAirport?: string
): string {
  const sanitized = eventName.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  const timestamp = new Date().toISOString().split("T")[0];
  const airportSuffix = selectedAirport ? `_${selectedAirport}` : "_all";
  
  return `signups_${sanitized}${airportSuffix}_${timestamp}.csv`;
}
