"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import AvailabilityEditor, { AvailabilitySelectorHandle } from "@/components/AvailabilitySelector";
import { Signup, TimeRange } from "@/types";
import { useUser } from "@/hooks/useUser";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";

export type SignupRow = Signup;

export type EventRef = {
  id: string | number;
  name?: string;
  startTime: string;
  endTime: string;
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
  const { canInOwnFIR } = useUser();

  const avRef = useRef<AvailabilitySelectorHandle>(null);
  const [preferredStations, setPreferredStations] = useState("");
  const [remarks, setRemarks] = useState("");
  const [cidInput, setCidInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hydration für bestehende Signups
  useEffect(() => {
    if (!signup) return;
    setPreferredStations(signup.preferredStations || "");
    setRemarks(signup.remarks || "");
  }, [signup]);

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
              {signup.modifiedAfterDeadline && !signup.deletedAt && (
                <Alert className="border-orange-500">
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                  <AlertDescription>
                    Diese Anmeldung wurde nach der Deadline geändert.
                    {signup.changeLog && signup.changeLog.length > 0 && (
                      <div className="mt-2 text-xs">
                        <strong>Änderungen:</strong>
                        <ul className="list-disc list-inside mt-1">
                          {signup.changeLog.map((change, idx) => (
                            <li key={idx}>
                              {change.field} am {new Date(change.changedAt).toLocaleString("de-DE")}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
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
