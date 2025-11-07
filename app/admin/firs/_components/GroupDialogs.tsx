// app/admin/firs/[code]/_components/GroupDialogs.tsx
"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Group } from "@/types/fir";
import { Loader2, Users, AlertTriangle } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";

interface GroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  firCode: string;
}

interface CreateGroupDialogProps extends GroupDialogProps {
  onCreated: (newGroupId: number) => void;
}

interface EditGroupDialogProps extends GroupDialogProps {
  group: Group | null;
  onUpdated: () => void;
}

interface DeleteGroupDialogProps extends GroupDialogProps {
  groupId: number | null;
  groupName?: string;
  onDeleted: () => void;
}

/** Create Group Dialog */
export function CreateGroupDialog({
  open,
  onOpenChange,
  firCode,
  onCreated,
}: CreateGroupDialogProps) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });

  const { isVATGERLead } = useUser();

  useEffect(() => {
    if (open) {
      setForm({ name: "", description: "" });
    }
  }, [open]);

  async function createGroup() {
    if (!form.name.trim()) {
      toast.error("Gruppenname ist erforderlich");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/firs/${firCode}/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || "Fehler beim Erstellen der Gruppe");
      }
      
      const newGroup = await res.json();
      toast.success(`Gruppe "${form.name}" wurde erstellt`);
      setForm({ name: "", description: "" });
      onCreated(newGroup.id);
      onOpenChange(false);
    } catch (e) {
      console.error("Create group error:", e);
      toast.error(e instanceof Error ? e.message : "Fehler beim Erstellen der Gruppe");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Neue Gruppe erstellen
          </DialogTitle>
          <DialogDescription>
            Erstellen Sie eine neue Gruppe für diese FIR
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="group-name">Gruppenname *</Label>
            <Input
              id="group-name"
              placeholder="z.B. Event Team, Mentoren, ..."
              value={form.name}
              onChange={(e) => setForm(s => ({ ...s, name: e.target.value }))}
              disabled={saving}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="group-description">Beschreibung</Label>
            <Input
              id="group-description"
              placeholder="Optionale Beschreibung der Gruppe"
              value={form.description}
              onChange={(e) => setForm(s => ({ ...s, description: e.target.value }))}
              disabled={saving}
            />
          </div>
          {isVATGERLead() && (
            <div className="space-y-2">
            <Label htmlFor="group-description">Gruppentyp</Label>
            <Select defaultValue="CUSTOM" onValueChange={(value) => setForm(s => ({...s, kind: value}))}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Wähle einen Gruppentyp" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="FIR_LEITUNG">FIR Eventleitung</SelectItem>
                  <SelectItem value="FIR_TEAM">FIR Team</SelectItem>
                  <SelectItem value="CUSTOM">CUSTOM</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          )}
        </div>
        
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Abbrechen
          </Button>
          <Button 
            onClick={createGroup} 
            disabled={saving || !form.name.trim()}
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Gruppe erstellen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Edit Group Dialog */
export function EditGroupDialog({
  open,
  onOpenChange,
  firCode,
  group,
  onUpdated,
}: EditGroupDialogProps) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });

  const { isVATGERLead } = useUser();
  useEffect(() => {
    if (open && group) {
      setForm({ 
        name: group.name ?? "", 
        description: group.description ?? "" 
      });
    }
  }, [group, open]);

  async function updateGroup() {
    if (!group) return;
    
    if (!form.name.trim()) {
      toast.error("Gruppenname ist erforderlich");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/firs/${firCode}/groups/${group.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || "Fehler beim Aktualisieren der Gruppe");
      }
      
      toast.success(`Gruppe "${form.name}" wurde aktualisiert`);
      onUpdated();
      onOpenChange(false);
    } catch (e) {
      console.error("Update group error:", e);
      toast.error(e instanceof Error ? e.message : "Fehler beim Aktualisieren der Gruppe");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gruppe bearbeiten</DialogTitle>
          <DialogDescription>
            Ändern Sie den Namen oder die Beschreibung dieser Gruppe
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-group-name">Gruppenname *</Label>
            <Input
              id="edit-group-name"
              placeholder="Gruppenname"
              value={form.name}
              onChange={(e) => setForm(s => ({ ...s, name: e.target.value }))}
              disabled={saving}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="edit-group-description">Beschreibung</Label>
            <Input
              id="edit-group-description"
              placeholder="Beschreibung der Gruppe"
              value={form.description}
              onChange={(e) => setForm(s => ({ ...s, description: e.target.value }))}
              disabled={saving}
            />
          </div>
          {isVATGERLead() && (
            <div className="space-y-2">
            <Label htmlFor="group-description">Gruppentyp</Label>
            <Select defaultValue="CUSTOM" onValueChange={(value) => setForm(s => ({...s, kind: value}))}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Wähle einen Gruppentyp" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="FIR_LEITUNG">FIR Eventleitung</SelectItem>
                  <SelectItem value="FIR_TEAM">FIR Team</SelectItem>
                  <SelectItem value="CUSTOM">CUSTOM</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          )}
        </div>
        
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Abbrechen
          </Button>
          <Button 
            onClick={updateGroup} 
            disabled={saving || !form.name.trim()}
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Delete Group Dialog */
export function DeleteGroupDialog({
  open,
  onOpenChange,
  firCode,
  groupId,
  groupName = "diese Gruppe",
  onDeleted,
}: DeleteGroupDialogProps) {
  const [saving, setSaving] = useState(false);

  async function deleteGroup() {
    if (!groupId) return;
    
    setSaving(true);
    try {
      const res = await fetch(`/api/firs/${firCode}/groups/${groupId}`, { 
        method: "DELETE" 
      });
      
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || "Fehler beim Löschen der Gruppe");
      }
      
      toast.success("Gruppe wurde gelöscht");
      onDeleted();
      onOpenChange(false);
    } catch (e) {
      console.error("Delete group error:", e);
      toast.error(e instanceof Error ? e.message : "Fehler beim Löschen der Gruppe");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Gruppe löschen
          </DialogTitle>
          <DialogDescription>
            Sind Sie sicher, dass Sie die Gruppe <strong>{groupName}</strong> löschen möchten? 
            Diese Aktion kann nicht rückgängig gemacht werden.
          </DialogDescription>
        </DialogHeader>
        
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <p className="text-sm text-destructive">
            <strong>Warnung:</strong> Alle Mitglieder und Berechtigungen dieser Gruppe werden entfernt.
          </p>
        </div>
        
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Abbrechen
          </Button>
          <Button 
            variant="destructive" 
            onClick={deleteGroup} 
            disabled={saving}
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Gruppe löschen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}