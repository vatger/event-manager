"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { teamApi } from "@/lib/api/team";
import type { TeamGroup, TeamMember } from "@/types/fir";
import { plural } from "./teamUtils";

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

/** Gruppe anlegen (ohne `group`) oder Name und Beschreibung ändern. */
export function GroupFormDialog({
  open,
  onOpenChange,
  firCode,
  group,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  firCode: string;
  group?: TeamGroup | null;
  onSaved: (groupId: number) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const editing = !!group;

  useEffect(() => {
    if (open) {
      setName(group?.name ?? "");
      setDescription(group?.description ?? "");
    }
  }, [open, group]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (name.trim().length < 2) return;
    setSaving(true);
    try {
      if (group) {
        await teamApi.updateGroup(firCode, group.id, {
          name: name.trim(),
          description: description.trim() || null,
        });
        toast.success("Gruppe gespeichert");
        onSaved(group.id);
      } else {
        const created = await teamApi.createGroup(firCode, {
          name: name.trim(),
          description: description.trim() || undefined,
        });
        toast.success(`Gruppe „${name.trim()}“ angelegt`);
        onSaved(created.id);
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error, "Die Gruppe konnte nicht gespeichert werden"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{editing ? "Gruppe bearbeiten" : "Neue Gruppe"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Name und Beschreibung der Gruppe ändern."
                : "Mitglieder und Rechte legst du im Anschluss fest."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="group-name">Name</Label>
              <Input
                id="group-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z. B. Besetzungsplaner"
                maxLength={80}
                autoFocus
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="group-description">
                Beschreibung <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="group-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Wofür ist diese Gruppe da?"
                maxLength={190}
                disabled={saving}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={saving || name.trim().length < 2}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Speichern" : "Gruppe anlegen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Wer verliert durch die Aktion den Zugang zum Department? */
function LeavingNotice({ leaving }: { leaving: TeamMember[] }) {
  if (leaving.length === 0) return null;
  return (
    <span className="mt-3 block rounded-md border border-warning-600/40 bg-warning-600/10 p-3 text-foreground">
      {leaving.length === 1
        ? `${leaving[0].name} ist danach in keiner Gruppe mehr und verliert den Zugang zum Admin-Bereich.`
        : `${leaving.length} Personen sind danach in keiner Gruppe mehr und verlieren den Zugang zum Admin-Bereich: ${leaving
            .map((p) => p.name)
            .join(", ")}.`}
    </span>
  );
}

/** Rückfrage mit Folgenhinweis für alles, was Zugriff entzieht. */
export function ConfirmRemovalDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  leaving = [],
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  /** Personen, die dadurch ganz aus dem Department fallen */
  leaving?: TeamMember[];
  onConfirm: () => Promise<void>;
}) {
  const [working, setWorking] = useState(false);

  const confirm = async (event: React.MouseEvent) => {
    event.preventDefault();
    setWorking(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error, "Das hat nicht geklappt"));
    } finally {
      setWorking(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {description}
            <LeavingNotice leaving={leaving} />
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={working}>Abbrechen</AlertDialogCancel>
          <AlertDialogAction
            onClick={confirm}
            disabled={working}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {working && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export const describeGroupDeletion = (group: TeamGroup) =>
  group.members.length === 0
    ? "Die Gruppe hat keine Mitglieder. Ihre Rechte entfallen."
    : `${plural(group.members.length, "Mitglied verliert", "Mitglieder verlieren")} die Rechte dieser Gruppe.`;
