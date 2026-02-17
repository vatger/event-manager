import { prisma } from "@/lib/prisma";
import { canStaffStation, parseStationGroup } from "./stationUtils";

/**
 * Results of staffing feasibility check
 */
export interface StaffingCheckResult {
  isFeasible: boolean;
  totalSignups: number;
  requiredStations: number;
  reasons: string[];
  unstaffableStations: string[];
  conflicts: Array<{
    station1: string;
    station2: string;
    reason: string;
  }>;
}

/**
 * Checks if a complete roster can be assembled for a weekly event occurrence
 * 
 * Rules:
 * 1. Each station must be fillable by at least one signed-up controller
 * 2. No controller should need to be double-booked (assigned to multiple stations simultaneously)
 * 
 * @param occurrenceId - The ID of the weekly event occurrence
 * @returns StaffingCheckResult indicating if roster is feasible and why
 */
export async function checkStaffingFeasibility(
  occurrenceId: number
): Promise<StaffingCheckResult> {
  // Fetch occurrence with config and signups
  const occurrence = await prisma.weeklyEventOccurrence.findUnique({
    where: { id: occurrenceId },
    include: {
      config: {
        include: {
          fir: true,
        },
      },
      signups: {
        include: {
          user: true,
        },
      },
    },
  });

  if (!occurrence) {
    throw new Error(`Occurrence ${occurrenceId} not found`);
  }

  // Parse staffed stations from JSON
  let staffedStations: string[] = [];
  try {
    staffedStations = occurrence.config.staffedStations
      ? (typeof occurrence.config.staffedStations === "string"
          ? JSON.parse(occurrence.config.staffedStations)
          : occurrence.config.staffedStations)
      : [];
  } catch (e) {
    console.error("Error parsing staffedStations:", e);
  }

  if (staffedStations.length === 0) {
    // No stations to staff - always feasible
    return {
      isFeasible: true,
      totalSignups: occurrence.signups.length,
      requiredStations: 0,
      reasons: ["No stations require staffing"],
      unstaffableStations: [],
      conflicts: [],
    };
  }

  const reasons: string[] = [];
  const unstaffableStations: string[] = [];
  const conflicts: Array<{ station1: string; station2: string; reason: string }> = [];

  // Get endorsement data for all signed-up users
  // We need to dynamically calculate which stations each user can staff
  const userStationCapabilities = new Map<number, Set<string>>();

  // Parse airports from config for endorsement checking
  let airports: string[] = [];
  try {
    airports = occurrence.config.airports
      ? (typeof occurrence.config.airports === "string"
          ? JSON.parse(occurrence.config.airports)
          : occurrence.config.airports)
      : [];
  } catch (e) {
    console.error("Error parsing airports:", e);
  }

  // Fetch cached endorsements for all users
  const { getCachedWeeklySignups } = await import("@/lib/cache/weeklySignupCache");
  const enrichedSignups = await getCachedWeeklySignups(occurrenceId);

  // Build capability map: which users can staff which stations
  for (const signup of enrichedSignups) {
    const userCID = signup.userCID;
    const endorsementGroup = signup.endorsementGroup;

    if (!endorsementGroup) {
      // User has no endorsement, can't staff anything
      continue;
    }

    const capabilities = new Set<string>();

    // Check each station to see if user can staff it
    for (const station of staffedStations) {
      const stationGroup = parseStationGroup(station);
      if (stationGroup && canStaffStation(endorsementGroup, stationGroup)) {
        capabilities.add(station);
      }
    }

    userStationCapabilities.set(userCID, capabilities);
  }

  // Check 1: Can each station be staffed by at least one controller?
  for (const station of staffedStations) {
    let canStaff = false;

    for (const [userCID, capabilities] of userStationCapabilities.entries()) {
      if (capabilities.has(station)) {
        canStaff = true;
        break;
      }
    }

    if (!canStaff) {
      unstaffableStations.push(station);
      reasons.push(`Station ${station} cannot be staffed by any signed-up controller`);
    }
  }

  // Check 2: Greedy assignment to detect if roster is possible without double-booking
  // We'll use a simple greedy algorithm: assign users to stations in order
  // If we can assign all stations without conflicts, roster is feasible
  const assignedStations = new Set<string>();
  const assignedUsers = new Set<number>();
  const stationsToAssign = [...staffedStations];

  // Sort stations by difficulty (higher groups first - harder to staff)
  stationsToAssign.sort((a, b) => {
    const groupA = parseStationGroup(a);
    const groupB = parseStationGroup(b);
    const order = ["DEL", "GND", "TWR", "APP", "CTR"];
    const indexA = groupA ? order.indexOf(groupA) : -1;
    const indexB = groupB ? order.indexOf(groupB) : -1;
    return indexB - indexA; // Descending order (CTR first)
  });

  for (const station of stationsToAssign) {
    let assigned = false;

    // Find an available user who can staff this station
    for (const [userCID, capabilities] of userStationCapabilities.entries()) {
      if (!assignedUsers.has(userCID) && capabilities.has(station)) {
        assignedStations.add(station);
        assignedUsers.add(userCID);
        assigned = true;
        break;
      }
    }

    if (!assigned && !unstaffableStations.includes(station)) {
      // Could be staffed, but no available controller (all qualified ones already assigned)
      reasons.push(`Station ${station} qualified controllers are already assigned to other stations`);
      conflicts.push({
        station1: station,
        station2: "other stations",
        reason: "All qualified controllers already assigned",
      });
    }
  }

  // Determine overall feasibility
  const isFeasible =
    unstaffableStations.length === 0 &&
    assignedStations.size === staffedStations.length;

  if (isFeasible) {
    reasons.push("All stations can be staffed without conflicts");
  } else {
    if (unstaffableStations.length > 0) {
      reasons.push(
        `${unstaffableStations.length} station(s) cannot be staffed due to lack of qualified controllers`
      );
    }
    if (assignedStations.size < staffedStations.length) {
      const unassigned = staffedStations.length - assignedStations.size;
      reasons.push(
        `${unassigned} station(s) cannot be assigned without double-booking controllers`
      );
    }
  }

  return {
    isFeasible,
    totalSignups: occurrence.signups.length,
    requiredStations: staffedStations.length,
    reasons,
    unstaffableStations,
    conflicts,
  };
}

