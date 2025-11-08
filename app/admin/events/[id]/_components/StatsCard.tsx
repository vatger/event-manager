"use client";

import React, {
  useEffect,
  useState,
  useImperativeHandle,
  forwardRef,
} from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import type { SignupTableEntry } from "@/lib/cache/types";

export interface StatsCardHandle {
  reload: () => Promise<void>;
}

interface StatsCardProps {
  eventId: number;
}

export const StatsCard = forwardRef<StatsCardHandle, StatsCardProps>(
  ({ eventId }, ref) => {
    const [signups, setSignups] = useState<SignupTableEntry[]>([]);
    const [cached, setCached] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadSignups = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/events/${eventId}/signup/full`);
        if (!res.ok) throw new Error("Fehler beim Laden der Statistikdaten");

        const data = await res.json();
        setSignups(Array.isArray(data.signups) ? data.signups : []);
        setCached(Boolean(data.cached));
      } catch (err) {
        console.error("[StatsCard] Load error:", err);
        setError("Fehler beim Laden der Statistikdaten");
        setSignups([]);
      } finally {
        setLoading(false);
      }
    };

    // Load on mount
    useEffect(() => {
      loadSignups();
    }, [eventId]);

    // Expose reload() to parent
    useImperativeHandle(ref, () => ({
      reload: loadSignups,
    }));

    // Statistik berechnen
    const stats = {
      GND: 0,
      TWR: 0,
      APP: 0,
      CTR: 0,
      UNSPEC: 0,
    };

    for (const s of signups) {
      const group = s.endorsement?.group || s.user.rating || "UNSPEC";
      if (group in stats) {
        stats[group as keyof typeof stats]++;
      } else {
        stats.UNSPEC++;
      }
    }

    // Render states
    if (loading)
      return (
        <Card>
          <CardHeader>
            <CardTitle>Controller Statistik</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Lade Daten…</p>
          </CardContent>
        </Card>
      );

    if (error)
      return (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      );

    return (
      <Card>
        <CardHeader>
          <CardTitle>
            Controller Statistik{" "}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
            {Object.entries(stats).map(([key, val]) => (
              <div key={key}>
                <p className="text-sm text-muted-foreground">{key}</p>
                <p className="text-xl font-semibold">{val}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }
);

StatsCard.displayName = "StatsCard";
