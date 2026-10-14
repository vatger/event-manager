import { useState, useEffect, useCallback } from "react";
import type { TimeRange } from "@/types";

/** Anmeldung, wie GET /api/events/[id]/signup/[userId] sie liefert (genutzte Felder) */
export interface EventSignupData {
  deletedAt?: string | null;
  availability?: { available?: TimeRange[]; unavailable?: TimeRange[] };
  preferredStations?: string | null;
  remarks?: string | null;
  excludedAirports?: string[] | null;
}

export function useEventSignup(eventId?: number | string, userId?: number | string) {
  const [loading, setLoading] = useState(true);
  const [isSignedUp, setIsSignedUp] = useState(false);
  const [signupData, setSignupData] = useState<EventSignupData | null>(null);

  const load = useCallback(() => {
    if (!eventId || !userId) {
      // Kein eingeloggter User oder keine Event-ID: kein Signup vorhanden
      setIsSignedUp(false);
      setSignupData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const ev = String(eventId);
    const uid = String(userId);

    fetch(`/api/events/${ev}/signup/${uid}`)
      .then(async (res) => {
        if (res.status === 404) {
          setIsSignedUp(false);
          setSignupData(null);
          return;
        }
        if (!res.ok) {
          throw new Error("Fehler beim Abrufen des Signups");
        }
        const data = await res.json();
        // Check if signup is soft-deleted
        if (data.deletedAt) {
          setIsSignedUp(false); // Treat soft-deleted as not signed up
          setSignupData(data); // But keep the data for potential restore
        } else {
          setIsSignedUp(true);
          setSignupData(data);
        }
      })
      .catch((err) => {
        console.error(err);
        setIsSignedUp(false);
        setSignupData(null);
      })
      .finally(() => setLoading(false));
  }, [eventId, userId]);

  useEffect(() => {
    load();
  }, [load]);

  return { loading, isSignedUp, signupData, refetch: load };
}
