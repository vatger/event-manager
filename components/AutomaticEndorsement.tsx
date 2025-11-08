"use client";
import { getBadgeClassForEndorsement } from "@/utils/EndorsementBadge";
import { Badge } from "@/components/ui/badge";
import React, { useEffect, useState } from "react";
import { Alert, AlertDescription } from "./ui/alert";
import { EndorsementQueryParams, EndorsementResponse } from "@/lib/endorsements/types";

export default React.memo(function AutomaticEndorsement(params: EndorsementQueryParams) {
  const [data, setData] = useState<EndorsementResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { user, event } = params;

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/endorsements/group", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });

        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || "Request failed");
        }

        const j = (await res.json()) as EndorsementResponse;
        if (!cancelled) setData(j);
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          setError("Fehler bei der Gruppenbestimmung");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [user.userCID, user.rating, event.airport, event.fir]); // ✅ Nur wenn sich das ändert

  return (
    <Alert>
      <AlertDescription>
        {!loading && data && data.group ? (
          <div>
            <Badge className={getBadgeClassForEndorsement(data.group)}>{data.group}</Badge>
            {data.restrictions.length === 0 ? (
              <p className="text-xs text-green-600 mt-2">
                You can control up to {data.group}, based on your training data
              </p>
            ) : (
              <div className="mt-2">
                {data.restrictions.map((rmk, index) => (
                  <p key={index} className="text-xs">
                    • {rmk}
                  </p>
                ))}
              </div>
            )}
          </div>
        ) : !loading && !data?.group ? (
          <p className="text-red-600">You are not allowed to control {event.airport}</p>
        ) : (
          <>
            {error && <p className="text-red-500 text-xs">{error}</p>}
            {loading && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <div className="h-4 w-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                <span>Loading…</span>
              </div>
            )}
          </>
        )}
      </AlertDescription>
    </Alert>
  );
});
