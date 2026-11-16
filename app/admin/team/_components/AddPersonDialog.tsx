"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { teamApi } from "@/lib/api/team";
import type { Department, TeamUserSearchResult } from "@/types/fir";
import { PersonAvatar } from "./PersonAvatar";
import { UserSearch } from "./UserSearch";

/** Person suchen und in eine Gruppe des Departments aufnehmen. */
export function AddPersonDialog({
  open,
  onOpenChange,
  department,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department: Department;
  onAdded: (cid: number) => Promise<unknown>;
}) {
  // Die Leitungsgruppe besetzt nur die VATGER-Eventleitung
  const groups = department.groups.filter(
    (g) => g.kind !== "FIR_LEITUNG" || department.viewer.isGlobal
  );
  const defaultGroup = groups.find((g) => g.kind !== "FIR_LEITUNG") ?? groups[0];

  const [person, setPerson] = useState<TeamUserSearchResult | null>(null);
  const [groupId, setGroupId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setPerson(null);
      setGroupId(defaultGroup ? String(defaultGroup.id) : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const group = groups.find((g) => String(g.id) === groupId);
  const alreadyMember = !!person && !!group?.members.some((m) => m.cid === person.cid);

  const submit = async () => {
    if (!person || !group) return;
    setSaving(true);
    try {
      await teamApi.addGroupMember(department.code, group.id, person.cid);
      await onAdded(person.cid);
      toast.success(`${person.name} ist jetzt in „${group.name}“`);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Das hat nicht geklappt");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Person hinzufügen</DialogTitle>
          <DialogDescription>
            Wer in eine Gruppe aufgenommen wird, gehört zum Department {department.code}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Person</Label>
            {person ? (
              <div className="flex items-center gap-3 rounded-lg border p-2">
                <PersonAvatar name={person.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{person.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {person.cid} · {person.rating}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setPerson(null)}
                  aria-label="Andere Person wählen"
                >
                  <X />
                </Button>
              </div>
            ) : (
              <UserSearch
                autoFocus
                onPick={setPerson}
                unavailableReason={(user) =>
                  user.firCode && user.firCode !== department.code
                    ? `im Department ${user.firCode}`
                    : null
                }
              />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="add-person-group">Gruppe</Label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger id="add-person-group" className="w-full">
                <SelectValue placeholder="Gruppe wählen" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={String(g.id)}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {alreadyMember && (
              <p className="text-sm text-muted-foreground">
                {person!.name} ist bereits in dieser Gruppe.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Abbrechen
          </Button>
          <Button onClick={submit} disabled={!person || !group || alreadyMember || saving}>
            {saving && <Loader2 className="animate-spin" />}
            Hinzufügen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
