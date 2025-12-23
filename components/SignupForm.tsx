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
import { Trash2Icon, UserRoundX, UserX } from "lucide-react";
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
  const [airportEndorsements, setAirportEndorsements] = useState<Record<string, boolean>>({});
  const [loadingEndorsements, setLoadingEndorsements] = useState(false);
  
  const userCID = session?.user.id;

  const { loading, isSignedUp, signupData } = useEventSignup(event.id, userCID);

  const avselectorRef = useRef<AvailabilitySelectorHandle>(null)

  // Get event airports as array
  const eventAirports = useMemo(() => {
    let airports: string[] = [];
    if (Array.isArray(event.airports)) {
      airports = event.airports;
    } else if (typeof event.airports === 'string') {
      try {
        // Try to parse if it's a JSON string
        const parsed = JSON.parse(event.airports);
        airports = Array.isArray(parsed) ? parsed : [event.airports];
      } catch {
        // Not JSON, treat as single airport
        airports = [event.airports];
      }
    }
    console.log("[SignupForm] Event airports parsed:", airports, "from:", event.airports);
    return airports;
  }, [event.airports]);

  useEffect(() => {
    if (!signupData || hydrated) return;

    console.log("Hydrating from signupData:", signupData);
    
    setAvailability(signupData.availability ?? {});
    setDesiredPosition(signupData.preferredStations ?? "");
    setRemarks(signupData.remarks ?? "");
    setHydrated(true);
    
  }, [signupData, hydrated, eventAirports]);

  // Fetch endorsements for all airports to determine which ones user can staff
  useEffect(() => {
    if (!userCID || !session?.user.rating || eventAirports.length === 0) return;
    
    const fetchAirportEndorsements = async () => {
      setLoadingEndorsements(true);
      
      try {
        console.log("[SignupForm] Checking endorsements for airports:", eventAirports);
        
        // Check endorsements for each airport in parallel for better performance
        const endorsementChecks = eventAirports.map(async (airport) => {
          console.log("[SignupForm] Checking endorsement for airport:", airport);
          const res = await fetch("/api/endorsements/group", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user: {
                userCID: Number(userCID),
                rating: getRatingValue(session.user.rating),
              },
              event: {
                airport: airport,
                fir: event.firCode || "EDMM",
              },
            }),
          });
          
          if (res.ok) {
            const data = await res.json();
            console.log("[SignupForm] Endorsement result for", airport, ":", data.group);
            return { airport, canStaff: !!data.group };
          }
          console.log("[SignupForm] No endorsement for", airport);
          return { airport, canStaff: false };
        });
        
        const results = await Promise.all(endorsementChecks);
        const finalEndorsements: Record<string, boolean> = {};
        results.forEach(({ airport, canStaff }) => {
          finalEndorsements[airport] = canStaff;
        });
        
        console.log("[SignupForm] Final endorsement results:", finalEndorsements);
        setAirportEndorsements(finalEndorsements);
      } catch (error) {
        console.error("Error fetching airport endorsements:", error);
      } finally {
        setLoadingEndorsements(false);
      }
    };
    
    fetchAirportEndorsements();
  }, [userCID, session?.user.rating, eventAirports, event.firCode]);

  // Parse opt-out airports from remarks (!ICAO format)
  const parseOptOutAirports = (remarksText: string): string[] => {
    const optOutPattern = /!([A-Z]{4})/g;
    const matches = remarksText.matchAll(optOutPattern);
    const optedOut = Array.from(matches, m => m[1]);
    console.log("[SignupForm] Parsed opt-outs from remarks:", optedOut, "from:", remarksText);
    return optedOut;
  };

  // Calculate final airport list based on endorsements and opt-outs
  const getSelectedAirports = (): string[] => {
    const optedOut = parseOptOutAirports(remarks);
    const selected = eventAirports.filter(airport => 
      airportEndorsements[airport] && !optedOut.includes(airport)
    );
    console.log("[SignupForm] getSelectedAirports - eventAirports:", eventAirports);
    console.log("[SignupForm] getSelectedAirports - airportEndorsements:", airportEndorsements);
    console.log("[SignupForm] getSelectedAirports - optedOut:", optedOut);
    console.log("[SignupForm] getSelectedAirports - result:", selected);
    return selected;
  };

  // Auto-endorsement uses the first airport as a representative
  // This is acceptable as endorsements are typically valid across all airports in an event
  const autoEndorsementProps = useMemo(() => ({
    user: {
      userCID: Number(userCID),
      rating: getRatingValue(session?.user.rating || "OBS"),
    },
    event: {
      airport: Array.isArray(event.airports) ? event.airports[0] : event.airports,
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

    // Calculate airports based on endorsements and opt-outs
    const selectedAirports = getSelectedAirports();
    
    console.log("[SignupForm] Submitting with selectedAirports:", selectedAirports);
    console.log("[SignupForm] Current airportEndorsements:", airportEndorsements);
    console.log("[SignupForm] Current remarks:", remarks);
    
    // Validate that user can staff at least one airport
    if (selectedAirports.length === 0) {
      toast.error("Du kannst keinen der Airports für dieses Event lotsen oder hast alle Airports mit !ICAO ausgeschlossen");
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
          selectedAirports: selectedAirports,
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
      "Möchtest du dich wirklich abmelden?"
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
  const isAfterDeadline = event.signupDeadline && new Date() > new Date(event.signupDeadline);

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
                Deine Anmeldung wurde gelöscht. Du kannst sie nun wiederherstellen.
              </span>
            ) : isAfterDeadline && !isSignedUp ? (
              <span className="text-orange-600 font-medium">
                ⚠️ Achtung: Der Anmeldeschluss ist bereits vorbei. Deine Anmeldung wird als Anfrage behandelt und das Eventteam wird informiert.
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
          
          {/* Airport Information for Multi-Airport Events */}
          {eventAirports.length > 1 && (
            <div className="space-y-2 border rounded-md p-3 bg-muted/30">
              <Label>Airports (automatisch zugewiesen)</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Du wirst automatisch für alle Airports angemeldet, die du laut deinen Endorsements lotsen darfst.
              </p>
              {loadingEndorsements ? (
                <div className="flex items-center gap-2 text-sm">
                  <div className="h-4 w-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                  <span>Prüfe Endorsements...</span>
                </div>
              ) : (
                <div className="space-y-1">
                  {(() => {
                    // Parse opt-outs once outside the map for performance
                    const optedOut = parseOptOutAirports(remarks);
                    return eventAirports.map((airport) => {
                      const canStaff = airportEndorsements[airport];
                      const isOptedOut = optedOut.includes(airport);
                      return (
                        <div key={airport} className="flex items-center gap-2 text-sm">
                          {canStaff ? (
                            isOptedOut ? (
                              <span className="text-orange-600">✗ {airport} (ausgeschlossen mit !{airport})</span>
                            ) : (
                              <span className="text-green-600">✓ {airport}</span>
                            )
                          ) : (
                            <span className="text-muted-foreground">○ {airport} (nicht berechtigt)</span>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                💡 Tipp: Füge <code className="bg-background px-1 py-0.5 rounded">!ICAO</code> in deinen Bemerkungen hinzu, um dich von einem Airport auszuschließen (z.B. "!EDDM").
              </p>
            </div>
          )}
          
          {/* Automatische Gruppenzuweisung */}
          {!loading && userCID && eventAirports.length === 1 && (
            <AutomaticEndorsement {...autoEndorsementProps} />
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
              placeholder={eventAirports.length > 1 
                ? "Bemerkungen (z.B. '!EDDM' um dich von München auszuschließen)..." 
                : "Some space..."}
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
                    {deleting ? "Deleting..." : <UserX/>}
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
