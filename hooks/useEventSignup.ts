import { useState, useEffect } from "react";

export function useEventSignup(eventId: number, userId: number) {
  const [loading, setLoading] = useState(true);
  const [isSignedUp, setIsSignedUp] = useState(false);
  const [signupData, setSignupData] = useState<any>(null);

  useEffect(() => {
    if (!eventId || !userId) return;

    setLoading(true);
    fetch(`/api/events/${eventId}/signup/${userId}`)
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
  }, [eventId, userId]);

  return { loading, isSignedUp, signupData };
}
