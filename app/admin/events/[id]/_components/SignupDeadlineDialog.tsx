"use client";

import { useState } from "react";
import { Event } from "@/types";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calendar, X, AlertCircle } from "lucide-react";

interface SignupDeadlineDialogProps {
  event: Event;
  onUpdate: (updatedEvent: Event) => void;
  children?: React.ReactNode;
}

export function SignupDeadlineDialog({ event, onUpdate, children }: SignupDeadlineDialogProps) {
  const [open, setOpen] = useState(false);
  const [signupDeadline, setSignupDeadline] = useState(
    event.signupDeadline ? new Date(event.signupDeadline).toISOString().split('T')[0] : ""
  );
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
        const payload = signupDeadline
        ? {
            signupDeadline: new Date(signupDeadline).toISOString(),
            status: "SIGNUP_OPEN",
          }
        : {
            signupDeadline: null,
            status: "SIGNUP_OPEN",
          };
      const res = await fetch(`/api/events/${event.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Fehler beim Aktualisieren");

      const updatedEvent = await res.json();
      onUpdate(updatedEvent);
      toast.success("Anmeldefrist aktualisiert");
      setOpen(false);
    } catch (error) {
      console.error("Fehler:", error);
      toast.error("Fehler beim Aktualisieren der Anmeldefrist");
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ signupDeadline: null }),
      });

      if (!res.ok) throw new Error("Fehler beim Entfernen");

      const updatedEvent = await res.json();
      onUpdate(updatedEvent);
      setSignupDeadline("");
      toast.success("Anmeldefrist entfernt");
      setOpen(false);
    } catch (error) {
      console.error("Fehler:", error);
      toast.error("Fehler beim Entfernen der Anmeldefrist");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm">
            <Calendar className="h-4 w-4 mr-2" />
            Anmeldefrist {event.signupDeadline ? "bearbeiten" : "festlegen"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Anmeldefrist bearbeiten</DialogTitle>
          <DialogDescription>
            Lege fest, bis wann sich Controller für dieses Event anmelden können.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="signupDeadline">Anmeldefrist</Label>
            <Input
              id="signupDeadline"
              type="date"
              value={signupDeadline}
              onChange={(e) => setSignupDeadline(e.target.value)}
            />
          </div>

          {event.signupDeadline && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Aktuelle Anmeldefrist: <strong>{formatDate(event.signupDeadline)}</strong>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex justify-between">
          <div>
            {event.signupDeadline && (
              <Button 
                variant="outline" 
                onClick={handleRemove}
                disabled={loading}
                type="button"
              >
                <X className="h-4 w-4 mr-2" />
                Entfernen
              </Button>
            )}
          </div>
          <div className="flex gap-2">
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
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}