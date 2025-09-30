"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import AvailabilityEditor, { AvailabilitySelectorHandle } from "@/components/AvailabilitySelector";

export type TimeRange = { start: string; end: string };
export type SignupRow = {
  id: string | number;
  userCID?: string | number;
  user?: { cid?: string | number; name?: string };
  endorsement?: string | null;
  availability?: { available?: TimeRange[]; unavailable?: TimeRange[] };
  preferredStations?: string | null;
  remarks?: string | null;
};

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
  const avRef = useRef<AvailabilitySelectorHandle>(null);
  const [endorsement, setEndorsement] = useState<string>("");
  const [preferredStations, setPreferredStations] = useState<string>("");
  const [remarks, setRemarks] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  console.log(signup)

  useEffect(() => {
    if (!signup) return;
    setEndorsement(signup.endorsement || "");
    setPreferredStations(signup.preferredStations || "");
    setRemarks(signup.remarks || "");
  }, [signup]);

  async function saveChanges() {
    if (!signup) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/events/${event.id}/signup/${signup.user?.cid ?? signup.userCID}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          availability: {
            available: avRef.current?.getAvailable(),
            unavailable: avRef.current?.getUnavailable(),
          },
          endorsement,
          preferredStations,
          remarks,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || "Update fehlgeschlagen");
      } else {
        onSaved?.();
        onClose();
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteSignup() {
    if (!signup) return;
    const confirmDelete = window.confirm("Signup wirklich löschen?");
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/events/${event.id}/signup/${signup.user?.cid ?? signup.userCID}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || "Löschen fehlgeschlagen");
      } else {
        onDeleted?.();
        onClose();
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[calc(100vh-4rem)] overflow-auto">
        <DialogHeader>
          <DialogTitle>Signup bearbeiten</DialogTitle>
        </DialogHeader>
        {signup && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Nutzer: {signup.user?.name || "Unbekannt"} • CID {String(signup.user?.cid ?? signup.userCID)}
            </div>
            <div>
              <Label>Availability (UTC)</Label>
              <AvailabilityEditor
                eventStart={toHHMMUTC(event.startTime, "down")}
                eventEnd={toHHMMUTC(event.endTime, "up")}
                initialUnavailable={signup.availability?.unavailable}
                innerRef={avRef}
              />
            </div>
            <div>
              <Label>Endorsement</Label>
              <Select value={endorsement} onValueChange={setEndorsement}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Bitte wählen" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DEL">DEL</SelectItem>
                  <SelectItem value="GND">GND</SelectItem>
                  <SelectItem value="TWR">TWR</SelectItem>
                  <SelectItem value="APP">APP</SelectItem>
                  <SelectItem value="CTR">CTR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Desired Position</Label>
              <Input value={preferredStations} onChange={(e) => setPreferredStations(e.target.value)} placeholder="e.g. EDDM_N_TWR" />
            </div>
            <div>
              <Label>Remarks</Label>
              <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Bemerkungen..." />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>Abbrechen</Button>
              <Button variant="destructive" onClick={deleteSignup} disabled={deleting}>{deleting ? "Lösche..." : "Löschen"}</Button>
              <Button onClick={saveChanges} disabled={saving}>{saving ? "Speichere..." : "Speichern"}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
