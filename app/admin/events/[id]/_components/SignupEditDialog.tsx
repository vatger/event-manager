"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Signup } from "@/types";
import { useUser } from "@/hooks/useUser";
import { parseEventAirports, fetchAirportEndorsements } from "@/lib/multiAirport";
import {
  availabilityFromBlocked,
  availableMinutes,
  blockedFromAvailability,
  buildAvailabilityGrid,
} from "@/lib/signups/availabilitySlots";
import { formatDuration } from "@/lib/roster/rosterTime";
import {
  SignupDialogFrame,
  SignupNotice,
  SignupSection,
} from "@/components/signup/SignupDialogFrame";
import { AvailabilityPicker } from "@/components/signup/AvailabilityPicker";
import { AirportPicker, type AirportEndorsements } from "@/components/signup/AirportPicker";
import { PreferenceFields } from "@/components/signup/SignupFields";

export type SignupRow = Signup;

export type EventRef = {
  id: string | number;
  name?: string;
  startTime: string;
  endTime: string;
  airports?: string | string[];
  firCode?: string;
  signupSlotMinutes?: number;
};

type Confirm = "retract" | "hard" | null;

/**
 * Anmeldung bearbeiten oder anlegen – für das Eventteam.
 *
 * Dieselben Bausteine wie der Anmeldedialog der Lotsen, aber ohne die
 * Grenzen nach dem Anmeldeschluss: Das Eventteam darf Zeiten streichen,
 * Flughäfen abwählen und abmelden.
 */
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
  const canManage = canInOwnFIR("signups.manage");

  const eventAirports = useMemo(() => parseEventAirports(event.airports), [event.airports]);
  const grid = useMemo(
    () => buildAvailabilityGrid(event.startTime, event.endTime, event.signupSlotMinutes ?? 30),
    [event.startTime, event.endTime, event.signupSlotMinutes]
  );

  const [blocked, setBlocked] = useState<boolean[]>(() => grid.slots.map(() => false));
  const [excluded, setExcluded] = useState<string[]>([]);
  const [position, setPosition] = useState("");
  const [remarks, setRemarks] = useState("");
  const [cidInput, setCidInput] = useState("");
  const [endorsements, setEndorsements] = useState<AirportEndorsements>({});
  const [loadingEndorsements, setLoadingEndorsements] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<Confirm>(null);

  const userCID = signup?.user?.cid ?? signup?.userCID;
  const userRating = signup?.user?.rating;

  // Bei jedem Öffnen aus der Anmeldung füllen
  useEffect(() => {
    if (!open) return;
    setBlocked(blockedFromAvailability(grid, signup?.availability));
    setExcluded(Array.isArray(signup?.excludedAirports) ? signup.excludedAirports : []);
    setPosition(signup?.preferredStations ?? "");
    setRemarks(signup?.remarks ?? "");
    setCidInput("");
    setError("");
  }, [open, signup, grid]);

  useEffect(() => {
    if (!open || !userCID || !userRating || eventAirports.length === 0 || !event.firCode) return;
    let cancelled = false;
    setLoadingEndorsements(true);
    fetchAirportEndorsements(eventAirports, Number(userCID), userRating, event.firCode)
      .then((res) => {
        if (!cancelled) setEndorsements(res);
      })
      .catch((err) => console.error("Freigaben konnten nicht geladen werden:", err))
      .finally(() => {
        if (!cancelled) setLoadingEndorsements(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, userCID, userRating, eventAirports, event.firCode]);

  const signupUrl = userCID ? `/api/events/${event.id}/signup/${userCID}` : null;

  async function send(
    url: string,
    init: RequestInit,
    success: string,
    done?: () => void
  ): Promise<void> {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(url, init);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Das hat nicht geklappt.");
        return;
      }
      toast.success(success);
      if (data.usercreated) {
        toast.info(`CID ${data.signup?.userCID ?? ""} war noch unbekannt und wurde angelegt.`);
      }
      done?.();
      onClose();
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  const save = () => {
    const payload: Record<string, unknown> = {
      availability: availabilityFromBlocked(grid, blocked),
      preferredStations: position.trim(),
      remarks: remarks.trim(),
      excludedAirports: excluded,
    };
    if (!signup) {
      const cid = Number(cidInput.trim());
      if (!Number.isInteger(cid) || cid <= 0) {
        setError("Bitte eine gültige CID angeben.");
        return;
      }
      payload.userCID = cid;
    }
    void send(
      signupUrl ?? `/api/events/${event.id}/signup`,
      {
        method: signup ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      signup ? "Anmeldung gespeichert" : "Anmeldung angelegt",
      onSaved
    );
  };

  const restore = () =>
    signupUrl &&
    send(
      signupUrl,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restore: true,
          availability: signup?.availability,
          preferredStations: signup?.preferredStations,
          remarks: signup?.remarks,
          excludedAirports: signup?.excludedAirports,
        }),
      },
      "Anmeldung wiederhergestellt",
      onSaved
    );

  const remove = (hard: boolean) =>
    signupUrl &&
    send(
      hard ? `${signupUrl}?hard=true` : signupUrl,
      { method: "DELETE" },
      hard ? "Anmeldung endgültig gelöscht" : "Abgemeldet",
      onDeleted
    );

  const toggleAirport = (airport: string) =>
    setExcluded((prev) =>
      prev.includes(airport) ? prev.filter((a) => a !== airport) : [...prev, airport]
    );

  const isDeleted = !!signup?.deletedAt;
  const totalAvailable = availableMinutes(grid, blocked);

  const subtitle = signup
    ? [
        `${signup.user?.name || "Unbekannt"} · CID ${userCID}`,
        signup.modifiedAfterDeadline && !isDeleted ? "nach Anmeldeschluss geändert" : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : event.name;

  const footer = (
    <div className="space-y-2">
      {error && (
        <p className="text-sm text-danger-700 dark:text-danger-300" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
        {signup && !isDeleted && (
          <div className="flex gap-1 sm:mr-auto">
            <Button
              variant="ghost"
              className="flex-1 text-danger-700 hover:text-danger-700 dark:text-danger-300 sm:flex-none"
              onClick={() => setConfirm("retract")}
              disabled={busy}
            >
              Abmelden
            </Button>
            {canManage && (
              <Button
                variant="ghost"
                size="icon"
                className="text-danger-700 hover:text-danger-700 dark:text-danger-300"
                onClick={() => setConfirm("hard")}
                disabled={busy}
                title="Endgültig löschen"
                aria-label="Endgültig löschen"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
        <Button variant="outline" onClick={onClose} disabled={busy} className="sm:ml-auto">
          Abbrechen
        </Button>
        {isDeleted ? (
          canManage && (
            <Button onClick={restore} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Wiederherstellen
            </Button>
          )
        ) : (
          <Button onClick={save} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {signup ? "Speichern" : "Anlegen"}
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <>
      <SignupDialogFrame
        open={open}
        onOpenChange={(o) => !o && !busy && onClose()}
        title={signup ? "Anmeldung bearbeiten" : "Anmeldung hinzufügen"}
        subtitle={subtitle}
        footer={footer}
      >
        {isDeleted && (
          <SignupNotice>
            Abgemeldet am {new Date(signup!.deletedAt!).toLocaleString("de-DE")}
            {signup?.deletedBy ? ` von CID ${signup.deletedBy}` : ""}.
          </SignupNotice>
        )}

        {!signup && (
          <div className="space-y-2">
            <Label htmlFor="signup-cid">CID</Label>
            <Input
              id="signup-cid"
              inputMode="numeric"
              value={cidInput}
              onChange={(e) => setCidInput(e.target.value)}
              placeholder="z. B. 1649341"
            />
          </div>
        )}

        <SignupSection
          title="Verfügbarkeit (UTC)"
          aside={totalAvailable > 0 ? formatDuration(totalAvailable) : undefined}
        >
          <AvailabilityPicker grid={grid} blocked={blocked} onChange={setBlocked} />
        </SignupSection>

        {signup && eventAirports.length > 1 && (
          <SignupSection title="Flughäfen">
            <AirportPicker
              airports={eventAirports}
              endorsements={endorsements}
              loading={loadingEndorsements}
              excluded={excluded}
              onToggle={toggleAirport}
            />
          </SignupSection>
        )}

        <PreferenceFields
          position={position}
          onPositionChange={setPosition}
          remarks={remarks}
          onRemarksChange={setRemarks}
        />
      </SignupDialogFrame>

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && !busy && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "hard" ? "Endgültig löschen?" : "Abmelden?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "hard"
                ? "Die Anmeldung wird unwiderruflich entfernt."
                : "Die Anmeldung lässt sich später wiederherstellen."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger-700 text-white hover:bg-danger-800"
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void remove(confirm === "hard");
              }}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {confirm === "hard" ? "Löschen" : "Abmelden"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
