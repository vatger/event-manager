import { useState, useEffect } from "react";

export function useEventSignup(eventId: number) {
  const [loading, setLoading] = useState(true);
  const [isSignedUp, setIsSignedUp] = useState(false);
  const [signupId, setSignupId] = useState<string | null>(null);
  const [signupData, setSignupData] = useState<any>(null);

  useEffect(() => {
    if (!eventId) return;

    setLoading(true);
    fetch(`/api/signups/${eventId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.isSignedUp) {
          setIsSignedUp(true);
          setSignupId(data.signupId);
          setSignupData(data.data);
        } else {
          setIsSignedUp(false);
          setSignupId(null);
          setSignupData(null);
        }
      })
      .finally(() => setLoading(false));
  }, [eventId]);

  return { loading, isSignedUp, signupId, signupData };
}
