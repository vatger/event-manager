"use client";

import { useState, useEffect } from "react";
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

export function CanControlIcon({ params }: CanControlIconProps) {
  const [loading, setLoading] = useState(true);
  const [canControl, setCanControl] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const key = JSON.stringify(params); // eindeutiger Cache-Key

    const cached = endorsementCache.get(key);
    if (cached !== undefined) {
        setCanControl(cached);
        setLoading(false);
        return; // direkt aus Cache
    }

    const checkEndorsement = async () => {
      try {
      setLoading(true);
      setError(null);

      const fetchEndorsement = async (airport: string | null = null) => {
        const body = airport
        ? { ...params, event: { ...params.event, airport } }
        : params;

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
        return !!j.group;
      };

      if (params.event.airport.length > 1) {
        for (const airport of params.event.airport) {
          console.log("Prüfe Endorsement für Flughafen:", airport);
          const canControl = await fetchEndorsement(airport);
          if (canControl) {
            endorsementCache.set(key, true);
            setCanControl(true);
            return;
          }
        }
        endorsementCache.set(key, false);
        setCanControl(false);
      } else {
        const canControl = await fetchEndorsement();
        endorsementCache.set(key, canControl);
        setCanControl(canControl);
      }
      } catch (err) {
      console.error("Fehler beim Laden der Endorsements:", err);
      setError("Fehler bei der Gruppenbestimmung");
      setCanControl(false);
      } finally {
      setLoading(false);
      }
    };

    checkEndorsement();
  }, [params]);

  // Tooltip-Text definieren
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
