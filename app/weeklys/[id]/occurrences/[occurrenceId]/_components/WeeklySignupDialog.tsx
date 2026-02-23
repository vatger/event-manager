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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import AutomaticEndorsement from "@/components/AutomaticEndorsement";
import { getRatingValue } from "@/utils/ratingToValue";
import { Trash2 } from "lucide-react";

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
  user: {
    userCID: number;
    rating: string;
  };
  airports: string[];
  fir?: string;
  userSignup?: {
    id: number;
    remarks: string | null;
  } | null;
  onSignupChange: () => void;
}

export function WeeklySignupDialog({
  occurrence,
  config,
  user,
  airports,
  fir,
  userSignup,
  onSignupChange,
}: WeeklySignupDialogProps) {
  const [open, setOpen] = useState(false);
  const [remarks, setRemarks] = useState(userSignup?.remarks || "");
  const [loading, setLoading] = useState(false);
  const [showUnsubscribeDialog, setShowUnsubscribeDialog] = useState(false);
  const [unsubscribing, setUnsubscribing] = useState(false);

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

  const handleUnsubscribe = async () => {
    setUnsubscribing(true);

    try {
      const response = await fetch(
        `/api/weeklys/${config.id}/occurrences/${occurrence.id}/signup`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Fehler beim Abmelden");
      }

      toast.success("Erfolgreich abgemeldet");
      setShowUnsubscribeDialog(false);
      setOpen(false);
      onSignupChange();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Ein Fehler ist aufgetreten"
      );
    } finally {
      setUnsubscribing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full">{isEditMode ? "Bearbeiten" : "Anmelden"}</Button>
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
            <AutomaticEndorsement
              user={{
                userCID: user.userCID,
                rating: getRatingValue(user.rating),
              }}
              event={{
                airport: airports[0] || "",
                fir: fir,
              }}
            />
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
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {isEditMode && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setShowUnsubscribeDialog(true)}
                className="sm:mr-auto"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Abmelden
              </Button>
            )}
            <div className="flex gap-2 sm:ml-auto">
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
            </div>
          </DialogFooter>
        </form>
      </DialogContent>

      {/* Unsubscribe Confirmation Dialog */}
      <AlertDialog open={showUnsubscribeDialog} onOpenChange={setShowUnsubscribeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Wirklich abmelden?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchtest du dich wirklich von diesem Weekly Event abmelden? Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unsubscribing}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnsubscribe}
              disabled={unsubscribing}
              className="bg-red-600 hover:bg-red-700"
            >
              {unsubscribing ? "Wird abgemeldet..." : "Ja, abmelden"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
