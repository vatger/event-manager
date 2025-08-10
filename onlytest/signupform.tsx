"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useEventSignup } from "@/hooks/useEventSignup";

interface SignupFormProps {
  event: any;
  onClose: () => void;
}

export default function SignupForm({ event, onClose }: SignupFormProps) {
  const [availability, setAvailability] = useState("");
  const [desiredPosition, setDesiredPosition] = useState("");
  const [breaks, setBreaks] = useState("");

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const { isSignedUp, signupId, signupData } = useEventSignup(event.id);

  // Hydriere Felder zuverlässig aus signupData, aber nur einmal
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (signupData && !hydrated) {
      setAvailability(signupData.availability ?? "");
      // Unterstütze sowohl preferredPosition (singular) als auch preferredPositions (plural), je nach API-Shape
      setDesiredPosition(
        signupData.preferredPosition ??
          signupData.preferredPositions ??
          ""
      );
      setBreaks(signupData.breaks ?? "");
      setHydrated(true);
    }
  }, [signupData, hydrated]);

  async function submitSignup() {
    setSaving(true);
    setError("");

    const method = isSignedUp && signupId ? "PUT" : "POST";
    const url =
      isSignedUp && signupId ? `/api/signups/${signupId}` : "/api/signups";

    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventId: event.id,
          availability,
          preferredPosition: desiredPosition,
          breaks,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Etwas ist schiefgelaufen.");
        return;
      }

      onClose();
    } catch (err) {
      console.error("Anmeldung speichern fehlgeschlagen:", err);
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSignup() {
    if (!signupId) return;
    const confirmDelete = window.confirm(
      "Möchtest du deine Anmeldung wirklich löschen?"
    );
    if (!confirmDelete) return;

    setDeleting(true);
    setError("");

    try {
      const res = await fetch(`/api/signups/${signupId}`, {
        method: "DELETE",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Löschen fehlgeschlagen.");
        return;
      }

      onClose();
    } catch (err) {
      console.error("Anmeldung löschen fehlgeschlagen:", err);
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            Anmeldung für {event?.name}
          </DialogTitle>
          <DialogDescription>
            Bitte Verfügbarkeit und Präferenzen eintragen.
          </DialogDescription>
        </DialogHeader>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div>
            <Label className="pb-2">Verfügbarkeit</Label>
            <Input
              placeholder="z. B. 16:00 - 20:00 UTC"
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
            />
          </div>

          <div>
            <Label className="pb-2">Wunschposition</Label>
            <Input
              placeholder="z. B. EDDM_TWR"
              value={desiredPosition}
              onChange={(e) => setDesiredPosition(e.target.value)}
            />
          </div>

          <div>
            <Label className="pb-2">Pausenwünsche</Label>
            <Textarea
              placeholder="Optionale Anmerkungen zu Pausen..."
              value={breaks}
              onChange={(e) => setBreaks(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm" role="alert">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between pt-2">
            {isSignedUp ? (
              <Button
                variant="destructive"
                onClick={deleteSignup}
                disabled={saving || deleting}
                aria-busy={deleting}
              >
                {deleting ? "Löschen..." : "Anmeldung löschen"}
              </Button>
            ) : (
              <div />
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={saving || deleting}
              >
                Abbrechen
              </Button>
              <Button
                onClick={submitSignup}
                disabled={saving || deleting}
                aria-busy={saving}
              >
                {saving
                  ? isSignedUp
                    ? "Speichern..."
                    : "Anmelden..."
                  : isSignedUp
                  ? "Änderungen speichern"
                  : "Jetzt anmelden"}
              </Button>
            </div>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}