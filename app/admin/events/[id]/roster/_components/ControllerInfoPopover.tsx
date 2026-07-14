"use client";

import { useEffect, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  CalendarX2,
  Info,
  Loader2,
  MessageSquare,
  Star,
  StickyNote,
} from "lucide-react";
import { getBadgeClassForEndorsement } from "@/utils/EndorsementBadge";
import type { RosterController } from "../_lib/rosterTypes";
import { formatDuration, minuteToHM } from "../_lib/rosterUtils";

interface ControllerInfoPopoverProps {
  controller: RosterController;
  bestGroup: string | null;
  assignedMinutes: number;
  eventStart: Date;
  /** Bestehende interne Notiz (leer = keine) */
  note: string;
  canEdit: boolean;
  onSaveNote: (note: string) => Promise<boolean>;
}

/**
 * Detail-Popover zu einem Controller: Wunschstationen, Anmelde-Remarks,
 * Verfügbarkeit und die interne Planungsnotiz des Event-Teams.
 */
export function ControllerInfoPopover({
  controller,
  bestGroup,
  assignedMinutes,
  eventStart,
  note,
  canEdit,
  onSaveNote,
}: ControllerInfoPopoverProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(note);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setDraft(note);
  }, [open, note]);

  const save = async () => {
    setSaving(true);
    const ok = await onSaveNote(draft.trim());
    setSaving(false);
    if (ok) {
      toast.success(draft.trim() ? "Notiz gespeichert" : "Notiz entfernt");
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground shrink-0"
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={`Details zu ${controller.name}`}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80"
        align="start"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-sm">{controller.name}</p>
              <p className="text-xs text-muted-foreground">
                {controller.cid} • {controller.rating}
                {assignedMinutes > 0 && ` • ${formatDuration(assignedMinutes)} eingeplant`}
              </p>
            </div>
            <Badge className={getBadgeClassForEndorsement(bestGroup)}>
              {bestGroup ?? "?"}
            </Badge>
          </div>

          {controller.preferredStations && (
            <div className="text-sm">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-0.5">
                <Star className="h-3.5 w-3.5 text-amber-500" /> Wunschstationen
              </p>
              <p className="text-sm break-words">{controller.preferredStations}</p>
            </div>
          )}

          {controller.remarks && (
            <div className="text-sm">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-0.5">
                <MessageSquare className="h-3.5 w-3.5" /> Remarks (Anmeldung)
              </p>
              <p className="text-sm break-words whitespace-pre-wrap">{controller.remarks}</p>
            </div>
          )}

          <div className="text-sm">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-0.5">
              <CalendarX2 className="h-3.5 w-3.5" /> Verfügbarkeit
            </p>
            {!controller.hasAvailability ? (
              <p className="text-sm text-muted-foreground">Keine Angabe (ganzes Event)</p>
            ) : controller.unavailable.length === 0 ? (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                Während des gesamten Events verfügbar
              </p>
            ) : (
              <ul className="text-sm space-y-0.5">
                {controller.unavailable.map((r, i) => (
                  <li key={i} className="text-red-600 dark:text-red-400">
                    Nicht verfügbar: {minuteToHM(eventStart, r.start)}z –{" "}
                    {minuteToHM(eventStart, r.end)}z
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Separator />

          <div>
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
              <StickyNote className="h-3.5 w-3.5 text-amber-500" /> Interne Notiz (nur Event-Team)
            </p>
            {canEdit ? (
              <div className="space-y-2">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="z. B. „Will nach 20z lieber APP“, „Schicht ggf. noch tauschen“…"
                  className="min-h-16 text-sm"
                  maxLength={2000}
                />
                <div className="flex justify-end gap-2">
                  {note && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDraft("")}
                      disabled={saving}
                    >
                      Leeren
                    </Button>
                  )}
                  <Button size="sm" onClick={save} disabled={saving || draft.trim() === note.trim()}>
                    {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                    Speichern
                  </Button>
                </div>
              </div>
            ) : note ? (
              <p className="text-sm whitespace-pre-wrap">{note}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Keine Notiz vorhanden.</p>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
