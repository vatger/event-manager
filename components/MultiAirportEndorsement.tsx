"use client";
import { getBadgeClassForEndorsement } from "@/utils/EndorsementBadge";
import { Badge } from "@/components/ui/badge";
import React, { useEffect, useState } from "react";
import { Alert, AlertDescription } from "./ui/alert";
import { MultiAirportEndorsementResponse, AirportEndorsementResult } from "@/lib/endorsements/types";
import { Check, X as XIcon } from "lucide-react";

export interface MultiAirportEndorsementQueryParams {
  user: {
    userCID: number;
    rating: number;
  };
  event: {
    airports: string[];
    fir?: string;
  };
}

export default React.memo(function MultiAirportEndorsement(params: MultiAirportEndorsementQueryParams) {
  const [data, setData] = useState<MultiAirportEndorsementResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { user, event } = params;

  // Stringify airports array for stable dependency
  const airportsKey = event.airports.join(',');

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/endorsements/multi-airport", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });

        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || "Request failed");
        }

        const j = (await res.json()) as MultiAirportEndorsementResponse;
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
  }, [user.userCID, user.rating, airportsKey, event.fir]);

  const controllableAirports = data?.airports.filter(a => a.canControl) || [];
  const nonControllableAirports = data?.airports.filter(a => !a.canControl) || [];

  return (
    <Alert>
      <AlertDescription>
        {!loading && data && controllableAirports.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Höchste Berechtigung:</span>
              <Badge className={getBadgeClassForEndorsement(data.highestGroup || "")}>
                {data.highestGroup || "Keine"}
              </Badge>
            </div>
            
            <div className="space-y-2">
              <span className="text-xs font-medium text-muted-foreground">Deine Berechtigungen pro Airport:</span>
              <div className="grid gap-2">
                {data.airports.map((airport: AirportEndorsementResult) => (
                  <div 
                    key={airport.airport} 
                    className={`flex items-center justify-between p-2 rounded-lg border ${
                      airport.canControl 
                        ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800" 
                        : "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {airport.canControl ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <XIcon className="h-4 w-4 text-red-600" />
                      )}
                      <span className="font-medium">{airport.airport}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {airport.canControl && airport.group && (
                        <Badge className={getBadgeClassForEndorsement(airport.group)}>
                          {airport.group}
                        </Badge>
                      )}
                      {!airport.canControl && (
                        <span className="text-xs text-red-600">Nicht berechtigt</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {controllableAirports.some(a => a.restrictions.length > 0) && (
              <div className="mt-2 text-xs text-muted-foreground">
                <span className="font-medium">Einschränkungen:</span>
                <ul className="list-disc list-inside mt-1">
                  {controllableAirports.map(airport => 
                    airport.restrictions.map((restriction, idx) => (
                      <li key={`${airport.airport}-${idx}`}>
                        {airport.airport}: {restriction}
                      </li>
                    ))
                  )}
                </ul>
              </div>
            )}

            <p className="text-xs text-green-600 mt-2">
              Du wirst automatisch für {controllableAirports.length === 1 
                ? controllableAirports[0].airport 
                : `${controllableAirports.length} Airports`} angemeldet.
              {nonControllableAirports.length > 0 && (
                <span className="text-muted-foreground">
                  {" "}({nonControllableAirports.map(a => a.airport).join(", ")} nicht berechtigt)
                </span>
              )}
            </p>
          </div>
        ) : !loading && (!data || controllableAirports.length === 0) ? (
          <p className="text-red-600">
            Du bist für keinen der Event-Airports berechtigt ({event.airports.join(", ")})
          </p>
        ) : (
          <>
            {error && <p className="text-red-500 text-xs">{error}</p>}
            {loading && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <div className="h-4 w-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                <span>Lade Berechtigungen für {event.airports.length} Airports...</span>
              </div>
            )}
          </>
        )}
      </AlertDescription>
    </Alert>
  );
});
