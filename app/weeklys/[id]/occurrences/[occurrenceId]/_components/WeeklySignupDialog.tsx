"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AutomaticEndorsement } from "@/components/automatic-endorsement";

interface WeeklySignupDialogProps {
  occurrence: {
    id: number;
    date: Date;
    signupDeadline: Date | null;
  };
  config: {
    id: number;
    requiresRoster: boolean;
  };
  userSignup?: {
    id: number;
    remarks: string | null;
  } | null;
  onSignupChange: () => void;
}

export function WeeklySignupDialog({
  occurrence,
  config,
  userSignup,
  onSignupChange,
}: WeeklySignupDialogProps) {
  const [open, setOpen] = useState(false);
  const [remarks, setRemarks] = useState(userSignup?.remarks || "");
  const [loading, setLoading] = useState(false);

  const isEditMode = !!userSignup;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const method = isEditMode ? "PUT" : "POST";
      const response = await fetch(
        `/api/weeklys/${config.id}/occurrences/${occurrence.id}/signup`,
        {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ remarks: remarks || null }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Fehler beim Anmelden");
      }

      toast.success(
        isEditMode ? "Änderungen gespeichert" : "Erfolgreich angemeldet"
      );
      setOpen(false);
      onSignupChange();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Ein Fehler ist aufgetreten"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>{isEditMode ? "Bearbeiten" : "Anmelden"}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditMode ? "Anmeldung bearbeiten" : "Anmelden"}
            </DialogTitle>
            <DialogDescription>
              {isEditMode
                ? "Bearbeite deine Anmeldung für dieses Weekly Event"
                : "Melde dich für dieses Weekly Event an"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <AutomaticEndorsement />
            <div className="grid gap-2">
              <Label htmlFor="remarks">Bemerkungen (optional)</Label>
              <Textarea
                id="remarks"
                placeholder="z.B. Verfügbarkeit, Präferenzen, etc."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                maxLength={500}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                {remarks.length}/500 Zeichen
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={loading}>
              {loading
                ? "..."
                : isEditMode
                ? "Änderungen speichern"
                : "Jetzt anmelden"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
