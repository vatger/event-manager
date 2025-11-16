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
import { useEffect, useMemo, useRef, useState } from "react";
import { useEventSignup } from "@/hooks/useEventSignup";
import { Trash2Icon } from "lucide-react";
import AvailabilitySlider, { AvailabilitySelectorHandle } from "./AvailabilitySelector";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { Event, TimeRange } from "@/types";
import { getRatingValue } from "@/utils/ratingToValue";
import AutomaticEndorsement from "./AutomaticEndorsement";


interface SignupFormProps {
  event: Event;
  onClose: () => void;
  onChanged?: () => void;
}

type Availability = { available: TimeRange[]; unavailable: TimeRange[] };

// Hilfsfunktion: ISO -> HH:MM (UTC), optionales Runden auf 30-Min-Raster
function toHHMMUTC(dateIso?: string, round?: "down" | "up"): string {
  if (!dateIso) return "00:00";
  const d = new Date(dateIso);
  let hh = d.getUTCHours();
  let mm = d.getUTCMinutes();
  if (round === "down") {
    mm = mm - (mm % 30);
  } else if (round === "up") {
    const extra = mm % 30;
    if (extra !== 0) {
      mm = mm + (30 - extra);
      if (mm >= 60) {
        mm -= 60;
        hh = (hh + 1) % 24;
      }
    }
  }
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export default function SignupForm({ event, onClose, onChanged }: SignupFormProps) {
  const {data: session} = useSession()
  
  const [availability, setAvailability] = useState<Availability>();
  const [desiredPosition, setDesiredPosition] = useState("");
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [hydrated, setHydrated] = useState(false);
  
  const userCID = session?.user.id;

  const { loading, isSignedUp, signupData } = useEventSignup(event.id, userCID);

  const avselectorRef = useRef<AvailabilitySelectorHandle>(null)

  useEffect(() => {
    if (!signupData || hydrated) return;

    console.log("Hydrating from signupData:", signupData);
    
    setAvailability(signupData.availability ?? {});
    setDesiredPosition(signupData.preferredStations ?? "");
    setRemarks(signupData.remarks ?? "");
    setHydrated(true);
    
  }, [signupData, hydrated]);

  const autoEndorsementProps = useMemo(() => ({
    user: {
      userCID: Number(userCID),
      rating: getRatingValue(session?.user.rating || "OBS"),
    },
    event: {
      airport: event.airports,
      fir: "EDMM",
    },
  }), [userCID, session?.user.rating, event.airports]);
  

  if (!session) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fehler!</DialogTitle>
            <DialogDescription>Du bist nicht angemeldet!</DialogDescription>
          </DialogHeader>
          <Button onClick={onClose}>Schließen</Button>
        </DialogContent>
      </Dialog>
    );
  }

  

  async function submitSignup() {
    
    const val = avselectorRef.current?.validate();
    if(!val?.ok) {
      toast(val?.errors)
      return;
    }

    setSaving(true)
    setError("")

    const method = isSignedUp ? "PUT" : "POST";
    const url =
      isSignedUp ? `/api/events/${event.id}/signup/${userCID}` : `/api/events/${event.id}/signup`;

    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventId: event.id,
          availability: {available: avselectorRef.current?.getAvailable(), unavailable: avselectorRef.current?.getUnavailable()},
          endorsement: null,
          preferredStations: desiredPosition,
          remarks,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Etwas ist schiefgelaufen.");
        return;
      }

      onChanged?.();
      onClose();
    } catch (err) {
      console.error("Anmeldung speichern fehlgeschlagen:", err);
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setSaving(false);
    }
  }
  async function deleteSignup() {
    if (!event.id || !userCID) return;
    const confirmDelete = window.confirm(
      "Möchtest du deine Anmeldung wirklich löschen? (Du kannst sie später wiederherstellen)"
    );
    if (!confirmDelete) return;

    setDeleting(true);
    setError("");

    try {
      const res = await fetch(`/api/events/${event.id}/signup/${userCID}`, {
        method: "DELETE",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Löschen fehlgeschlagen.");
        return;
      }

      toast.success("Anmeldung wurde gelöscht");
      onChanged?.();
      onClose();
    } catch (err) {
      console.error("Anmeldung löschen fehlgeschlagen:", err);
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setDeleting(false);
    }
  }

  async function restoreSignup() {
    if (!event.id || !userCID) return;
    
    setDeleting(true);
    setError("");

    try {
      const res = await fetch(`/api/events/${event.id}/signup/${userCID}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          restore: true,
          availability: signupData?.availability,
          preferredStations: signupData?.preferredStations,
          remarks: signupData?.remarks,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Wiederherstellen fehlgeschlagen.");
        return;
      }

      toast.success("Anmeldung wurde wiederhergestellt");
      onChanged?.();
      onClose();
    } catch (err) {
      console.error("Anmeldung wiederherstellen fehlgeschlagen:", err);
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setDeleting(false);
    }
  }

  const isDeleted = signupData?.deletedAt;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md rounded-xl max-h-[calc(100vh-4rem)] overflow-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {isDeleted ? (
              <p>Anmeldung wiederherstellen für {event.name}</p>
            ) : isSignedUp ? (
              <p>Edit Sign up for {event.name}</p>
            ) : (
              <p>Sign up for {event.name}</p>
            )}
          </DialogTitle>
          <DialogDescription>
            {isDeleted ? (
              <span className="text-orange-600">
                Deine Anmeldung wurde gelöscht. Du kannst sie wiederherstellen oder eine neue Anmeldung erstellen.
              </span>
            ) : (
              "Please fill in your availability and preferences."
            )}
          </DialogDescription>
        </DialogHeader>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div>
            <Label className="pb-2">Availability</Label>
            <AvailabilitySlider
              eventStart={toHHMMUTC(event.startTime, "down")}
              eventEnd={toHHMMUTC(event.endTime, "up")}
              initialUnavailable={availability?.unavailable}
              innerRef={avselectorRef}
            />
          </div>
          
          {/* Automatische Gruppenzuweisung */}
          {!loading && userCID && (
          <div>
            {!loading && userCID && (
              <AutomaticEndorsement {...autoEndorsementProps} />
            )}
          </div>
          )}

          <div>
            <Label className="pb-2">Desired Position</Label>
            <Input
              placeholder="e.g. TWR"
              value={desiredPosition}
              onChange={(e) => setDesiredPosition(e.target.value)}
            />
          </div>

          <div>
            <Label className="pb-2">Remarks</Label>
            <Textarea
              placeholder={"Some space..."}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
          
          {error && (
            <p className="text-red-500 text-sm" role="alert">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={saving || deleting}>
              Cancel
            </Button>
            {isDeleted ? (
              <Button
                onClick={restoreSignup}
                disabled={saving || deleting}
                aria-busy={deleting}
              >
                {deleting ? "Wiederherstellen..." : "Anmeldung wiederherstellen"}
              </Button>
            ) : (
              <>
                <Button onClick={submitSignup} disabled={saving || deleting} aria-busy={saving}>
                  {saving
                    ? isSignedUp
                      ? "Saving..."
                      : "Signing up..."
                    : isSignedUp
                    ? "Save changes"
                    : "Sign up"}
                </Button>
                {isSignedUp && (
                  <Button
                    variant="destructive"
                    onClick={deleteSignup}
                    disabled={saving || deleting}
                    aria-busy={deleting}
                  >
                    {deleting ? "Deleting..." : <Trash2Icon/>}
                  </Button>
                )}
              </>
            )}
          </div>
          
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
