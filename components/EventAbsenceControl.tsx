"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarX2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ABSENCE_REASON_MAX } from "@/lib/events/eventAbsence";

/**
 * „Ich bin nicht dabei“ unter dem Anmeldeknopf der Eventseite.
 *
 * Für Lotsen, die zu einem Termin nicht können – das Eventteam sieht dann,
 * dass das Event nicht übersehen wurde. Wer angemeldet ist, sieht nichts
 * davon; wer sich anmeldet, verliert die Meldung automatisch (Server).
 */
export function EventAbsenceControl({
  eventId,
  isSignedUp,
}: {
  eventId: number;
  /** Aktiv angemeldet – dann gibt es nichts zu melden */
  isSignedUp: boolean;
}) {
  const [state, setState] = useState<{ absent: boolean; canReport: boolean } | null>(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/absence`);
      if (!res.ok) return setState(null);
      const data = await res.json();
      setState({ absent: !!data.absent, canReport: !!data.canReport });
    } catch {
      setState(null);
    }
  }, [eventId]);

  // Neu laden, wenn sich der Anmeldestand ändert – eine Anmeldung hebt die
  // Meldung auf
  useEffect(() => {
    void load();
  }, [load, isSignedUp]);

  if (!state || isSignedUp) return null;

  const report = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/events/${eventId}/absence`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Melden fehlgeschlagen");
      setState({ ...state, absent: true });
      setOpen(false);
      setReason("");
      toast.success("Danke – das Eventteam weiß Bescheid");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Melden fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/events/${eventId}/absence`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setState({ ...state, absent: false });
    } catch {
      toast.error("Zurücknehmen fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  if (state.absent) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-dashed px-3 py-2 text-sm">
        <span className="flex items-center gap-2 whitespace-nowrap text-muted-foreground">
          <CalendarX2 className="h-4 w-4 shrink-0" />
          Nicht dabei gemeldet
        </span>
        {state.canReport && (
          <Button
            variant="link"
            size="sm"
            className="ml-auto h-auto p-0"
            onClick={withdraw}
            disabled={busy}
          >
            Zurücknehmen
          </Button>
        )}
      </div>
    );
  }

  if (!state.canReport) return null;

  return (
    <>
      <Button
        variant="ghost"
        className="w-full text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <CalendarX2 className="h-4 w-4" />
        Ich bin nicht dabei
      </Button>

      <AlertDialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nicht dabei melden</AlertDialogTitle>
            <AlertDialogDescription>
              Das Eventteam sieht so, dass du zu diesem Termin nicht kannst. Du kannst dich
              trotzdem jederzeit noch anmelden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="absence-reason">Grund (optional)</Label>
            <Textarea
              id="absence-reason"
              value={reason}
              maxLength={ABSENCE_REASON_MAX}
              onChange={(e) => setReason(e.target.value)}
              placeholder="z. B. Urlaub, Schicht, anderes Event"
              className="min-h-16"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void report();
              }}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Melden
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default EventAbsenceControl;
