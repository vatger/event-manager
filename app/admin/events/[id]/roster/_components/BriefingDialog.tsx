"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "@/components/RichTextEditor";
import { RichText } from "@/components/RichText";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface BriefingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: number;
  briefing: string | null;
  briefingUpdatedAt: string | null;
  canEdit: boolean;
  apiHeaders: Record<string, string>;
  onSaved: () => void;
}

const MAX_LENGTH = 10000;

/**
 * Freitext mit Links für Lotsen, die auf diesem Event eingeteilt sind – z. B.
 * Hinweise auf temporäre Verfahren oder eine externe PDF-Anflugkarte. Wird
 * sofort mit dem Speichern sichtbar, sobald das Event veröffentlicht ist;
 * unabhängig vom „Änderungen veröffentlichen"-Stand des Besetzungsplans.
 */
export function BriefingDialog({
  open,
  onOpenChange,
  eventId,
  briefing,
  briefingUpdatedAt,
  canEdit,
  apiHeaders,
  onSaved,
}: BriefingDialogProps) {
  const [draft, setDraft] = useState(briefing ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setDraft(briefing ?? "");
  }, [open, briefing]);

  const dirty = draft.trim() !== (briefing ?? "").trim();

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/events/${eventId}/roster/briefing`, {
        method: "PUT",
        headers: apiHeaders,
        body: JSON.stringify({ briefing: draft }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Speichern fehlgeschlagen");
      }
      await res.json();
      onSaved();
      toast.success("Briefing gespeichert");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Controller-Briefing</DialogTitle>
          <DialogDescription>
            Hinweise für eingeteilte Lotsen – wird zusammen mit dem Besetzungsplan
            öffentlich angezeigt, sobald der Plan veröffentlicht ist.
          </DialogDescription>
        </DialogHeader>

        {canEdit ? (
          <>
            <RichTextEditor
              id="roster-briefing"
              value={draft}
              onChange={setDraft}
              placeholder="z. B. Hinweise zu temporären Verfahren, gesperrten Bereichen…"
              rows={8}
              maxLength={MAX_LENGTH}
              disabled={saving}
            />
            {briefingUpdatedAt && (
              <p className="text-xs text-muted-foreground">
                Zuletzt gespeichert am{" "}
                {new Date(briefingUpdatedAt).toLocaleString("de-DE", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Abbrechen
              </Button>
              <Button onClick={save} disabled={saving || !dirty}>
                {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
                Speichern
              </Button>
            </DialogFooter>
          </>
        ) : briefing ? (
          <div className="rounded-lg border p-3 text-sm">
            <RichText text={briefing} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Noch kein Briefing hinterlegt.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default BriefingDialog;
