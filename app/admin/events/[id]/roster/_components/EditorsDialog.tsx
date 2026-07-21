"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Loader2, ShieldCheck, UserPlus, X } from "lucide-react";
import type { ApiRosterEditor } from "../_lib/rosterTypes";

interface EditorsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: number;
  apiHeaders: Record<string, string>;
}

/**
 * Verwaltung der expliziten Roster-Bearbeiter. Nur für Nutzer, die
 * Bearbeiter verwalten dürfen (Verantwortliche / event.edit / VATGER).
 */
export function EditorsDialog({ open, onOpenChange, eventId, apiHeaders }: EditorsDialogProps) {
  const [editors, setEditors] = useState<ApiRosterEditor[]>([]);
  const [loading, setLoading] = useState(false);
  const [cidInput, setCidInput] = useState("");
  const [adding, setAdding] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}/roster/editors`);
      if (res.ok) {
        const data = await res.json();
        setEditors(data.editors ?? []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      load();
      setCidInput("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const add = async () => {
    const cid = Number(cidInput.trim());
    if (!cid || isNaN(cid)) {
      toast.error("Bitte eine gültige CID eingeben");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch(`/api/events/${eventId}/roster/editors`, {
        method: "POST",
        headers: apiHeaders,
        body: JSON.stringify({ userCID: cid }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Fehler beim Hinzufügen");
      }
      const j = await res.json();
      toast.success(`${j.name ?? cid} als Bearbeiter hinzugefügt`);
      setCidInput("");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Hinzufügen");
    } finally {
      setAdding(false);
    }
  };

  const remove = async (cid: number) => {
    try {
      const res = await fetch(`/api/events/${eventId}/roster/editors/${cid}`, {
        method: "DELETE",
        headers: apiHeaders,
      });
      if (!res.ok) throw new Error("Fehler beim Entfernen");
      setEditors((prev) => prev.filter((e) => e.userCID !== cid));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Entfernen");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" /> Bearbeiter des Besetzungsplans
          </DialogTitle>
          <DialogDescription>
            Diese Nutzer dürfen den Besetzungsplan bearbeiten – zusätzlich zu
            Event-Verantwortlichen und Personen mit der Berechtigung
            &bdquo;roster.edit&ldquo;.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            placeholder="CID hinzufügen…"
            value={cidInput}
            onChange={(e) => setCidInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <Button onClick={add} disabled={adding}>
            {adding ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4 mr-1.5" />
            )}
            Hinzufügen
          </Button>
        </div>

        <div className="max-h-72 overflow-y-auto space-y-1.5">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Lade…
            </div>
          ) : editors.length === 0 ? (
            <Alert>
              <AlertDescription>
                Noch keine zusätzlichen Bearbeiter eingetragen.
              </AlertDescription>
            </Alert>
          ) : (
            editors.map((e) => (
              <div
                key={e.userCID}
                className="flex items-center justify-between gap-2 rounded-lg border p-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{e.name}</p>
                  <p className="text-xs text-muted-foreground">
                    CID {e.userCID}
                    {e.rating ? ` • ${e.rating}` : ""}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => remove(e.userCID)}
                  aria-label={`${e.name} entfernen`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
        <Badge variant="secondary" className="w-fit text-[10px]">
          Tipp: Verantwortliche und roster.edit-Berechtigte sind hier nicht aufgeführt,
          dürfen aber ebenfalls bearbeiten.
        </Badge>
      </DialogContent>
    </Dialog>
  );
}
