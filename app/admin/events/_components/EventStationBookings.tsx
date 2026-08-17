"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircleIcon, Loader2, RefreshCw, Trash2, Lock } from "lucide-react";
import { toast } from "sonner";

interface Booking {
  booking_id: number;
  callsign: string | null;
  cid: number;
  start: string;
  end: string;
}

interface StatusResponse {
  configured: boolean;
  bookings: Booking[];
}

interface SyncResponse {
  skipped?: string;
  created: number;
  existing: number;
  conflict: number;
  failed: number;
  deleted: number;
  results: Array<{ callsign: string; status: string; message: string }>;
}

interface EventStationBookingsProps {
  eventId: number;
  /** Die aktuell im Formular ausgewählten Stationen. */
  stations: string[];
  disabled?: boolean;
}

const timeFormat = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

/**
 * Verwaltung der Stationsbuchungen eines Events auf der VATGER Homepage.
 *
 * Geblockt wird automatisch, sobald die Anmeldung geöffnet ist – und erneut,
 * wenn sich die Stationen ändern. Hier lässt sich der Stand einsehen, von
 * Hand nachziehen und einzeln oder komplett wieder freigeben.
 */
export default function EventStationBookings({ eventId, stations, disabled }: EventStationBookingsProps) {
  const [configured, setConfigured] = useState(true);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/bookings`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error || "Der Buchungsstand konnte nicht geladen werden.");
        return;
      }
      const data: StatusResponse = await res.json();
      setConfigured(data.configured);
      setBookings(data.bookings ?? []);
      setError("");
    } catch {
      setError("Die VATGER Homepage ist gerade nicht erreichbar.");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  const summarize = (data: SyncResponse) => {
    if (data.skipped) {
      toast.warning(data.skipped);
      return;
    }

    const parts: string[] = [];
    if (data.created) parts.push(`${data.created} gebucht`);
    if (data.existing) parts.push(`${data.existing} unverändert`);
    if (data.deleted) parts.push(`${data.deleted} freigegeben`);
    if (data.conflict) parts.push(`${data.conflict} Konflikte`);
    if (data.failed) parts.push(`${data.failed} Fehler`);

    const message = parts.length > 0 ? parts.join(", ") : "Keine Änderungen";

    if (data.conflict || data.failed) {
      const details = data.results
        .filter((r) => r.status === "conflict" || r.status === "failed")
        .map((r) => `${r.callsign}: ${r.message}`)
        .join("\n");
      toast.warning(message, { description: details });
      return;
    }

    toast.success(message);
  };

  const call = async (method: "POST" | "DELETE", body?: unknown) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/events/${eventId}/bookings`, {
        method,
        ...(body === undefined
          ? {}
          : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Die Buchungen konnten nicht geändert werden.");
        return;
      }

      if (method === "POST") {
        summarize(data as SyncResponse);
      } else {
        toast.success(`${data.deleted ?? 0} Buchung(en) freigegeben`);
      }
      await load();
    } catch {
      setError("Die VATGER Homepage ist gerade nicht erreichbar.");
    } finally {
      setBusy(false);
    }
  };

  if (!configured) return null;

  // Stationen, die im Formular stehen, aber (noch) nicht geblockt sind.
  const bookedCallsigns = new Set(bookings.map((b) => (b.callsign ?? "").toUpperCase()));
  const missing = stations.map((s) => s.toUpperCase()).filter((s) => !bookedCallsigns.has(s));

  return (
    <div className="space-y-3 border-t pt-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Stationsbuchungen
          </h4>
          <p className="text-xs text-muted-foreground">
            Sobald die Anmeldung geöffnet ist, werden diese Stationen auf der VATGER Homepage als
            Event-Buchung geblockt. Reguläre Buchungen, die im Weg stehen, werden dabei entfernt und
            die betroffenen Lotsen benachrichtigt.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || busy || loading}
            onClick={() => call("POST")}
          >
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Aktualisieren
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={disabled || busy || loading || bookings.length === 0}
            onClick={() => call("DELETE")}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Alle freigeben
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircleIcon className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Buchungsstand wird geladen...</p>
      ) : bookings.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Für dieses Event ist noch keine Station geblockt.
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {bookings.map((booking) => (
            <li key={booking.booking_id} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <span className="font-mono text-sm">{booking.callsign ?? "?"}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {timeFormat.format(new Date(booking.start))} – {timeFormat.format(new Date(booking.end))}z ·
                  CID {booking.cid}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled || busy}
                onClick={() => call("DELETE", { bookingIds: [booking.booking_id] })}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {missing.length > 0 && bookings.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Noch nicht geblockt: <span className="font-mono">{missing.join(", ")}</span> – mit
          &quot;Aktualisieren&quot; nachziehen.
        </p>
      )}

      {bookings.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Einzeln freigegebene Stationen kommen beim nächsten Aktualisieren zurück, solange sie oben
          ausgewählt sind. Dauerhaft frei wird eine Station, indem du sie hier abwählst und
          speicherst.
        </p>
      )}

      {stations.length === 0 && (
        <Badge variant="outline" className="text-xs">
          Keine Stationen ausgewählt
        </Badge>
      )}
    </div>
  );
}