/**
 * Format a staffing check result into a human-readable message
 */
export function formatStaffingCheckMessage(
  result: StaffingCheckResult,
  occurrenceName: string,
  occurrenceDate: Date
): string {
  const dateStr = occurrenceDate.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  if (result.isFeasible) {
    return `✅ **Besetzung ausreichend: ${occurrenceName}**\n\nDatum: ${dateStr}\n\nAlle ${result.requiredStations} Stationen können besetzt werden mit ${result.totalSignups} Anmeldungen.`;
  }

  let message = `⚠️ **Besetzung unzureichend: ${occurrenceName}**\n\nDatum: ${dateStr}\n\n`;
  message += `**Problem:** Es fehlt Besetzung für das vollständige Roster.\n\n`;
  message += `**Details:**\n`;
  message += `- Anmeldungen: ${result.totalSignups}\n`;
  message += `- Benötigte Stationen: ${result.requiredStations}\n\n`;

  if (result.unstaffableStations.length > 0) {
    message += `**Stationen ohne qualifizierte Lotsen:**\n`;
    result.unstaffableStations.forEach((station) => {
      message += `- ${station}\n`;
    });
    message += `\n`;
  }

  if (result.conflicts.length > 0) {
    message += `**Konflikte:**\n`;
    result.conflicts.forEach((conflict) => {
      message += `- ${conflict.station1}: ${conflict.reason}\n`;
    });
    message += `\n`;
  }

  message += `**Empfehlung:** Bitte weitere Lotsen für die fehlenden Positionen suchen.`;

  return message;
}
