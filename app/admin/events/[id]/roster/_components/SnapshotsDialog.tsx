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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Camera, History, Loader2, RotateCcw, Trash2 } from "lucide-react";
import type { ApiSnapshot } from "../_lib/rosterTypes";

interface SnapshotsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: number;
  canEdit: boolean;
  apiHeaders: Record<string, string>;
  onRestored: () => void;
}

/**
 * Snapshots verwalten: aktuellen Zustand speichern, zu einem gespeicherten
 * Stand zurückkehren oder Snapshots löschen.
 */
export function SnapshotsDialog({
  open,
  onOpenChange,
  eventId,
  canEdit,
  apiHeaders,
  onRestored,
}: SnapshotsDialogProps) {
  const [snapshots, setSnapshots] = useState<ApiSnapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}/roster/snapshots`);
      if (res.ok) {
        const data = await res.json();
        setSnapshots(data.snapshots ?? []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      load();
      setName("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/events/${eventId}/roster/snapshots`, {
        method: "POST",
        headers: apiHeaders,
        body: JSON.stringify({ name: name.trim() || undefined }),
      });
      if (!res.ok) throw new Error("Fehler beim Speichern");
      toast.success("Snapshot gespeichert");
      setName("");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  const restore = async (id: number) => {
    if (!window.confirm("Diesen Snapshot wiederherstellen? Der aktuelle Stand wird ersetzt.")) {
      return;
    }
    setBusyId(id);
    try {
      const res = await fetch(`/api/events/${eventId}/roster/snapshots/${id}`, {
        method: "POST",
        headers: apiHeaders,
      });
      if (!res.ok) throw new Error("Fehler beim Wiederherstellen");
      toast.success("Snapshot wiederhergestellt");
      onRestored();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Wiederherstellen");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: number) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/events/${eventId}/roster/snapshots/${id}`, {
        method: "DELETE",
        headers: apiHeaders,
      });
      if (!res.ok) throw new Error("Fehler beim Löschen");
      setSnapshots((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Löschen");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" /> Snapshots
          </DialogTitle>
          <DialogDescription>
            Speichere Zwischenstände des Besetzungsplans und kehre bei Bedarf dorthin zurück.
          </DialogDescription>
        </DialogHeader>

        {canEdit && (
          <div className="flex gap-2">
            <Input
              placeholder="Snapshot-Name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()}
            />
            <Button onClick={save} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Camera className="h-4 w-4 mr-1.5" />
              )}
              Speichern
            </Button>
          </div>
        )}

        <div className="max-h-80 overflow-y-auto space-y-1.5">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Lade Snapshots…
            </div>
          ) : snapshots.length === 0 ? (
            <Alert>
              <AlertDescription>Noch keine Snapshots gespeichert.</AlertDescription>
            </Alert>
          ) : (
            snapshots.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-2 rounded-lg border p-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{s.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.createdByName ? `${s.createdByName} • ` : ""}
                    {new Date(s.createdAt).toLocaleString("de-DE")}
                  </p>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => restore(s.id)}
                      disabled={busyId === s.id}
                    >
                      {busyId === s.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3.5 w-3.5 mr-1" />
                      )}
                      Wiederherstellen
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => remove(s.id)}
                      disabled={busyId === s.id}
                      aria-label="Snapshot löschen"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
