import prisma from "@/lib/prisma";

export interface UserHistory {
  userCID: number;
  previousOccurrences: Array<{
    occurrenceId: number;
    date: Date;
    signedUp: boolean;
    assigned: boolean;
    station?: string;
  }>;
  stats: {
    totalOccurrencesChecked: number;
    totalSignups: number;
    totalAssigned: number;
    assignmentRate: number; // 0-100
  };
}

/**
 * Get the signup and roster history for a specific user in a weekly event configuration
 * @param userCID - The user's CID
 * @param configId - The weekly event configuration ID
 * @param currentOccurrenceId - The current occurrence ID (to exclude from history)
 * @param limit - Number of previous occurrences to check (default: 10)
 */
export async function getUserWeeklyHistory(
  userCID: number,
  configId: number,
  currentOccurrenceId: number,
  limit: number = 10
): Promise<UserHistory> {
  // Get previous occurrences for this config (excluding current one)
  const previousOccurrences = await prisma.weeklyEventOccurrence.findMany({
    where: {
      configId,
      id: { not: currentOccurrenceId },
      date: { lt: new Date() }, // Only past occurrences
    },
    orderBy: { date: "desc" },
    take: limit,
    select: {
      id: true,
      date: true,
      signups: {
        where: { userCID },
        select: { id: true },
      },
      rosters: {
        where: { userCID },
        select: {
          id: true,
          station: true,
        },
      },
    },
  });

  const occurrenceData = previousOccurrences.map((occ) => ({
    occurrenceId: occ.id,
    date: occ.date,
    signedUp: occ.signups.length > 0,
    assigned: occ.rosters.length > 0,
    station: occ.rosters[0]?.station,
  }));

  const totalSignups = occurrenceData.filter((o) => o.signedUp).length;
  const totalAssigned = occurrenceData.filter((o) => o.assigned).length;
  const assignmentRate =
    totalSignups > 0 ? (totalAssigned / totalSignups) * 100 : 0;

  return {
    userCID,
    previousOccurrences: occurrenceData,
    stats: {
      totalOccurrencesChecked: previousOccurrences.length,
      totalSignups,
      totalAssigned,
      assignmentRate: Math.round(assignmentRate * 10) / 10, // Round to 1 decimal
    },
  };
}

/**
 * Get history for multiple users in batch (more efficient)
 * @param userCIDs - Array of user CIDs
 * @param configId - The weekly event configuration ID
 * @param currentOccurrenceId - The current occurrence ID (to exclude from history)
 * @param limit - Number of previous occurrences to check (default: 10)
 */
export async function getUsersHistoryBatch(
  userCIDs: number[],
  configId: number,
  currentOccurrenceId: number,
  limit: number = 10
): Promise<Map<number, UserHistory>> {
  if (userCIDs.length === 0) {
    return new Map();
  }

  // Get previous occurrences for this config
  const previousOccurrences = await prisma.weeklyEventOccurrence.findMany({
    where: {
      configId,
      id: { not: currentOccurrenceId },
      date: { lt: new Date() }, // Only past occurrences
    },
    orderBy: { date: "desc" },
    take: limit,
    select: {
      id: true,
      date: true,
      signups: {
        where: { userCID: { in: userCIDs } },
        select: {
          userCID: true,
        },
      },
      rosters: {
        where: { userCID: { in: userCIDs } },
        select: {
          userCID: true,
          station: true,
        },
      },
    },
  });

  // Build history for each user
  const historyMap = new Map<number, UserHistory>();

  for (const userCID of userCIDs) {
    const occurrenceData = previousOccurrences.map((occ) => {
      const signup = occ.signups.find((s) => s.userCID === userCID);
      const roster = occ.rosters.find((r) => r.userCID === userCID);

      return {
        occurrenceId: occ.id,
        date: occ.date,
        signedUp: !!signup,
        assigned: !!roster,
        station: roster?.station,
      };
    });

    const totalSignups = occurrenceData.filter((o) => o.signedUp).length;
    const totalAssigned = occurrenceData.filter((o) => o.assigned).length;
    const assignmentRate =
      totalSignups > 0 ? (totalAssigned / totalSignups) * 100 : 0;

    historyMap.set(userCID, {
      userCID,
      previousOccurrences: occurrenceData,
      stats: {
        totalOccurrencesChecked: previousOccurrences.length,
        totalSignups,
        totalAssigned,
        assignmentRate: Math.round(assignmentRate * 10) / 10,
      },
    });
  }

  return historyMap;
}
