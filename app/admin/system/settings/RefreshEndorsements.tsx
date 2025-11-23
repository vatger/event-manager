"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { RefreshCcw, CheckCircle2, AlertCircle, Clock } from "lucide-react";

export default function TrainingCacheCard() {
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [fetchingStatus, setFetchingStatus] = useState(true);

  useEffect(() => {
    fetchCacheStatus();
  }, []);

  async function fetchCacheStatus() {
    try {
      setFetchingStatus(true);
      const res = await fetch("/api/endorsements/cache-status");
      const data = await res.json();
      
      if (res.ok && data.lastUpdated) {
        setLastUpdated(new Date(data.lastUpdated));
      }
    } catch (err) {
      console.error("Failed to fetch cache status:", err);
    } finally {
      setFetchingStatus(false);
    }
  }

  async function handleRefresh() {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch("/api/endorsements/refresh", { method: "GET" });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Fehler beim Aktualisieren");
      }

      toast.success("Endorsement-Daten erfolgreich aktualisiert!");
      setSuccess(true);
      setLastUpdated(new Date());
      // Fetch the updated cache status
      await fetchCacheStatus();
    } catch (err) {
      console.error(err);
      setError("Aktualisierung fehlgeschlagen");
      toast.error("Fehler beim Aktualisieren der Endorsements");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="shadow-sm border">
      <CardHeader>
        <CardTitle>Training & Endorsement Cache</CardTitle>
        <CardDescription>
          Manuelles Aktualisieren der Trainingsdaten und Endorsements aus dem System.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Last Updated Info */}
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm font-medium">Letztes Update</p>
            <p className="text-xs text-muted-foreground">
              {fetchingStatus ? (
                "Lade..."
              ) : lastUpdated ? (
                <>
                  {lastUpdated.toLocaleDateString("de-DE", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}{" "}
                  um{" "}
                  {lastUpdated.toLocaleTimeString("de-DE", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  Uhr
                </>
              ) : (
                "Noch keine Aktualisierung durchgeführt"
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              Manuell aktualisieren, um die neuesten Daten zu laden.
            </p>
          </div>
          <Button
            variant="outline"
            disabled={loading}
            onClick={handleRefresh}
            className="flex items-center gap-2"
          >
            {loading ? (
              <>
                <RefreshCcw className="h-4 w-4 animate-spin" />
                Aktualisiere...
              </>
            ) : (
              <>
                <RefreshCcw className="h-4 w-4" />
                Aktualisieren
              </>
            )}
          </Button>
        </div>

        {success && (
          <Alert className="border-green-200 bg-green-50 text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>Endorsement-Cache wurde erfolgreich neu geladen.</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
