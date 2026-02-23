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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { UserPlus, Loader2 } from "lucide-react";

interface AddSignupByCIDDialogProps {
  configId: number;
  occurrenceId: number;
  onSignupAdded: () => void;
}

export function AddSignupByCIDDialog({
  configId,
  occurrenceId,
  onSignupAdded,
}: AddSignupByCIDDialogProps) {
  const [open, setOpen] = useState(false);
  const [userCID, setUserCID] = useState("");
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate CID
    const cidNumber = parseInt(userCID);
    if (isNaN(cidNumber) || cidNumber <= 0) {
      toast.error("Bitte gib eine gültige CID ein");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `/api/weeklys/${configId}/occurrences/${occurrenceId}/signup-by-cid`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userCID: cidNumber,
            remarks: remarks || null,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Fehler beim Hinzufügen der Anmeldung");
      }

      toast.success(`${data.signup.user.firstName} ${data.signup.user.lastName} wurde erfolgreich angemeldet`);
      setOpen(false);
      setUserCID("");
      setRemarks("");
      onSignupAdded();
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
        <Button variant="outline" size="sm" className="gap-2">
          <UserPlus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Anmeldung hinzufügen</DialogTitle>
            <DialogDescription>
              Melde einen Nutzer für dieses Weekly Event an.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="userCID">CID *</Label>
              <Input
                id="userCID"
                type="number"
                placeholder="z.B. 1234567"
                value={userCID}
                onChange={(e) => setUserCID(e.target.value)}
                required
                min="1"
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="remarks">Bemerkungen (optional)</Label>
              <Textarea
                id="remarks"
                placeholder="some space"
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
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                setOpen(false);
                setUserCID("");
                setRemarks("");
              }}
              disabled={loading}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Wird hinzugefügt...
                </>
              ) : (
                "Hinzufügen"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
