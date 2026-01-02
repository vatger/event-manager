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
import { EndorsementResponse } from "@/lib/endorsements/types";
import {
  parseEventAirports,
  fetchAirportEndorsements,
  getSelectedAirportsForDisplay,
  parseOptOutAirports,
} from "@/lib/multiAirport";
import { Badge } from "./ui/badge";


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
  const [airportEndorsements, setAirportEndorsements] = useState<Record<string, { canStaff: boolean; endorsement: EndorsementResponse | null }>>({});
  const [loadingEndorsements, setLoadingEndorsements] = useState(false);
  
  const userCID = session?.user.id;

  const { loading, isSignedUp, signupData } = useEventSignup(event.id, userCID);

  const avselectorRef = useRef<AvailabilitySelectorHandle>(null)

  // Get event airports as array using utility function
  const eventAirports = useMemo(() => {
    const airports = parseEventAirports(event.airports);
    console.log("[SignupForm] Event airports parsed:", airports);
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
    if (!userCID || !session?.user.rating || eventAirports.length === 0 || !event.firCode) return;
    
    const loadEndorsements = async () => {
      setLoadingEndorsements(true);
      
      try {
        console.log("[SignupForm] Fetching endorsements for airports:", eventAirports);
        
        const endorsements = await fetchAirportEndorsements(
          eventAirports,
          Number(userCID),
          session.user.rating,
          event.firCode
        );
        
        console.log("[SignupForm] Endorsements loaded:", endorsements);
        setAirportEndorsements(endorsements);
      } catch (error) {
        console.error("Error fetching airport endorsements:", error);
      } finally {
        setLoadingEndorsements(false);
      }
    };
    
    loadEndorsements();
  }, [userCID, session?.user.rating, eventAirports, event.firCode]);

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

    // Calculate airports based on endorsements and opt-outs for validation
    const selectedAirports = getSelectedAirportsForDisplay(eventAirports, airportEndorsements, remarks);
    
    console.log("[SignupForm] Selected airports for validation:", selectedAirports);
    
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
          // selectedAirports is now computed on server from endorsements + remarks
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
            <div className="space-y-4 border border-gray-200 dark:border-gray-800 rounded-lg p-4 bg-card dark:from-gray-900 dark:to-gray-800">
            {loadingEndorsements ? (
              <div className="flex items-center justify-center gap-3 py-6 bg-white dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-800">
                <div className="h-5 w-5 border-2 border-gray-300 border-t-blue-600 dark:border-t-blue-500 rounded-full animate-spin" />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Prüfe Endorsements...
                </span>
              </div>
            ) : (
              <div className="space-y-3">
                {eventAirports.map((airport) => {
                  const optedOut = parseOptOutAirports(remarks);
                  const endorsementData = airportEndorsements[airport];
                  const canStaff = endorsementData?.canStaff || false;
                  const endorsement = endorsementData?.endorsement;
                  const isOptedOut = optedOut.includes(airport);
                  
                  return (
                    <div 
                      key={airport} 
                      className={`flex items-start gap-3 p-3 rounded-lg border transition-all duration-200 ${
                        canStaff 
                          ? isOptedOut 
                            ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
                            : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                          : 'bg-gray-50 dark:bg-gray-900/40 border-gray-200 dark:border-gray-800'
                      }`}
                    >
                      {/* Status Icon */}
                      <div className={`h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                        canStaff 
                          ? isOptedOut 
                            ? 'bg-orange-100 dark:bg-orange-800 text-orange-600 dark:text-orange-300'
                            : 'bg-green-100 dark:bg-green-800 text-green-600 dark:text-green-300'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
                      }`}>
                        {canStaff ? (
                          isOptedOut ? (
                            <span className="text-xs font-bold">✗</span>
                          ) : (
                            <span className="text-xs font-bold">✓</span>
                          )
                        ) : (
                          <span className="text-xs">○</span>
                        )}
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 space-y-1.5">
                        {/* Airport Header */}
                        <div className="flex items-baseline gap-2">
                          <span className={`font-medium ${
                            canStaff 
                              ? isOptedOut 
                                ? 'text-orange-800 dark:text-orange-300'
                                : 'text-green-800 dark:text-green-300'
                              : 'text-gray-700 dark:text-gray-400'
                          }`}>
                            {airport}
                          </span>
                          
                          {endorsement?.group && (
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${
                                canStaff 
                                  ? isOptedOut 
                                    ? 'border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-400'
                                    : 'border-green-300 dark:border-green-700 text-green-700 dark:text-green-400'
                                  : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-500'
                              }`}
                            >
                              {endorsement.group}
                            </Badge>
                          )}
                        </div>
                        
                        {/* Restrictions */}
                        {endorsement?.restrictions && endorsement.restrictions.length > 0 && (
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-gray-700 dark:text-gray-400">
                              Einschränkungen:
                            </div>
                            <ul className="space-y-0.5">
                              {endorsement.restrictions.map((r, i) => (
                                <li 
                                  key={i} 
                                  className="text-xs text-gray-600 dark:text-gray-500 flex items-start gap-1.5"
                                >
                                  <div className="h-1 w-1 rounded-full bg-gray-400 dark:bg-gray-600 mt-1.5 flex-shrink-0" />
                                  {r}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                      
                      {/* Quick Status */}
                      <div className={`text-xs font-medium px-2 py-1 rounded ${
                        canStaff 
                          ? isOptedOut 
                            ? 'bg-orange-100 dark:bg-orange-800 text-orange-700 dark:text-orange-300'
                            : 'bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                      }`}>
                        {canStaff ? (isOptedOut ? 'Ausgeschlossen' : 'Verfügbar') : 'Nicht berechtigt'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            
            {/* Tip */}
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-start gap-2">
                <div className="h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-800 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs text-blue-600 dark:text-blue-400">💡</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-blue-800 dark:text-blue-300 font-medium mb-0.5">
                    Tipp zur Airport-Auswahl
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-400">
                    Füge <code className="font-mono bg-white dark:bg-blue-900/40 px-1.5 py-0.5 rounded">!ICAO</code> in deine RMKs ein, um dich von einem Airport auszuschließen (z.B. "!EDDM" für München).
                  </p>
                </div>
              </div>
            </div>
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
