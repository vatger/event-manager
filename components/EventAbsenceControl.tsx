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
 * N/A-Meldung („Ich bin nicht dabei“) auf der Eventseite.
 *
 * Für Lotsen, die zu einem Termin nicht können – das Eventteam sieht dann,
 * dass das Event nicht übersehen wurde. Zurückgenommen wird die Meldung nicht
 * eigens: Wer sie loswerden will, will sich anmelden – und eine Anmeldung hebt
 * sie auf dem Server automatisch auf.
 */

export interface EventAbsenceState {
  /** null = noch nicht geladen oder nicht verfügbar */
  absent: boolean | null;
  canReport: boolean;
  /** Nach erfolgreichem Melden */
  markAbsent: () => void;
}

/**
 * Stand der eigenen N/A-Meldung. `enabled` aus, solange man angemeldet ist –
 * dann gibt es nichts zu melden; beim Wechsel wird neu geladen.
 */
export function useEventAbsence(eventId: number | null, enabled: boolean): EventAbsenceState {
  const [absent, setAbsent] = useState<boolean | null>(null);
  const [canReport, setCanReport] = useState(false);

  const load = useCallback(async () => {
    if (!eventId || !enabled) {
      setAbsent(null);
      return;
    }
    try {
      const res = await fetch(`/api/events/${eventId}/absence`);
      if (!res.ok) return setAbsent(null);
      const data = await res.json();
      setAbsent(!!data.absent);
      setCanReport(!!data.canReport);
    } catch {
      setAbsent(null);
    }
  }, [eventId, enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  return { absent, canReport, markAbsent: () => setAbsent(true) };
}

/** Schlichter Hinweis unter „Doch anmelden“ */
export function AbsenceNotice() {
  return (
    <p className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
      <CalendarX2 className="h-4 w-4 shrink-0" />
      Du hast dich als N/A gemeldet
    </p>
  );
}

/** „Ich bin nicht dabei“ mit kurzer Rückfrage und optionalem Grund */
export function AbsenceReportButton({
  eventId,
  onReported,
}: {
  eventId: number;
  onReported: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

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
      setOpen(false);
      setReason("");
      onReported();
      toast.success("Danke – das Eventteam weiß Bescheid");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Melden fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => setOpen(true)}>
        <CalendarX2 className="h-4 w-4" />
        Ich bin nicht dabei
      </Button>

      <AlertDialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Als N/A melden</AlertDialogTitle>
            <AlertDialogDescription>
              Das Eventteam sieht so, dass du zu diesem Termin nicht kannst. Anmelden kannst du
              dich trotzdem jederzeit.
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
