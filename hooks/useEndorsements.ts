"use client";
import { useEffect, useMemo, useState } from "react";
import { Signup } from "@/types";
import { EndorsementResponse } from "@/lib/endorsements/types";
import { getRatingValue } from "@/utils/ratingToValue";

export type EndorsementData = { [userCID: string]: EndorsementResponse };

export function useEndorsements(signups: Signup[], event?: { airports?: string | string[]; fir?: string }) {
  const [data, setData] = useState<EndorsementData>({});
  const [loading, setLoading] = useState(false);

  const airport = useMemo(() => {
    const a = event?.airports;
    if (!a) return undefined;
    return Array.isArray(a) ? a[0] : a;
  }, [event?.airports]);

  useEffect(() => {
    const run = async () => {
      if (!airport || !signups.length) {
        setData({});
        return;
      }
      setLoading(true);
      try {
        const requests = signups.map(async (s) => {
          const cid = String(s.user?.cid ?? s.userCID ?? "");
          const ratingStr = s.user?.rating ?? "";
          if (!cid || !ratingStr) return null;
          const res = await fetch('/api/endorsements/group', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user: { userCID: parseInt(cid, 10), rating: getRatingValue(ratingStr) },
              event: { airport, fir: event?.fir }
            })
          });
          if (!res.ok) return null;
          const j = (await res.json()) as EndorsementResponse;
          return { cid, endorsement: j };
        });
        const results = await Promise.all(requests);
        const map: EndorsementData = {};
        console.log("MAP", results)
        for (const r of results) if (r) map[r.cid] = r.endorsement;
        setData(map);
      } finally {
        setLoading(false);
      }
    }
    run();
  }, [airport, event?.fir, JSON.stringify(signups.map(s => [s.id, s.user?.cid ?? s.userCID, s.user?.rating]))]);

  return { data, loading } as const;
}

