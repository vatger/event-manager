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
import { useCallback, useEffect, useRef, useState } from "react";
import { useEventSignup } from "@/hooks/useEventSignup";
import { Trash2Icon } from "lucide-react";
import AvailabilitySlider, { AvailabilitySelectorHandle } from "./AvailabilitySelector";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { Event, TimeRange } from "@/types";
import { isAirportTier1 } from "@/utils/configUtils";
import SignupGroupAssignment from "@/lib/endorsements/SignupGroupAssignment";
import { ControllerGroup } from "@/lib/endorsements/types";


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

function getEndorsementFromRating(rating: string): string {
  switch (rating) {
    case "S1":
      return "GND";
    case "S2":
      return "TWR";
    case "S3":
      return "APP";
    case "C1":
    case "C2":
    case "C3":
    case "I1":
    case "I2":
    case "I3":
    case "SUP":
    case "ADM":
      return "CTR";
    default:
      return "";
  }
}

export default function SignupForm({ event, onClose, onChanged }: SignupFormProps) {
  const {data: session} = useSession()
  
  const [availability, setAvailability] = useState<Availability>();
  const [endorsement, setEndorsement] = useState<String | null>("");
  const [desiredPosition, setDesiredPosition] = useState("");
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [autoRemarks, setAutoRemarks] = useState<string[]>([]);
  const [isGroupAssignmentLoading, setIsGroupAssignmentLoading] = useState(true);

  const rating = session?.user.rating || "";
  const userCID = session?.user.id;

  const { loading, isSignedUp, signupData } = useEventSignup(event.id, userCID);

  const avselectorRef = useRef<AvailabilitySelectorHandle>(null)
  const hasAutoSetRemarks = useRef(false);

  useEffect(() => {
    if (!signupData || hydrated) return;

    console.log("Hydrating from signupData:", signupData);
    
    setAvailability(signupData.availability ?? {});
    setEndorsement(signupData.endorsement ?? "");
    setDesiredPosition(signupData.preferredStations ?? "");
    setRemarks(signupData.remarks ?? "");
    setHydrated(true);
    
  }, [signupData, hydrated]);

  const handleGroupDetermined = useCallback((groupData: ControllerGroup) => {
    console.log("Automatische Gruppenzuweisung:", groupData);
    
    // Nur setzen wenn NICHT hydriert (also neue Anmeldung, nicht Bearbeitung)
    if (!hydrated && !hasAutoSetRemarks.current) {
      setEndorsement(groupData.group);
      
      // Setze Remarks nur wenn noch keine vorhanden sind
      setRemarks(prev => {
        if (!prev || prev.trim() === "") {
          hasAutoSetRemarks.current = true;
          return groupData.remarks.join("; ");
        }
        return prev;
      });
    }
    
    setIsGroupAssignmentLoading(false);
  }, [hydrated]);

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
    
    let e = endorsement;
    if(endorsement == "") {
      e = getEndorsementFromRating(rating)
    }

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
          endorsement: e,
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
      "Möchtest du deine Anmeldung wirklich löschen?"
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

      onChanged?.();
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
      <DialogContent className="sm:max-w-md rounded-xl max-h-[calc(100vh-4rem)] overflow-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {isSignedUp ? 
              <p>Edit Sign up for {event.name} </p> : 
              <p>Sign up for {event.name}</p> }
            
          </DialogTitle>
          <DialogDescription>
            Please fill in your availability and preferences.
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
            <SignupGroupAssignment
              cid={Number(userCID)}
              event={{
                id: event.id,
                fir: "EDMM",
                airport: event.airports,
                isTier1: isAirportTier1(event.airports)
              }}
              rating={4}
              onGroupDetermined={handleGroupDetermined}
            />
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
              placeholder={endorsement === "CTR" ? "CTR (EBG West only) ..." : "Some space..."}
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
            <Button onClick={submitSignup} disabled={saving || deleting} aria-busy={saving}>
              {saving
                ? isSignedUp
                  ? "Saving..."
                  : "Signing up..."
                : isSignedUp
                ? "Save changes"
                : "Sign up"}
            </Button>
            {isSignedUp ? (
              <Button
                variant="destructive"
                onClick={deleteSignup}
                disabled={saving || deleting}
                aria-busy={deleting}
              >
                {deleting ? "Deleting..." : <Trash2Icon/>}
              </Button>
            ) : (
              <div />
            )}
          </div>
          
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}