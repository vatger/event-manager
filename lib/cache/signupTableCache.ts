// lib/cache/signupTableCache.ts
import prisma from "@/lib/prisma";
import { getCache, setCache, invalidateCache } from "./cacheManager";
import { GroupService } from "@/lib/endorsements/groupService";
import { getRatingValue } from "@/utils/ratingToValue";
import { EndorsementResponse } from "@/lib/endorsements/types";

const TTL = 1000 * 60 * 60 * 6; // 6 Stunden

export async function getCachedSignupTable(eventId: number) {
  const key = `event:${eventId}`;

  // 1️⃣ Versuch, aus Cache zu lesen
  const cached = await getCache(key);
  if (cached) {
    console.log(`[CACHE HIT] Signups für Event ${eventId}`);
    return cached;
  }
  

  console.log(`[CACHE MISS] Recalculate Signups für Event ${eventId}`);

  // 2️⃣ Falls kein Cache vorhanden → Daten neu berechnen
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { fir: true },
  });
  if (!event) throw new Error("Event not found");

  const signups = await prisma.eventSignup.findMany({
    where: { eventId },
    include: { user: true },
  });

  // 3️⃣ Berechne Endorsements (dauert)
  const computed = await Promise.all(
    signups.map(async (s) => {
      try {
        const result: EndorsementResponse = await GroupService.getControllerGroup({
          user: { userCID: s.user.cid, rating: getRatingValue(s.user.rating) },
          event: { airport: event.airports[0], fir: event.fir?.code },
        });

        return {
          id: s.id,
          user: {
            cid: s.user.cid,
            name: s.user.name,
            rating: s.user.rating,
          },
          preferredStations: s.preferredStations,
          remarks: s.remarks,
          availability: s.availability,
          endorsement: result,
        };
      } catch {
        return {
          id: s.id,
          user: {
            cid: s.user.cid,
            name: s.user.name,
            rating: s.user.rating,
          },
          preferredStations: s.preferredStations,
          remarks: s.remarks,
          availability: s.availability,
          endorsement: null,
        };
      }
    })
  );

  // 4️⃣ Ergebnis in Cache speichern
  await setCache(key, computed, TTL);
  
  return computed;
}

export async function invalidateSignupTable(eventId: number) {
    const key = `event:${eventId}`;
    await invalidateCache(key);
  }