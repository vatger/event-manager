"use client";

import type * as React from "react";
import { useState } from "react";
import { Event } from "@/types";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RequiresRight } from "@/components/RequiresRight";
import { useEventCapabilities } from "@/hooks/useEventCapabilities";
import { Link } from "lucide-react";

interface RosterLinkDialogProps {
  event: Event;
  onUpdate: (updatedEvent: Event) => void;
  children?: React.ReactNode;
}

export function RosterLinkDialog({ event, onUpdate, children }: RosterLinkDialogProps) {
  const { capabilities } = useEventCapabilities(event.id);
  const [open, setOpen] = useState(false);
  const [rosterlink, setRosterlink] = useState(event.rosterlink || "");
  const [loading, setLoading] = useState(false);


  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rosterlink: rosterlink.trim() || null, status: "ROSTER_PUBLISHED" }),
      });

      if (!res.ok) throw new Error("Fehler beim Aktualisieren");

      const updatedEvent = await res.json();
      onUpdate(updatedEvent);
      toast.success("Roster-Link aktualisiert");
      setOpen(false);
    } catch (error) {
      console.error("Fehler:", error);
      toast.error("Fehler beim Aktualisieren des Roster-Links");
    } finally {
      setLoading(false);
    }
  };


  // Ohne Recht bleibt der Knopf sichtbar, ist aber gesperrt und sagt warum
  const allowed = capabilities.publishRoster;
  const trigger = (children as React.ReactElement<{ disabled?: boolean }> | undefined) || (
          <Button variant="outline" className="justify-start w-full" size="sm">
            <Link className="h-4 w-4 mr-2" />
            Roster-Link {event.rosterlink ? "bearbeiten" : "hinzufügen"}
          </Button>
        );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {allowed ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : (
        <RequiresRight allowed={false} capability="publishRoster">{trigger}</RequiresRight>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Roster-Link bearbeiten</DialogTitle>
          <DialogDescription>
            Füge einen Link zum Besetzungsplan hinzu.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rosterlink">Roster-Link</Label>
            <Input
              id="rosterlink"
              placeholder="https://docs.google.com/spreadsheets/..."
              value={rosterlink}
              onChange={(e) => setRosterlink(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => setOpen(false)}
            disabled={loading}
            type="button"
          >
            Abbrechen
          </Button>
          <Button 
            onClick={handleSave}
            disabled={loading}
            type="button"
          >
            {loading ? "Wird gespeichert..." : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}