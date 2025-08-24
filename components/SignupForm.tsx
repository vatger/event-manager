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
import { acceleratedValues, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useEventSignup } from "@/hooks/useEventSignup";
import { DeleteIcon, Trash2Icon, TrashIcon } from "lucide-react";
import { airportRules } from "@/data/airportRules";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import AvailabilitySlider, { AvailabilitySelectorHandle } from "./AvailabilitySelector";
import { toast } from "sonner";
import { useSession } from "next-auth/react";

interface SignupFormProps {
  event: any;
  onClose: () => void;
}

export default function SignupForm({ event, onClose }: SignupFormProps) {
  const {data: session} = useSession()
  
  const [availability, setAvailability] = useState("");
  const [endorsement, setEndorsement] = useState(""); 
  const [desiredPosition, setDesiredPosition] = useState("");
  const [breaks, setBreaks] = useState("");

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  
  const { isSignedUp, signupId, signupData } = useEventSignup(event.id);
  
  const rules = airportRules[event.airports];
  const areas = Object.keys(rules.areas);

  const avselectorRef = useRef<AvailabilitySelectorHandle>(null)
  
  console.log("SIGNUPDATA", isSignedUp, signupId, signupData)

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (signupData && !hydrated) {
      setAvailability(signupData.availability ?? "");
      setEndorsement(signupData.endorsement ?? "");
      setDesiredPosition(
        signupData.preferredPositions ??
          ""
      );
      setBreaks(signupData.breaks ?? "");
      setHydrated(true);
    }
  }, [signupData, hydrated]);

  async function submitSignup() {
    
    const val = avselectorRef.current?.validate();
    if(!val?.ok) {
      toast(val?.errors)
      return;
    }

    setSaving(true)
    setError("")
    
    console.log("Available", avselectorRef.current?.getAvailable())
    console.log("Eventid", event.id)

    const method = isSignedUp && signupId ? "PUT" : "POST";
    const url =
      isSignedUp && signupId ? `/api/events/${event.id}/signup/${session?.user.id}` : `/api/events/${event.id}/signup`;

    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventId: event.id,
          availability: {available: avselectorRef.current?.getAvailable(), unavailable: avselectorRef.current?.getUnavailable()},
          endorsement,
          preferredStations: desiredPosition,
          breakrequests: breaks,
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
            eventStart="16:00"
            eventEnd="21:00"
            initialUnavailable={[{ start: "09:00", end: "14:00" },{ start: "18:00", end: "20:00" }]}
            innerRef={avselectorRef}
            />
          </div>
          
            {rules.tier === 1 && (
              <div>
              <Label className="pb-2">Endorsement</Label>
              <Select defaultValue={endorsement} onValueChange={(v) => setEndorsement(v)}>
                <SelectTrigger className="w-full">
                <SelectValue placeholder="Bitte Wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                {areas.map((area) => (
                  <SelectItem key={area} value={area}>
                    {area}
                  </SelectItem>
                ))}
                </SelectGroup>
                </SelectContent>
              </Select>
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
            <Label className="pb-2">Break Requests</Label>
            <Textarea
              placeholder="Any break requests..."
              value={breaks}
              onChange={(e) => setBreaks(e.target.value)}
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
                  : "Sign up"}</Button>
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
