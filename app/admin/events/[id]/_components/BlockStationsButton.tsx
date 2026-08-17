"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Lock, LockOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useUser } from "@/hooks/useUser";

interface BookingResult {
  callsign: string;
  cid: number;
  status: "created" | "existing" | "conflict" | "failed";
  message: string;
}

interface SyncResponse {
  configured: boolean;
  skipped?: string;
  created: number;
  existing: number;
  conflict: number;
  failed: number;
  deleted: number;
  results: BookingResult[];
}

interface StatusResponse {
  configured: boolean;
  bookings: Array<{ booking_id: number; callsign: string | null }>;
}

interface BlockStationsButtonProps {
  eventId: number;
  /** Die im Event als zu besetzen eingetragenen Stationen. */
  stations: string[];
}

/**
 * Blockt die zu besetzenden Stationen eines unregelmäßigen Events als
 * vatger Event Buchung auf der Homepage – oder gibt sie wieder frei.
 *
 * Weeklys brauchen diesen Knopf nicht, dort werden die Stationen automatisch
 * und weit im Voraus geblockt.
 */
export function BlockStationsButton({ eventId, stations }: BlockStationsButtonProps) {
  const { canInOwnFIR } = useUser();
  const [configured, setConfigured] = useState(true);
  const [blocked, setBlocked] = useState(0);
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState<"block" | "release" | null>(null);

  const allowed = canInOwnFIR("event.edit") || canInOwnFIR("roster.publish");

  const loadStatus = async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/bookings`);
      if (!res.ok) return;
      const data: StatusResponse = await res.json();
      setConfigured(data.configured);
      setBlocked(data.bookings?.length ?? 0);
    } catch {
      // Der Status ist reine Anzeige - ein Fehler darf die Seite nicht stören.
    }
  };

  useEffect(() => {
    if (!allowed) return;
    void loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, allowed]);

  const summarize = (data: SyncResponse) => {
    if (data.skipped) {
      toast.warning(data.skipped);
      return;
    }

    const parts: string[] = [];
    if (data.created) parts.push(`${data.created} gebucht`);
    if (data.existing) parts.push(`${data.existing} bereits gebucht`);
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

  const run = async (mode: "block" | "release") => {
    setLoading(true);
    setConfirm(null);
    try {
      const res = await fetch(`/api/events/${eventId}/bookings`, {
        method: mode === "block" ? "POST" : "DELETE",
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Die Stationen konnten nicht gebucht werden");
        return;
      }

      summarize(data as SyncResponse);
      await loadStatus();
    } catch (error) {
      console.error("Booking sync failed:", error);
      toast.error("Netzwerkfehler beim Buchen der Stationen");
    } finally {
      setLoading(false);
    }
  };

  if (!allowed || !configured) return null;

  return (
    <>
      <Button
        variant="outline"
        className="w-full justify-start"
        disabled={loading || (blocked === 0 && stations.length === 0)}
        onClick={() => setConfirm(blocked > 0 ? "release" : "block")}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : blocked > 0 ? (
          <LockOpen className="h-4 w-4 mr-2" />
        ) : (
          <Lock className="h-4 w-4 mr-2" />
        )}
        {blocked > 0 ? `Stationen freigeben (${blocked})` : "Stationen blocken"}
      </Button>

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirm === "release" ? "Stationen freigeben?" : "Stationen blocken?"}
            </DialogTitle>
            <DialogDescription asChild>
              {confirm === "release" ? (
                <div className="space-y-2">
                  <p>
                    Alle für dieses Event auf der VATGER Homepage gebuchten Stationen werden wieder
                    freigegeben.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p>
                    Die folgenden Stationen werden für die Dauer des Events auf der VATGER Homepage
                    als Event-Buchung geblockt:
                  </p>
                  <p className="font-mono text-xs text-foreground">{stations.join(", ")}</p>
                  <p>
                    Bereits bestehende reguläre Buchungen dieser Stationen werden dabei entfernt und
                    die betroffenen Lotsen darüber benachrichtigt.
                  </p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Abbrechen
            </Button>
            <Button
              variant={confirm === "release" ? "destructive" : "default"}
              onClick={() => run(confirm === "release" ? "release" : "block")}
            >
              {confirm === "release" ? "Freigeben" : "Blocken"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
