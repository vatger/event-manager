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
import { Checkbox } from "./ui/checkbox";

interface Events {
  id: string;
  name: string;
  description: string;
  bannerUrl: string;
  airports: string;
  startTime: string;
  endTime: string;
  staffedStations: string[];
  signupDeadline: string;
  registrations: number;
  status: string;
  isSignedUp?: boolean;
}

interface SignupFormProps {
  event: Events;
  onClose: () => void;
  onChanged?: () => void;
}
type TimeRange = { start: string; end: string };
type Availability = { available: TimeRange[]; unavailable: TimeRange[] };
type AirportKey = keyof typeof airportRules;

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
      return "CTR";
    default:
      return "";
  }
}

export default function SignupForm({ event, onClose, onChanged }: SignupFormProps) {
  const {data: session} = useSession()
  if(!session) return (<div><p>Fehler! Du bist nicht angemeldet!</p></div>);
  const rating = session?.user.rating;
  const userCID = session?.user.id;

  const [availability, setAvailability] = useState<Availability>();
  const [endorsement, setEndorsement] = useState("");
  const [desiredPosition, setDesiredPosition] = useState("");
  const [remarks, setRemarks] = useState("");

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  
  const { loading, isSignedUp, signupData } = useEventSignup(event.id, userCID);
  
  const airportKey = event.airports as AirportKey;
  const rules = airportRules[airportKey];
  const areas = Object.keys(rules.areas);

  const avselectorRef = useRef<AvailabilitySelectorHandle>(null)



  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!signupData || hydrated) return;

    setAvailability(signupData.availability ?? {});
    setEndorsement(signupData.endorsement ?? "");
    setDesiredPosition(signupData.preferredStations ?? "");
    setRemarks(signupData.remarks ?? "");

    setHydrated(true);

    // Achtung: State-Logging direkt nach setXxx zeigt noch alte Werte.
    // Wenn du debuggen willst, logge signupData direkt:
    console.log("Hydrating from signupData:", signupData);
  }, [signupData, hydrated]);

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

          {/* Tier 1 airports */}
            {rules.tier === 1 && (
              <div>
              <Label className="pb-2">Endorsement</Label>
              <Select value={endorsement} onValueChange={(v) => setEndorsement(v)}>
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
                {endorsement == "CTR" && (
                  <p className="text-sm text-muted-foreground mb-1">
                    Bitte beachte, dass angenommen wird, dass du GND | ... | CTR besetzen kannt. Sollte dies anders sein, benutze das RMK-Feld.
                  </p>
                )}
              </div>
            )}

            {/* Unrestricted airports */}
            {rules.tier != 1 && (
              <div>
              {rating == "S1" ? (
                <div className="flex items-center gap-3">
                  <Checkbox
                  id="TWR?"
                  className="data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 data-[state=checked]:text-white dark:data-[state=checked]:border-blue-700 dark:data-[state=checked]:bg-blue-700"
                  checked={endorsement === "TWR"}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setEndorsement("TWR");
                    } else { setEndorsement("") }
                  }}
                    />
                  <Label htmlFor="TWR?">you have an active TWR solo?</Label>
                </div>
              ) : rating == "S2" ? (
                <div className="flex items-center gap-3">
                  <Checkbox
                  id="APP?"
                  className="data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 data-[state=checked]:text-white dark:data-[state=checked]:border-blue-700 dark:data-[state=checked]:bg-blue-700"
                  checked={endorsement === "APP"}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setEndorsement("APP");
                    } else { setEndorsement("") }
                  }}
                    />
                  <Label htmlFor="APP?">you have an active APP solo?</Label>
                </div>
              ) : ["S3", "C1", "C2", "C3", "I1", "I2"].includes(rating) ? (
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="CTR?"
                      className="data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 data-[state=checked]:text-white dark:data-[state=checked]:border-blue-700 dark:data-[state=checked]:bg-blue-700"
                      checked={endorsement === "CTR"}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setEndorsement("CTR");
                        } else { setEndorsement("") }
                      }}
                        />
                    <Label htmlFor="CTR?">you are allowed to staff CTR?</Label>
                  </div>
                ): null}
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
              placeholder={endorsement == "CTR" ? "CTR (EBG West only) ..." : "Some space..."}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
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
