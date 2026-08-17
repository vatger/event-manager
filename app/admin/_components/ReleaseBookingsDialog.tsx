"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

interface ReleaseBookingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Überschrift, z. B. "Event löschen?" */
  title: string;
  /** Was passiert, wenn bestätigt wird. */
  description: string;
  confirmLabel?: string;
  submitting?: boolean;
  /** Wird mit der Entscheidung zu den Buchungen aufgerufen. */
  onConfirm: (releaseBookings: boolean) => void;
}

/**
 * Bestätigungsdialog für das Löschen bzw. Absagen eines Events oder Weeklys.
 *
 * Die auf der VATGER Homepage geblockten Stationen verschwinden nicht von
 * selbst – hier wird entschieden, ob sie mit zurückgezogen werden. Die
 * Voreinstellung ist "zurückziehen", weil die Stationen eines abgesagten
 * Events niemand mehr braucht; wer die Blockade behalten will (etwa weil das
 * Event nur verschoben wird), nimmt den Haken heraus.
 */
export function ReleaseBookingsDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Löschen",
  submitting = false,
  onConfirm,
}: ReleaseBookingsDialogProps) {
  const [release, setRelease] = useState(true);

  // Bei jedem Öffnen mit der Voreinstellung starten.
  useEffect(() => {
    if (open) setRelease(true);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-3 rounded-md border p-3">
          <Checkbox
            id="release-bookings"
            checked={release}
            disabled={submitting}
            onCheckedChange={(checked) => setRelease(checked === true)}
          />
          <div className="space-y-1">
            <label htmlFor="release-bookings" className="text-sm font-medium leading-none cursor-pointer">
              Stationsbuchungen auf der VATGER Homepage zurückziehen
            </label>
            <p className="text-xs text-muted-foreground">
              Ohne Haken bleiben die für dieses Event geblockten Stationen gebucht und müssen auf der
              Homepage von Hand entfernt werden.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button variant="destructive" disabled={submitting} onClick={() => onConfirm(release)}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
