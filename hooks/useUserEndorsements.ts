import { useState, useEffect } from "react";

export interface UserEndorsements {
  cid: number;
  endorsements: string[];
  lastUpdated: string;
}

export function useUserEndorsements(cid?: string | number) {
  const [data, setData] = useState<UserEndorsements | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cid) {
      setData(null);
      return;
    }

    let isMounted = true;

    const fetchEndorsements = async () => {
      setLoading(true);
      setError(null);

      try {
      const response = await fetch(`/api/mock/endorsements/${cid}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch endorsements: ${response.status}`);
      }

      const endorsementsData = await response.json();
      
      if (isMounted) {
        setData(endorsementsData);
      }
    } catch (err) {
      if (isMounted) {
        setError(err instanceof Error ? err.message : "Unknown error occurred");
      }
    } finally {
      if (isMounted) {
        setLoading(false);
      }
    }
  };

  fetchEndorsements();

  return () => {
    isMounted = false;
  };
}, [cid]);

return {
  data,
  loading,
  error,
  isSuccess: !!data && !error,
  isError: !!error,
};
}