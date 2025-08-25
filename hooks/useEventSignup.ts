import { useState, useEffect } from "react";

export function useEventSignup(eventId?: number | string, userId?: number | string) {
  const [loading, setLoading] = useState(true);
  const [isSignedUp, setIsSignedUp] = useState(false);
  const [signupData, setSignupData] = useState<any>(null);

  const load = () => {
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
        setIsSignedUp(true);
        setSignupData(data);
      })
      .catch((err) => {
        console.error(err);
        setIsSignedUp(false);
        setSignupData(null);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [eventId, userId]);

  return { loading, isSignedUp, signupData, refetch: load };
}
