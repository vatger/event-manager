"use client";

import { useState, useEffect } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { EventTask } from "@/types/task";

interface TaskEditDialogProps {
  eventId: string;
  task: EventTask;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

export function TaskEditDialog({ eventId, task, open, onOpenChange, onUpdated }: TaskEditDialogProps) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description || "");
    if (task.dueDate) {
      const d = new Date(task.dueDate);
      const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
      setDueDate(local.toISOString().slice(0, 16));
    } else {
      setDueDate("");
    }
  }, [task]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        description: description.trim() || null,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      };
      if (task.type === "CUSTOM") {
        payload.title = title.trim();
      }

      const res = await fetch(`/api/events/${eventId}/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Fehler beim Speichern");
      }
      toast.success("Aufgabe aktualisiert");
      onOpenChange(false);
      onUpdated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aufgabe bearbeiten</DialogTitle>
          <DialogDescription>{task.title}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {task.type === "CUSTOM" && (
            <div className="space-y-2">
              <Label htmlFor="edit-title">Titel</Label>
              <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="edit-description">Beschreibung</Label>
            <Textarea id="edit-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={2000} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-due-date">Deadline</Label>
            <Input id="edit-due-date" type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Speichere..." : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
