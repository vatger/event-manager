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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, ShieldCheck, UserPlus, X } from "lucide-react";
import { CPT_FIR_NAMES } from "@/config/cptFirMapping";
import type { CptResponsible } from "../_lib/cptTypes";

interface ResponsiblesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  firCode: string;
  responsibles: CptResponsible[];
  canEdit: boolean;
  /** Nach Änderungen die Liste im Manager aktualisieren */
  onChanged: () => void;
}

/**
 * Verwaltung der CPT-Verantwortlichen einer FIR.
 *
 * Diese Nutzer bekommen die Erinnerungen (3 Tage vorher und am Tag des CPTs)
 * und dürfen CPTs ihrer FIR als gepostet markieren.
 */
export function ResponsiblesDialog({
  open,
  onOpenChange,
  firCode,
  responsibles,
  canEdit,
  onChanged,
}: ResponsiblesDialogProps) {
  const [cidInput, setCidInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<number | null>(null);

  useEffect(() => {
    if (open) setCidInput("");
  }, [open]);

  const add = async () => {
    const cid = Number(cidInput.trim());
    if (!cid || Number.isNaN(cid)) {
      toast.error("Bitte eine gültige CID eingeben");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/cpt/responsibles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firCode, userCID: cid }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Fehler beim Hinzufügen");
      toast.success(`${json.responsible?.name ?? cid} ist jetzt CPT-Verantwortlich`);
      setCidInput("");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Hinzufügen");
    } finally {
      setAdding(false);
    }
  };

  const remove = async (cid: number) => {
    setRemoving(cid);
    try {
      const res = await fetch(
        `/api/cpt/responsibles/${cid}?fir=${encodeURIComponent(firCode)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Fehler beim Entfernen");
      }
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Entfernen");
    } finally {
      setRemoving(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-accent-500" />
            CPT-Verantwortliche · {CPT_FIR_NAMES[firCode] ?? firCode}
          </DialogTitle>
          <DialogDescription>
            Diese Personen werden drei Tage vor einem CPT und – solange es nicht
            als gepostet markiert ist – noch einmal am Tag des CPTs per
            Forums-Ping erinnert. Sie dürfen CPTs dieser FIR als gepostet
            markieren.
          </DialogDescription>
        </DialogHeader>

        {canEdit && (
          <div className="flex gap-2">
            <Input
              placeholder="CID hinzufügen…"
              value={cidInput}
              inputMode="numeric"
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
        )}

        <div className="max-h-72 overflow-y-auto space-y-1.5">
          {responsibles.length === 0 ? (
            <Alert>
              <AlertDescription>
                Noch niemand eingetragen. Erinnerungen gehen ersatzweise an die
                FIR-Leitung.
              </AlertDescription>
            </Alert>
          ) : (
            responsibles.map((r) => (
              <div
                key={r.userCID}
                className="flex items-center justify-between gap-2 rounded-lg border p-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{r.name}</p>
                  <p className="text-xs text-muted-foreground">
                    CID {r.userCID}
                    {r.rating ? ` · ${r.rating}` : ""}
                  </p>
                </div>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => remove(r.userCID)}
                    disabled={removing === r.userCID}
                    aria-label={`${r.name} entfernen`}
                  >
                    {removing === r.userCID ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            ))
          )}
        </div>

        {!canEdit && (
          <Badge variant="secondary" className="w-fit text-[10px]">
            Nur Ansicht – Verantwortliche pflegt die FIR-Eventleitung.
          </Badge>
        )}
      </DialogContent>
    </Dialog>
  );
}
