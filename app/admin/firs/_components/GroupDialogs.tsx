// app/admin/firs/[code]/_components/GroupDialogs.tsx
"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Group } from "./types";
import { Loader2 } from "lucide-react";

/** Create */
export function CreateGroupDialog({
  open, onOpenChange, firCode, onCreated,
}: {
  open: boolean; onOpenChange: (o: boolean) => void;
  firCode: string; onCreated: (newGroupId: number) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });

  async function createGroup() {
    if (!form.name.trim()) return toast.error("Gruppenname ist erforderlich");
    setSaving(true);
    try {
      const res = await fetch(`/api/firs/${firCode}/groups`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(await res.text());
      const g = await res.json();
      toast.success("Gruppe erstellt");
      setForm({ name: "", description: "" });
      onCreated(g.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Erstellen");
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Neue Gruppe</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Name" value={form.name} onChange={e=>setForm(s=>({...s, name: e.target.value}))} />
          <Input placeholder="Beschreibung (optional)" value={form.description} onChange={e=>setForm(s=>({...s, description: e.target.value}))} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={()=>onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={createGroup} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Erstellen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Edit */
export function EditGroupDialog({
  open, onOpenChange, firCode, group, onUpdated,
}: {
  open: boolean; onOpenChange: (o: boolean) => void;
  firCode: string; group: Group | null; onUpdated: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });

  useEffect(() => {
    setForm({ name: group?.name ?? "", description: group?.description ?? "" });
  }, [group, open]);

  async function updateGroup() {
    if (!group) return;
    if (!form.name.trim()) return toast.error("Gruppenname ist erforderlich");
    setSaving(true);
    try {
      const res = await fetch(`/api/firs/${firCode}/groups/${group.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Gruppe aktualisiert");
      onUpdated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Aktualisieren");
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Gruppe bearbeiten</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Name" value={form.name} onChange={e=>setForm(s=>({...s, name: e.target.value}))} />
          <Input placeholder="Beschreibung (optional)" value={form.description} onChange={e=>setForm(s=>({...s, description: e.target.value}))} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={()=>onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={updateGroup} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Delete */
export function DeleteGroupDialog({
  open, onOpenChange, firCode, groupId, onDeleted,
}: {
  open: boolean; onOpenChange: (o: boolean) => void;
  firCode: string; groupId: number | null; onDeleted: () => void;
}) {
  const [saving, setSaving] = useState(false);

  async function deleteGroup() {
    if (!groupId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/firs/${firCode}/groups/${groupId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Gruppe gelöscht");
      onDeleted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Löschen");
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Gruppe löschen</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          Bist du sicher? Diese Aktion kann nicht rückgängig gemacht werden.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={()=>onOpenChange(false)}>Abbrechen</Button>
          <Button variant="destructive" onClick={deleteGroup} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Löschen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
