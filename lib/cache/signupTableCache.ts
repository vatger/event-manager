// lib/cache/signupTableCache.ts
import prisma from "@/lib/prisma";
import { getCache, setCache, invalidateCache } from "./cacheManager";
import { GroupService } from "@/lib/endorsements/groupService";
import { getRatingValue } from "@/utils/ratingToValue";
import type { EndorsementResponse } from "@/lib/endorsements/types";
import { Prisma } from "@prisma/client";
import { TimeRange } from "@/types";
import { Availability, SignupTableEntry } from "./types";

const TTL = 1000 * 60 * 60 * 6; // 6 Stunden


// ===================================================================
// 🔹 Hauptfunktion: getCachedSignupTable
// ===================================================================
export async function getCachedSignupTable(eventId: number): Promise<SignupTableEntry[]> {
  const key = `event:${eventId}`;

  // 1️⃣ Versuch, aus Cache zu lesen
  const cached = await getCache<SignupTableEntry[]>(key);
  if (cached) {
    console.log(`[CACHE HIT] SignupTableCache für Event ${eventId}`);
    return cached;
  }

  console.log(`[CACHE MISS] Recalculate SignupTable für Event ${eventId}`);

  // 2️⃣ Falls kein Cache vorhanden → Eventdaten laden
  const event = await prisma!.event.findUnique({
    where: { id: eventId },
    include: { fir: true },
  });

  if (!event) throw new Error(`Event ${eventId} not found`);

  // 3️⃣ Alle Signups abrufen
  const signups = await prisma!.eventSignup.findMany({
    where: { eventId },
    include: { user: true },
  });

  // 4️⃣ Endorsements berechnen (zeitintensiv)
  const computed: SignupTableEntry[] = await Promise.all(
    signups.map(async (s): Promise<SignupTableEntry> => {
      const user = s.user;
      try {
        const result: EndorsementResponse = await GroupService.getControllerGroup({
          user: {
            userCID: user.cid,
            rating: getRatingValue(user.rating),
          },
          event: {
            airport: (event.airports as string[] | null)?.[0] ?? "",
            fir: event.fir?.code,
          },
        });

        return {
          id: s.id,
          user: {
            cid: user.cid,
            name: user.name,
            rating: user.rating,
          },
          preferredStations: s.preferredStations || "",
          remarks: s.remarks,
          availability: parseAvailability(s.availability),
          endorsement: result,
          deletedAt: s.deletedAt?.toISOString() || null,
          deletedBy: s.deletedBy || null,
          modifiedAfterDeadline: s.modifiedAfterDeadline,
          changeLog: s.changeLog ? (Array.isArray(s.changeLog) ? JSON.parse(JSON.stringify(s.changeLog)) : null) : null,
          changesAcknowledged: s.changesAcknowledged,
          signedUpAfterDeadline: s.signedUpAfterDeadline,
        };
      } catch (err) {
        console.error(`[ENDORSEMENT ERROR] ${user.cid} @${event.fir?.code || "?"}:`, err);
        return {
          id: s.id,
          user: {
            cid: user.cid,
            name: user.name,
            rating: user.rating,
          },
          preferredStations: s.preferredStations || "",
          remarks: s.remarks,
          availability: parseAvailability(s.availability),
          endorsement: null,
          deletedAt: s.deletedAt?.toISOString() || null,
          deletedBy: s.deletedBy || null,
          modifiedAfterDeadline: s.modifiedAfterDeadline,
          changeLog: s.changeLog ? (Array.isArray(s.changeLog) ? JSON.parse(JSON.stringify(s.changeLog)) : null) : null,
          changesAcknowledged: s.changesAcknowledged,
          signedUpAfterDeadline: s.signedUpAfterDeadline,
        };
      }
    })
  );

  // 5️⃣ Ergebnis in Cache speichern
  await setCache(key, computed, TTL);
  console.log(`[CACHE SET] SignupTableCache gespeichert für Event ${eventId}`);

  return computed;
}

// ===================================================================
// 🔹 Cache für ein Event löschen
// ===================================================================
export async function invalidateSignupTable(eventId: number): Promise<void> {
  const key = `event:${eventId}`;
  await invalidateCache(key);
  console.log(`[CACHE INVALIDATED] SignupTableCache für Event ${eventId}`);
}


function parseAvailability(value: Prisma.JsonValue | null): Availability {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const available = Array.isArray(obj.available) ? (obj.available as TimeRange[]) : [];
    const unavailable = Array.isArray(obj.unavailable) ? (obj.unavailable as TimeRange[]) : [];
    return { available, unavailable };
  }
  return { available: [], unavailable: [] };
}