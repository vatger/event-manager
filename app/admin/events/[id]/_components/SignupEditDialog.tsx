"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AvailabilityEditor, { AvailabilitySelectorHandle } from "@/components/AvailabilitySelector";
import { Signup, TimeRange } from "@/types";
import { useUser } from "@/hooks/useUser";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Tooltip } from "@radix-ui/react-tooltip";
import { TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { parseEventAirports, fetchAirportEndorsements, getExcludedAirports } from "@/lib/multiAirport";
import { EndorsementResponse } from "@/lib/endorsements/types";
import { getRatingValue } from "@/utils/ratingToValue";

export type SignupRow = Signup;

export type EventRef = {
  id: string | number;
  name?: string;
  startTime: string;
  endTime: string;
  airports?: string | string[]; // Multi-airport support
  firCode?: string; // FIR code for endorsement checking
};

function toHHMMUTC(dateIso?: string, round?: "down" | "up"): string {
  if (!dateIso) return "00:00";
  const d = new Date(dateIso);
  let hh = d.getUTCHours();
  let mm = d.getUTCMinutes();
  if (round === "down") mm -= mm % 30;
  else if (round === "up") {
    const extra = mm % 30;
    if (extra !== 0) {
      mm += 30 - extra;
      if (mm >= 60) {
        mm -= 60;
        hh = (hh + 1) % 24;
      }
    }
  }
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

type SignupPayload = {
  availability: {
    available?: TimeRange[];
    unavailable?: TimeRange[];
  };
  preferredStations?: string;
  remarks?: string;
  excludedAirports?: string[]; // Excluded airports
  userCID?: number; // optional für Admins
};

export default function SignupEditDialog({
  open,
  onClose,
  event,
  signup,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  event: EventRef;
  signup: SignupRow | null;
  onSaved?: () => void;
  onDeleted?: () => void;
}) {
  const { canInOwnFIR, user } = useUser();

  const avRef = useRef<AvailabilitySelectorHandle>(null);
  const [preferredStations, setPreferredStations] = useState("");
  const [remarks, setRemarks] = useState("");
  const [excludedAirports, setExcludedAirports] = useState<string[]>([]);
  const [cidInput, setCidInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [airportEndorsements, setAirportEndorsements] = useState<Record<string, { canStaff: boolean; endorsement: EndorsementResponse | null }>>({});
  const [loadingEndorsements, setLoadingEndorsements] = useState(false);
  
  // Get event airports as array
  const eventAirports = useMemo(() => {
    return parseEventAirports(event.airports);
  }, [event.airports]);

  // Hydration für bestehende Signups
  useEffect(() => {
    if (!signup) return;
    setPreferredStations(signup.preferredStations || "");
    setRemarks(signup.remarks || "");
    setExcludedAirports(
      Array.isArray(signup.excludedAirports) ? signup.excludedAirports : []
    );
  }, [signup]);
  
  // Fetch endorsements for all airports to determine which ones user can staff
  useEffect(() => {
    const userCID = signup?.user?.cid || signup?.userCID;
    const userRating = signup?.user?.rating;
    
    if (!userCID || !userRating || eventAirports.length === 0 || !event.firCode) return;
    
    const loadEndorsements = async () => {
      setLoadingEndorsements(true);
      
      try {
        const endorsements = await fetchAirportEndorsements(
          eventAirports,
          Number(userCID),
          userRating,
          event.firCode!
        );
        
        setAirportEndorsements(endorsements);
      } catch (error) {
        console.error("Error fetching airport endorsements:", error);
      } finally {
        setLoadingEndorsements(false);
      }
    };
    
    loadEndorsements();
  }, [signup, eventAirports, event.firCode]);
  
  // Toggle airport exclusion
  const toggleAirportExclusion = (airport: string) => {
    setExcludedAirports((prev) => {
      if (prev.includes(airport)) {
        return prev.filter((a) => a !== airport);
      } else {
        return [...prev, airport];
      }
    });
  };

  // 🧩 SAVE / CREATE
  async function saveChanges() {
    setSaving(true);
    setError(null);
    try {
      const payload: SignupPayload = {
        availability: {
          available: avRef.current?.getAvailable(),
          unavailable: avRef.current?.getUnavailable(),
        },
        preferredStations,
        remarks,
        excludedAirports,
      };

      // Admin darf userCID mitgeben (neuer Signup)
      if (!signup && canInOwnFIR("signups.manage")) {
        const cidNum = Number(cidInput);
        if (!Number.isNaN(cidNum)) payload.userCID = cidNum;
      }

      const method = signup ? "PUT" : "POST";
      const url = signup
        ? `/api/events/${event.id}/signup/${signup.user?.cid ?? signup.userCID}`
        : `/api/events/${event.id}/signup`;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Fehler beim Speichern des Signups");
      }
      toast.success(
        signup ? "Signup erfolgreich aktualisiert!" : "Signup erfolgreich angelegt!"
      );
  
      if (data.usercreated) {
        toast.info(`Neuer Nutzer (CID ${data.signup?.userCID ?? "unbekannt"}) wurde automatisch angelegt.`);
      }
      
      onSaved?.();
      onClose();
    } catch (err) {
      console.error("Signup speichern fehlgeschlagen:", err);
      if (err instanceof Error) toast.error(err.message);
      else setError("Unbekannter Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  // 🧩 DELETE (soft delete)
  async function deleteSignup() {
    if (!signup) return;
    if (!window.confirm("Anmeldung wirklich löschen? (Soft Delete - kann wiederhergestellt werden)")) return;

    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/events/${event.id}/signup/${signup.user?.cid ?? signup.userCID}`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Löschen fehlgeschlagen");
      }

      toast.success("Anmeldung wurde gelöscht (Soft Delete)");
      onDeleted?.();
      onClose();
    } catch (err) {
      console.error("Signup löschen fehlgeschlagen:", err);
      if (err instanceof Error) setError(err.message);
      else toast.error("Unbekannter Fehler beim Löschen");
    } finally {
      setDeleting(false);
    }
  }

  // 🧩 HARD DELETE (only for event team with signups.manage)
  async function hardDeleteSignup() {
    if (!signup) return;
    if (!window.confirm("⚠️ ACHTUNG: Hard Delete entfernt die Anmeldung unwiderruflich aus der Datenbank!\n\nFortfahren?")) return;

    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/events/${event.id}/signup/${signup.user?.cid ?? signup.userCID}?hard=true`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Hard Delete fehlgeschlagen");
      }

      toast.success("Anmeldung wurde permanent gelöscht (Hard Delete)");
      onDeleted?.();
      onClose();
    } catch (err) {
      console.error("Hard delete fehlgeschlagen:", err);
      if (err instanceof Error) setError(err.message);
      else toast.error("Unbekannter Fehler beim Hard Delete");
    } finally {
      setDeleting(false);
    }
  }

  // 🧩 RESTORE (undelete soft-deleted signup)
  async function restoreSignup() {
    if (!signup) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/events/${event.id}/signup/${signup.user?.cid ?? signup.userCID}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            availability: signup.availability,
            preferredStations: signup.preferredStations,
            remarks: signup.remarks,
            excludedAirports: signup.excludedAirports,
            restore: true, // Special flag to restore
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Wiederherstellen fehlgeschlagen");
      }

      toast.success("Anmeldung wurde wiederhergestellt!");
      onSaved?.();
      onClose();
    } catch (err) {
      console.error("Restore fehlgeschlagen:", err);
      if (err instanceof Error) setError(err.message);
      else toast.error("Unbekannter Fehler beim Wiederherstellen");
    } finally {
      setSaving(false);
    }
  }

  // 🧩 UI
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[calc(100vh-4rem)] overflow-auto">
        <DialogHeader>
          <DialogTitle>
            {signup ? "Signup bearbeiten" : "Neuen Signup hinzufügen"}
            {signup && signup.modifiedAfterDeadline && !signup.deletedAt && (
              <div className="pl-2 inline-block text-orange-500 align-text-middle">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <AlertCircle className="h-4 w-4 inline" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <div className="space-y-1">
                        <p className="font-semibold">Diese Anmeldung wurde nach der Deadline geändert.</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 🔹 Error Anzeige */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* 🔹 Admin-CID-Feld nur bei neuem Signup */}
          {!signup && canInOwnFIR("signups.manage") && (
            <div className="flex flex-col gap-2">
              <Label>CID des Nutzers</Label>
              <Input
                value={cidInput}
                onChange={(e) => setCidInput(e.target.value)}
                placeholder="z. B. 1649341"
              />
            </div>
          )}

          {/* 🔹 Bestehender Signup */}
          {signup && (
            <div className="flex flex-col gap-2">
              <div className="text-sm text-muted-foreground">
                Nutzer: {signup.user?.name || "Unbekannt"} • CID{" "}
                {String(signup.user?.cid ?? signup.userCID)}
              </div>
              {signup.deletedAt && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Diese Anmeldung wurde am {new Date(signup.deletedAt).toLocaleString("de-DE")} gelöscht
                    {signup.deletedBy && ` von CID ${signup.deletedBy}`}.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* 🔹 Availability */}
          <div className="flex flex-col gap-2">
            <Label>Availability</Label>
            <AvailabilityEditor
              eventStart={toHHMMUTC(event.startTime, "down")}
              eventEnd={toHHMMUTC(event.endTime, "up")}
              initialUnavailable={signup?.availability?.unavailable}
              innerRef={avRef}
            />
          </div>
          
          {/* 🔹 Airport Selection for Multi-Airport Events */}
          {eventAirports.length > 1 && signup && (
            <div className="flex flex-col gap-2">
              <Label>Airport-Auswahl</Label>
              <div className="space-y-3 border border-gray-200 dark:border-gray-800 rounded-lg p-3 bg-card">
                {loadingEndorsements ? (
                  <div className="flex items-center justify-center gap-2 py-4">
                    <div className="h-4 w-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Lade Endorsements...
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {eventAirports.map((airport) => {
                      const allExcluded = getExcludedAirports(excludedAirports);
                      const endorsementData = airportEndorsements[airport];
                      const canStaff = endorsementData?.canStaff || false;
                      const endorsement = endorsementData?.endorsement;
                      const isExcluded = allExcluded.includes(airport);
                      
                      return (
                        <button
                          key={airport}
                          type="button"
                          onClick={() => {
                            if (canStaff) {
                              toggleAirportExclusion(airport);
                            }
                          }}
                          disabled={!canStaff}
                          className={`w-full flex items-center gap-2 p-2 rounded border transition-colors text-left text-sm ${
                            canStaff 
                              ? isExcluded 
                                ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 hover:bg-orange-100 cursor-pointer'
                                : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 hover:bg-green-100 cursor-pointer'
                              : 'bg-gray-50 dark:bg-gray-900/40 border-gray-200 dark:border-gray-800 cursor-not-allowed opacity-60'
                          }`}
                        >
                          <div className={`h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                            canStaff 
                              ? isExcluded 
                                ? 'bg-orange-100 dark:bg-orange-800 text-orange-600 dark:text-orange-300'
                                : 'bg-green-100 dark:bg-green-800 text-green-600 dark:text-green-300'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                          }`}>
                            {canStaff ? (isExcluded ? '✗' : '✓') : '○'}
                          </div>
                          
                          <div className="flex-1">
                            <span className={`font-medium ${
                              canStaff 
                                ? isExcluded 
                                  ? 'text-orange-800 dark:text-orange-300'
                                  : 'text-green-800 dark:text-green-300'
                                : 'text-gray-600 dark:text-gray-500'
                            }`}>
                              {airport}
                            </span>
                            {endorsement?.group && (
                              <Badge 
                                variant="outline" 
                                className="ml-2 text-xs"
                              >
                                {endorsement.group}
                              </Badge>
                            )}
                          </div>
                          
                          <div className={`text-xs px-2 py-0.5 rounded ${
                            canStaff 
                              ? isExcluded 
                                ? 'bg-orange-100 dark:bg-orange-800 text-orange-700 dark:text-orange-300'
                                : 'bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                          }`}>
                            {canStaff ? (isExcluded ? 'Ausgeschlossen' : 'Aktiv') : 'Keine Berechtigung'}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
                
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                  Klicke auf einen Airport, um ihn ein- oder auszuschließen.
                </p>
              </div>
            </div>
          )}

          {/* 🔹 Desired Position */}
          <div className="flex flex-col gap-2">
            <Label>Desired Position</Label>
            <Input
              value={preferredStations}
              onChange={(e) => setPreferredStations(e.target.value)}
              placeholder="z. B. EDDM_TWR"
            />
          </div>

          {/* 🔹 Remarks */}
          <div className="flex flex-col gap-2">
            <Label>Remarks</Label>
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Bemerkungen..."
            />
          </div>

          {/* 🔹 Actions */}
          <div className="flex justify-between gap-2 pt-2">
            <div className="flex gap-2">
              {signup && signup.deletedAt && canInOwnFIR("signups.manage") && (
                <Button
                  variant="outline"
                  onClick={restoreSignup}
                  disabled={deleting || saving}
                >
                  Wiederherstellen
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} disabled={saving || deleting}>
                Abbrechen
              </Button>
              {signup && !signup.deletedAt && (
                <>
                  <Button
                    variant="destructive"
                    onClick={deleteSignup}
                    disabled={deleting || saving}
                  >
                    {deleting ? "Lösche..." : "Soft Delete"}
                  </Button>
                  {canInOwnFIR("signups.manage") && (
                    <Button
                      variant="destructive"
                      onClick={hardDeleteSignup}
                      disabled={deleting || saving}
                      className="bg-red-700 hover:bg-red-800"
                    >
                      {deleting ? "Lösche..." : "Hard Delete"}
                    </Button>
                  )}
                </>
              )}
              {(!signup || !signup.deletedAt) && (
                <Button onClick={saveChanges} disabled={saving || deleting}>
                  {saving ? "Speichere..." : signup ? "Speichern" : "Anlegen"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
