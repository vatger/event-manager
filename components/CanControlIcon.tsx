"use client";

import { useState, useEffect, useMemo } from "react";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const endorsementCache = new Map<string, boolean>();

interface CanControlIconProps {
  params: {
    user: {
        userCID: number;
        rating: number;
    },
    event: {
        airport: Array<string>;
        fir: string;
    }
  };
}

// Stabiler Cache-Key Generator
function createCacheKey(params: CanControlIconProps['params']): string {
  const airports = [...params.event.airport].sort().join(',');
  return `${params.user.userCID}-${params.user.rating}-${airports}-${params.event.fir}`;
}

export function CanControlIcon({ params }: CanControlIconProps) {
  // Stabiler Cache-Key mit useMemo
  const cacheKey = useMemo(() => createCacheKey(params), [
    params.user.userCID,
    params.user.rating,
    params.event.fir,
    params.event.airport.sort().join(',') // Sortiert für Stabilität
  ]);

  const [loading, setLoading] = useState(() => {
    // Initial State basierend auf Cache
    return !endorsementCache.has(cacheKey);
  });
  
  const [canControl, setCanControl] = useState<boolean | null>(() => {
    // Initial State aus Cache
    return endorsementCache.get(cacheKey) ?? null;
  });
  
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Wenn bereits im Cache, nichts tun
    const cached = endorsementCache.get(cacheKey);
    if (cached !== undefined) {
      setCanControl(cached);
      setLoading(false);
      return;
    }

    let isCancelled = false;

    const checkEndorsement = async () => {
      try {
        setLoading(true);
        setError(null);

        const fetchEndorsement = async (airport: string) => {
          const body = {
            user: params.user,
            event: {
              airport: airport,
              fir: params.event.fir
            }
          };

          console.log("Checking endorsement with body:", body);
          const res = await fetch(`/api/endorsements/group`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });

          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j.error || "Request failed");
          }

          const j = await res.json();
          console.log("Endorsement response:", j);
          return !!j.group;
        };

        // Prüfe alle Airports sequenziell
        let hasPermission = false;
        for (const airport of params.event.airport) {
          if (isCancelled) return;
          
          const permitted = await fetchEndorsement(airport);
          
          if (permitted) {
            hasPermission = true;
            break;
          }
        }

        if (!isCancelled) {
          endorsementCache.set(cacheKey, hasPermission);
          setCanControl(hasPermission);
        }
      } catch (err) {
        console.error("Fehler beim Laden der Endorsements:", err);
        if (!isCancelled) {
          setError("Fehler bei der Gruppenbestimmung");
          setCanControl(false);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    checkEndorsement();

    return () => {
      isCancelled = true;
    };
  }, [cacheKey, params]);

  const tooltipText = error
    ? error
    : canControl
    ? "Du kannst dieses Event lotsen"
    : "Du kannst dieses Event nicht lotsen";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center justify-center">
          {loading ? (
            <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
          ) : canControl ? (
            <CheckCircle className="w-5 h-5 text-green-500" />
          ) : (
            <XCircle className="w-5 h-5 text-red-500" />
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>{tooltipText}</TooltipContent>
    </Tooltip>
  );
}