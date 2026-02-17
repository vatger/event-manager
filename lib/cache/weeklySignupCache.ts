import prisma from "@/lib/prisma";
import { GroupService } from "@/lib/endorsements/groupService";
import { getRatingValue } from "@/utils/ratingToValue";
import type { EndorsementResponse } from "@/lib/endorsements/types";

const TTL = 1000 * 60 * 60 * 6; // 6 hours

// In-memory cache for weekly signups
type CacheEntry<T> = {
  data: T;
  expires: number;
};
const memoryCache = new Map<string, CacheEntry<unknown>>();

// Track last update timestamps per occurrence for cache busting
const lastUpdateTimestamps = new Map<number, number>();

export interface WeeklySignupEntry {
  id: number;
  userCID: number;
  remarks: string | null;
  createdAt: string;
  user: {
    cid: number;
    name: string;
    rating: number;
  } | null;
  endorsementGroup: string | null;
  restrictions: string[];
}

/**
 * Get last update timestamp for an occurrence
 */
export function getLastUpdateTimestamp(occurrenceId: number): number {
  return lastUpdateTimestamps.get(occurrenceId) || 0;
}

/**
 * Set last update timestamp for an occurrence
 */
export function setLastUpdateTimestamp(occurrenceId: number): void {
  const timestamp = Date.now();
  lastUpdateTimestamps.set(occurrenceId, timestamp);
  console.log(`[WEEKLY CACHE] Updated timestamp for occurrence ${occurrenceId}: ${timestamp}`);
}

/**
 * Main function: getCachedWeeklySignups
 * Fetches signups with dynamically calculated endorsements, with caching
 */
export async function getCachedWeeklySignups(
  occurrenceId: number,
  forceRefresh = false
): Promise<WeeklySignupEntry[]> {
  const key = `weekly-occurrence:${occurrenceId}`;

  // 1️⃣ Check memory cache unless force refresh
  if (!forceRefresh) {
    const cached = memoryCache.get(key);
    if (cached && cached.expires > Date.now()) {
      console.log(`[WEEKLY CACHE HIT] Signups for occurrence ${occurrenceId}`);
      return cached.data as WeeklySignupEntry[];
    }
  } else {
    console.log(`[WEEKLY CACHE SKIP] Force refresh for occurrence ${occurrenceId}`);
  }

  console.log(`[WEEKLY CACHE MISS] Recalculate signups for occurrence ${occurrenceId}`);

  // 2️⃣ Load occurrence with config
  const occurrence = await prisma.weeklyEventOccurrence.findUnique({
    where: { id: occurrenceId },
    include: {
      config: {
        include: {
          fir: true,
        },
      },
    },
  });

  if (!occurrence) {
    throw new Error(`Occurrence ${occurrenceId} not found`);
  }

  // Parse airports from config
  let airports: string[] = [];
  try {
    airports = occurrence.config.airports
      ? typeof occurrence.config.airports === "string"
        ? JSON.parse(occurrence.config.airports)
        : occurrence.config.airports
      : [];
  } catch (e) {
    console.error("Error parsing airports:", e);
  }

  // 3️⃣ Fetch all signups
  const signups = await prisma.weeklyEventSignup.findMany({
    where: { occurrenceId },
    include: { 
      occurrence: {
        select: {
          date: true,
          signupDeadline: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // 4️⃣ Fetch user details and calculate endorsements (time-intensive)
  const computed: WeeklySignupEntry[] = await Promise.all(
    signups.map(async (s): Promise<WeeklySignupEntry> => {
      const user = await prisma.user.findUnique({
        where: { cid: s.userCID },
        select: {
          cid: true,
          name: true,
          rating: true,
        },
      });

      if (!user) {
        return {
          id: s.id,
          userCID: s.userCID,
          remarks: s.remarks,
          createdAt: s.createdAt.toISOString(),
          user: null,
          endorsementGroup: null,
          restrictions: [],
        };
      }

      try {
        // Calculate endorsement dynamically based on current rating
        const checkAirport = airports[0] || "EDDF"; // Fallback
        
        const result: EndorsementResponse = await GroupService.getControllerGroup({
          user: {
            userCID: user.cid,
            rating: getRatingValue(user.rating) || 0,
          },
          event: {
            airport: checkAirport,
            fir: occurrence.config.fir?.code,
          },
        });

        return {
          id: s.id,
          userCID: s.userCID,
          remarks: s.remarks,
          createdAt: s.createdAt.toISOString(),
          user: {
            cid: user.cid,
            name: user.name,
            rating: getRatingValue(user.rating),
          },
          endorsementGroup: result.group,
          restrictions: result.restrictions || [],
        };
      } catch (err) {
        console.error(
          `[WEEKLY ENDORSEMENT ERROR] ${user.cid} @${occurrence.config.fir?.code || "?"}:`,
          err
        );
        return {
          id: s.id,
          userCID: s.userCID,
          remarks: s.remarks,
          createdAt: s.createdAt.toISOString(),
          user: {
            cid: user.cid,
            name: user.name,
            rating: getRatingValue(user.rating),
          },
          endorsementGroup: null,
          restrictions: [],
        };
      }
    })
  );

  // 5️⃣ Store in memory cache
  memoryCache.set(key, { data: computed, expires: Date.now() + TTL });
  console.log(`[WEEKLY CACHE SET] Signups cached for occurrence ${occurrenceId}`);

  return computed;
}

/**
 * Invalidate cache for an occurrence
 */
export async function invalidateWeeklySignupCache(occurrenceId: number): Promise<void> {
  const key = `weekly-occurrence:${occurrenceId}`;
  memoryCache.delete(key);
  setLastUpdateTimestamp(occurrenceId);
  console.log(`[WEEKLY CACHE INVALIDATED] Signups cache for occurrence ${occurrenceId}`);
}
