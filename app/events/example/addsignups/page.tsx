"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import AvailabilityEditor, { AvailabilitySelectorHandle } from "@/components/AvailabilitySelector";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { useSession } from "next-auth/react";

// ---- Types ----
type TimeRange = { start: string; end: string };

type Signup = {
  id: string | number;
  userCID?: string | number;
  user?: { cid?: string | number; name?: string };
  endorsement?: "GND" | "TWR" | "APP" | "CTR" | string;
  availability?: { available?: TimeRange[]; unavailable?: TimeRange[] };
  preferredStations?: string | null;
  remarks?: string | null;
};

type EventDetails = {
  id: string | number;
  name: string;
  startTime: string;
  endTime: string;
  airports?: string[] | string | null;
  description?: string | null;
  status?: string;
};

type DevUser = {
  id: number;
  cid: number;
  name: string;
  rating: string;
};

const PRIORITY: Record<string, number> = { DEL: 0, GND: 1, TWR: 2, APP: 3, CTR: 4 };

// ---- Helpers ----
function toHHMMUTC(dateIso?: string, round?: "down" | "up"): string {
  if (!dateIso) return "00:00";
  const d = new Date(dateIso);
  let hh = d.getHours();
  let mm = d.getMinutes();
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

function badgeClassFor(endorsement?: string) {
  switch (endorsement) {
    case "DEL":
      return "bg-green-100 text-green-800";
    case "GND":
      return "bg-blue-100 text-blue-800";
    case "TWR":
      return "bg-amber-100 text-amber-800";
    case "APP":
      return "bg-purple-100 text-purple-800";
    case "CTR":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

// ---- Edit Modal ----
function EditSignupModal({
  open,
  onClose,
  event,
  signup,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  event: EventDetails;
  signup: Signup | null;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const avRef = useRef<AvailabilitySelectorHandle>(null);
  const [endorsement, setEndorsement] = useState<string>("");
  const [preferredStations, setPreferredStations] = useState<string>("");
  const [remarks, setRemarks] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
        onSaved();
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
        onDeleted();
        onClose();
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
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

export default function DevAddSignupsPage() {
  const { data: session } = useSession();

  const [eventId, setEventId] = useState<string>("");
  const [event, setEvent] = useState<EventDetails | null>(null);
  const [eventError, setEventError] = useState<string>("");
  const [eventLoading, setEventLoading] = useState<boolean>(false);

  const [signups, setSignups] = useState<Signup[]>([]);
  const [signupsLoading, setSignupsLoading] = useState<boolean>(false);
  const [signupsError, setSignupsError] = useState<string>("");

  // Users management state
  const [users, setUsers] = useState<DevUser[]>([]);
  const [usersLoading, setUsersLoading] = useState<boolean>(false);
  const [usersError, setUsersError] = useState<string>("");
  const [selectedUserCID, setSelectedUserCID] = useState<string>("");

  // New user form
  const [newCid, setNewCid] = useState<string>("");
  const [newName, setNewName] = useState<string>("");
  const [newRating, setNewRating] = useState<string>("");
  const [creatingUser, setCreatingUser] = useState<boolean>(false);

  // Create form state
  const createRef = useRef<AvailabilitySelectorHandle>(null);
  const [cEndorsement, setCEndorsement] = useState<string>("");
  const [cDesired, setCDesired] = useState<string>("");
  const [cRemarks, setCRemarks] = useState<string>("");
  const [creating, setCreating] = useState(false);

  // Edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editSignup, setEditSignup] = useState<Signup | null>(null);

  const ordered = useMemo(() => {
    const groups: Record<string, Signup[]> = {};
    for (const s of signups) {
      const k = (s.endorsement || "UNSPEC") as string;
      if (!groups[k]) groups[k] = [];
      groups[k].push(s);
    }
    const keys = Object.keys(groups).sort((a, b) => (PRIORITY[a] ?? 999) - (PRIORITY[b] ?? 999));
    return { keys, groups };
  }, [signups]);

  async function loadEventAndSignups() {
    if (!eventId) return;
    setEventLoading(true);
    setEventError("");
    setSignupsError("");
    try {
      const er = await fetch(`/api/events/${eventId}`);
      if (!er.ok) {
        const d = await er.json().catch(() => ({}));
        throw new Error(d.error || "Event konnte nicht geladen werden");
      }
      const ev = await er.json();
      setEvent(ev);
    } catch (e: any) {
      setEventError(e.message || String(e));
      setEvent(null);
    } finally {
      setEventLoading(false);
    }
    await loadSignups();
  }

  async function loadSignups() {
    if (!eventId) return;
    setSignupsLoading(true);
    setSignupsError("");
    try {
      const r = await fetch(`/api/events/${eventId}/signup/dev`);
      if (!r.ok) throw new Error("Signups konnten nicht geladen werden");
      const data = await r.json();
      setSignups(data);
    } catch (e: any) {
      setSignupsError(e.message || String(e));
      setSignups([]);
    } finally {
      setSignupsLoading(false);
    }
  }

  async function loadUsers() {
    setUsersLoading(true);
    setUsersError("");
    try {
      const res = await fetch(`/api/user`);
      if (!res.ok) throw new Error("Benutzer konnten nicht geladen werden");
      const data = await res.json();
      setUsers(data);
    } catch (e: any) {
      setUsersError(e.message || String(e));
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }

  async function createNewUser() {
    if (!newCid || !newName || !newRating) {
      alert("Bitte CID, Name und Rating angeben.");
      return;
    }
    setCreatingUser(true);
    try {
      const res = await fetch(`/api/user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cid: parseInt(newCid, 10),
          name: newName,
          rating: newRating,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "Benutzer-Erstellung fehlgeschlagen");
        return;
      }
      await loadUsers();
      setSelectedUserCID(String(data.cid ?? newCid));
      setNewCid("");
      setNewName("");
      setNewRating("");
    } finally {
      setCreatingUser(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function createSignup() {
    if (!event) {
      alert("Bitte erst ein Event laden.");
      return;
    }
    if (!selectedUserCID) {
      alert("Bitte einen Benutzer auswählen.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(`/api/events/${event.id}/signup/dev`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: event.id,
          userCID: Number(selectedUserCID),
          availability: {
            available: createRef.current?.getAvailable(),
            unavailable: createRef.current?.getUnavailable(),
          },
          endorsement: cEndorsement,
          preferredStations: cDesired,
          remarks: cRemarks,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "Erstellen fehlgeschlagen (Event status? Session?)");
        return;
      }
      await loadSignups();
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Dev: Beispiel-Signups verwalten (nur Entwicklung)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Diese Seite dient nur in der Entwicklungs-/Produktionsvorbereitung zum schnellen Anlegen und Bearbeiten von Signups. Aktionen verwenden die bestehenden API-Routen und benötigen eine gültige Session. Das Erstellen neuer Signups erfolgt für den aktuell eingeloggten User.
          </div>
          <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-end">
            <div className="w-56">
              <Label>Event ID</Label>
              <Input value={eventId} onChange={(e) => setEventId(e.target.value)} placeholder="z. B. 5" />
            </div>
            <Button onClick={loadEventAndSignups} disabled={!eventId || eventLoading}>{eventLoading ? "Lade..." : "Event laden"}</Button>
            <Button variant="outline" onClick={loadSignups} disabled={!eventId || signupsLoading}>Signups neu laden</Button>
          </div>
          {eventError && <div className="text-red-500 text-sm">{eventError}</div>}
          {event && (
            <div className="text-sm">Geladenes Event: <span className="font-medium">{event.name}</span> • {new Date(event.startTime).toLocaleDateString("de-DE")} • {toHHMMUTC(event.startTime)}z - {toHHMMUTC(event.endTime)}z • Status {event.status}</div>
          )}
        </CardContent>
      </Card>

      {/* Benutzerverwaltung */}
      <Card>
        <CardHeader>
          <CardTitle>Benutzer erstellen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <Label>CID</Label>
              <Input value={newCid} onChange={(e) => setNewCid(e.target.value)} placeholder="z. B. 1234567" />
            </div>
            <div>
              <Label>Name</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Vorname Nachname" />
            </div>
            <div>
              <Label>Rating</Label>
              <Input value={newRating} onChange={(e) => setNewRating(e.target.value)} placeholder="z. B. S2, C1" />
            </div>
            <div className="flex items-end justify-end">
              <Button onClick={createNewUser} disabled={creatingUser}>{creatingUser ? "Erstelle..." : "Benutzer anlegen"}</Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={loadUsers} disabled={usersLoading}>{usersLoading ? "Lade..." : "Benutzer neu laden"}</Button>
            {usersError && <span className="text-xs text-red-500">{usersError}</span>}
          </div>
        </CardContent>
      </Card>

      {/* Create new signup for current session user */}
      <Card>
        <CardHeader>
          <CardTitle>Neues Signup (ausgewählter Benutzer)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Benutzer auswählen</Label>
            <Select value={selectedUserCID} onValueChange={setSelectedUserCID}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Bitte Benutzer wählen" /></SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.cid} value={String(u.cid)}>
                    {u.cid} — {u.name} ({u.rating})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {usersLoading && <div className="text-xs text-muted-foreground mt-1">Lade Benutzer...</div>}
            {usersError && <div className="text-xs text-red-500 mt-1">{usersError}</div>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>Endorsement</Label>
              <Select value={cEndorsement} onValueChange={setCEndorsement}>
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
              <Input value={cDesired} onChange={(e) => setCDesired(e.target.value)} placeholder="e.g. EDDM_N_TWR" />
            </div>
            <div>
              <Label>Remarks</Label>
              <Input value={cRemarks} onChange={(e) => setCRemarks(e.target.value)} placeholder="Bemerkungen..." />
            </div>
          </div>
          <div>
            <Label>Availability (UTC)</Label>
            <AvailabilityEditor
              eventStart={toHHMMUTC(event?.startTime, "down")}
              eventEnd={toHHMMUTC(event?.endTime, "up")}
              innerRef={createRef}
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={createSignup} disabled={creating || !event}>{creating ? "Erstelle..." : "Signup anlegen"}</Button>
          </div>
          {!session && <div className="text-xs text-muted-foreground">Hinweis: Zum Erstellen wird eine Session benötigt.</div>}
          {event && event.status !== "SIGNUP_OPEN" && <div className="text-xs text-amber-600">Event ist nicht SIGNUP_OPEN. POST ist ggf. blockiert. Als Admin kannst du bestehende Signups bearbeiten.</div>}
        </CardContent>
      </Card>

      {/* Existing signups */}
      <Card className="relative overflow-hidden">
        <CardHeader>
          <CardTitle>Bestehende Signups</CardTitle>
        </CardHeader>
        <CardContent>
          {signupsLoading ? (
            <div className="text-sm text-muted-foreground">Lade Signups...</div>
          ) : signupsError ? (
            <div className="text-sm text-red-500">{signupsError}</div>
          ) : signups.length === 0 ? (
            <div className="text-sm text-muted-foreground">Keine Signups vorhanden.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>CID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Endorsement</TableHead>
                  <TableHead>Desired</TableHead>
                  <TableHead>RMK</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordered.keys.flatMap((k) => [
                  <TableRow key={`grp-${k}`}>
                    <TableCell colSpan={6} className="bg-muted/50 font-semibold">{k}</TableCell>
                  </TableRow>,
                  ...(ordered.groups[k] || []).map((s) => (
                    <TableRow key={String(s.id)}>
                      <TableCell>{s.user?.cid ?? s.userCID}</TableCell>
                      <TableCell>{s.user?.name ?? ""}</TableCell>
                      <TableCell><Badge className={badgeClassFor(s.endorsement)}>{s.endorsement || "UNSPEC"}</Badge></TableCell>
                      <TableCell>{s.preferredStations || "-"}</TableCell>
                      <TableCell>{s.remarks || "-"}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => { setEditSignup(s); setEditOpen(true); }}>Bearbeiten</Button>
                      </TableCell>
                    </TableRow>
                  )),
                ])}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit modal */}
      {event && (
        <EditSignupModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          signup={editSignup}
          event={event}
          onSaved={loadSignups}
          onDeleted={loadSignups}
        />
      )}
    </div>
  );
}
