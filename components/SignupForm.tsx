"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  Clock,
  ExternalLink,
  Loader2,
  Lock,
  MapPin,
  MessageSquareText,
  RotateCcw,
  TriangleAlert,
  UserX,
} from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useEventSignup } from "@/hooks/useEventSignup";
import type { Event } from "@/types";
import {
  fetchAirportEndorsements,
  getSelectedAirportsForDisplay,
  parseEventAirports,
} from "@/lib/multiAirport";
import { isSignupLocked } from "@/lib/signups/signupLock";
import {
  availabilityFromBlocked,
  availableMinutes,
  blockedFromAvailability,
  buildAvailabilityGrid,
  shortAvailableRuns,
} from "@/lib/signups/availabilitySlots";
import { forumMessageUrl, withdrawalTitle } from "@/lib/events/forumMessage";
import {
  formatEventDate,
  formatEventWeekday,
  formatLocalTime,
  formatZulu,
} from "@/lib/events/eventDisplay";
import { formatDuration } from "@/lib/roster/rosterTime";
import { SignupDialogFrame, SignupNotice, SignupSection } from "./signup/SignupDialogFrame";
import { AvailabilityPicker } from "./signup/AvailabilityPicker";
import { AirportPicker, type AirportEndorsements } from "./signup/AirportPicker";
import { AvailabilitySummary, availableSpans, PreferenceFields } from "./signup/SignupFields";

interface SignupFormProps {
  event: Event;
  onClose: () => void;
  onChanged?: () => void;
}

/** Mindestlänge einer verfügbaren Spanne – kürzere lassen sich kaum einplanen */
const MIN_AVAILABLE_MINUTES = 60;

/**
 * Anmelden, Anmeldung bearbeiten, abmelden – aus Sicht des Lotsen.
 *
 * - Neue Anmeldung und geänderte Zeiten werden bestätigt: Wer sich anmeldet,
 *   sagt die Zeiten zu.
 * - Nach dem Anmeldeschluss nur noch in positive Richtung (lib/signups/
 *   signupLock). Abmelden läuft dann über eine vorbereitete Forum-PN an die
 *   Eventverantwortlichen und die Ansprechpartner der FIR (roster.contact).
 */
export default function SignupForm({ event, onClose, onChanged }: SignupFormProps) {
  const { data: session } = useSession();
  const userCID = session?.user.id;
  const { loading, isSignedUp, signupData } = useEventSignup(event.id, userCID);

  const eventAirports = useMemo(() => parseEventAirports(event.airports), [event.airports]);
  const grid = useMemo(
    () => buildAvailabilityGrid(event.startTime, event.endTime, event.signupSlotMinutes ?? 30),
    [event.startTime, event.endTime, event.signupSlotMinutes]
  );

  const [hydrated, setHydrated] = useState(false);
  const [blocked, setBlocked] = useState<boolean[]>([]);
  const [initialBlocked, setInitialBlocked] = useState<boolean[]>([]);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [position, setPosition] = useState("");
  const [remarks, setRemarks] = useState("");

  const [endorsements, setEndorsements] = useState<AirportEndorsements>({});
  const [loadingEndorsements, setLoadingEndorsements] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [contacts, setContacts] = useState<string[] | null>(null);

  // Formular einmal aus der gespeicherten Anmeldung füllen
  useEffect(() => {
    if (loading || hydrated) return;
    const fromSignup = blockedFromAvailability(grid, signupData?.availability);
    setBlocked(fromSignup);
    setInitialBlocked(fromSignup);
    setExcluded(Array.isArray(signupData?.excludedAirports) ? signupData.excludedAirports : []);
    setPosition(signupData?.preferredStations ?? "");
    setRemarks(signupData?.remarks ?? "");
    setHydrated(true);
  }, [loading, hydrated, grid, signupData]);

  const rating = session?.user.rating;
  useEffect(() => {
    if (!userCID || !rating || eventAirports.length === 0 || !event.firCode) {
      setLoadingEndorsements(false);
      return;
    }
    let cancelled = false;
    setLoadingEndorsements(true);
    fetchAirportEndorsements(eventAirports, Number(userCID), rating, event.firCode)
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
  }, [userCID, rating, eventAirports, event.firCode]);

  const savedExcluded = useMemo(
    () => (Array.isArray(signupData?.excludedAirports) ? signupData.excludedAirports : []),
    [signupData?.excludedAirports]
  );

  if (!session) return null;

  const isDeleted = !!signupData?.deletedAt;
  const isAfterDeadline = !!event.signupDeadline && new Date() > new Date(event.signupDeadline);
  const locked = isSignedUp && !isDeleted && isSignupLocked(event);
  const userName = session.user.name || `CID ${userCID}`;

  const canExclude = (airport: string) => !locked || savedExcluded.includes(airport);
  const toggleAirport = (airport: string) =>
    setExcluded((prev) =>
      prev.includes(airport)
        ? prev.filter((a) => a !== airport)
        : canExclude(airport)
        ? [...prev, airport]
        : prev
    );

  const spans = availableSpans(grid, blocked);
  const totalAvailable = availableMinutes(grid, blocked);
  const shortRuns = shortAvailableRuns(grid, blocked, MIN_AVAILABLE_MINUTES);
  const selectedAirports = getSelectedAirportsForDisplay(eventAirports, endorsements, excluded);
  const availabilityChanged = blocked.some((b, i) => b !== initialBlocked[i]);

  const start = new Date(event.startTime);
  const end = new Date(event.endTime);
  const subtitle = `${formatEventWeekday(start)}, ${formatEventDate(start)} · ${formatZulu(start)}–${formatZulu(end)} · ${formatLocalTime(start)}–${formatLocalTime(end)} lcl`;
  const status = isDeleted
    ? { label: "Abgemeldet", tone: "neutral" as const }
    : locked
    ? { label: "Nach Anmeldeschluss", tone: "warning" as const }
    : isSignedUp
    ? { label: "Angemeldet", tone: "success" as const }
    : isAfterDeadline
    ? { label: "Nachmeldung", tone: "warning" as const }
    : { label: "Neue Anmeldung", tone: "neutral" as const };
  const shortProblem =
    shortRuns.length > 0
      ? `Mindestens ${MIN_AVAILABLE_MINUTES} min am Stück: ${shortRuns.map((r) => `${r.start}–${r.end}z`).join(", ")}`
      : null;

  const validationError = (): string | null => {
    if (totalAvailable === 0) return "Wähle mindestens eine Zeit aus.";
    if (shortRuns.length > 0) {
      return `Zeiten bitte mindestens ${MIN_AVAILABLE_MINUTES} Minuten am Stück (${shortRuns
        .map((r) => `${r.start}–${r.end}z`)
        .join(", ")}).`;
    }
    if (!loadingEndorsements && selectedAirports.length === 0) {
      return eventAirports.length > 1
        ? "Wähle mindestens einen Flughafen mit Freigabe."
        : "Für diesen Flughafen hast du keine Freigabe.";
    }
    return null;
  };

  const requestSubmit = () => {
    const problem = validationError();
    setError(problem ?? "");
    if (problem) return;
    if (!isSignedUp || availabilityChanged) setConfirmOpen(true);
    else void save();
  };

  async function request(url: string, init: RequestInit, success: string): Promise<boolean> {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(url, init);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Das hat nicht geklappt.");
        return false;
      }
      toast.success(success);
      onChanged?.();
      onClose();
      return true;
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  const ownUrl = `/api/events/${event.id}/signup/${userCID}`;

  async function save() {
    const ok = await request(
      isSignedUp ? ownUrl : `/api/events/${event.id}/signup`,
      {
        method: isSignedUp ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: event.id,
          availability: availabilityFromBlocked(grid, blocked),
          preferredStations: position.trim(),
          remarks: remarks.trim(),
          excludedAirports: excluded,
        }),
      },
      isSignedUp ? "Anmeldung gespeichert" : "Du bist angemeldet"
    );
    if (!ok) setConfirmOpen(false);
  }

  const withdraw = async () => {
    await request(ownUrl, { method: "DELETE" }, "Du bist abgemeldet");
    setWithdrawOpen(false);
  };

  const restore = () =>
    request(
      ownUrl,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restore: true,
          availability: signupData?.availability,
          preferredStations: signupData?.preferredStations,
          remarks: signupData?.remarks,
          excludedAirports: signupData?.excludedAirports,
        }),
      },
      "Anmeldung wiederhergestellt"
    );

  const openWithdraw = () => {
    setWithdrawOpen(true);
    if (locked && contacts === null) {
      fetch(`/api/events/${event.id}/contacts`)
        .then((res) => (res.ok ? res.json() : { contacts: [] }))
        .then((data) => setContacts((data.contacts ?? []).map((c: { name: string }) => c.name)))
        .catch(() => setContacts([]));
    }
  };

  const forumUrl = forumMessageUrl(contacts ?? [], withdrawalTitle(event.name, userName));
  const ready = !loading && hydrated;

  const footer = (
    <div className="space-y-2">
      {error && (
        <p className="text-sm text-danger-700 dark:text-danger-300" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
        {isSignedUp && !isDeleted && (
          <Button
            variant="ghost"
            className="text-danger-700 hover:text-danger-700 dark:text-danger-300 sm:mr-auto"
            onClick={openWithdraw}
            disabled={saving}
          >
            {locked ? <MessageSquareText className="h-4 w-4" /> : <UserX className="h-4 w-4" />}
            Abmelden
          </Button>
        )}
        <Button variant="outline" onClick={onClose} disabled={saving} className="sm:ml-auto">
          Abbrechen
        </Button>
        {isDeleted ? (
          <Button onClick={restore} disabled={saving || !ready}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Wiederherstellen
          </Button>
        ) : (
          <Button onClick={requestSubmit} disabled={saving || !ready}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSignedUp ? "Speichern" : "Anmelden"}
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <>
      <SignupDialogFrame
        open
        onOpenChange={(open) => !open && !saving && onClose()}
        title={event.name}
        subtitle={subtitle}
        status={ready ? status : undefined}
        footer={footer}
      >
        {!ready ? (
          <div className="space-y-3">
            <Skeleton className="h-48 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        ) : isDeleted ? (
          <SignupNotice icon={RotateCcw}>
            Du hast dich abgemeldet. Du kannst deine Anmeldung mit den bisherigen Angaben
            wiederherstellen.
          </SignupNotice>
        ) : (
          <>
            {locked && (
              <SignupNotice icon={Lock} tone="warning">
                <p className="font-medium">Der Anmeldeschluss ist vorbei.</p>
                <p>Du kannst noch Zeiten und Flughäfen hinzufügen. Abmelden geht per PN an das Eventteam.</p>
              </SignupNotice>
            )}
            {!isSignedUp && isAfterDeadline && (
              <SignupNotice icon={TriangleAlert} tone="warning">
                <p className="font-medium">Der Anmeldeschluss ist vorbei.</p>
                <p>Deine Anmeldung geht als Nachmeldung an das Eventteam.</p>
              </SignupNotice>
            )}

            <SignupSection
              icon={Clock}
              title="Wann bist du verfügbar?"
              aside={
                !locked && (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => setBlocked(blocked.map(() => false))}
                    >
                      Alle
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => setBlocked(blocked.map(() => true))}
                    >
                      Keine
                    </Button>
                  </div>
                )
              }
            >
              <AvailabilityPicker
                grid={grid}
                blocked={blocked}
                onChange={setBlocked}
                onlyExtend={locked}
                initiallyBlocked={initialBlocked}
              />
              <AvailabilitySummary
                spans={spans}
                totalMinutes={totalAvailable > 0 ? formatDuration(totalAvailable) : null}
                problem={shortProblem}
              />
            </SignupSection>

            <SignupSection
              icon={MapPin}
              title={eventAirports.length > 1 ? "Wo möchtest du lotsen?" : "Deine Freigabe"}
            >
              <AirportPicker
                airports={eventAirports}
                endorsements={endorsements}
                loading={loadingEndorsements}
                excluded={excluded}
                onToggle={toggleAirport}
                canExclude={canExclude}
              />
            </SignupSection>

            <SignupSection icon={MessageSquareText} title="Wünsche & Bemerkungen">
              <PreferenceFields
                position={position}
                onPositionChange={setPosition}
                remarks={remarks}
                onRemarksChange={setRemarks}
              />
            </SignupSection>
          </>
        )}
      </SignupDialogFrame>

      <AlertDialog open={confirmOpen} onOpenChange={(o) => !saving && setConfirmOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zeiten bestätigen</AlertDialogTitle>
            <AlertDialogDescription>
              Das Eventteam plant dich zu diesen Zeiten fest ein.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="divide-y rounded-lg border bg-card text-sm">
            {spans.map((s) => (
              <li key={s.key} className="flex items-center justify-between gap-3 px-3.5 py-2.5 tabular-nums">
                <span className="flex items-center gap-2 font-medium">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  {s.zulu}
                </span>
                <span className="text-muted-foreground">{s.local} lcl</span>
              </li>
            ))}
          </ul>
          {event.signupDeadline && !isAfterDeadline && (
            <p className="text-sm text-muted-foreground">
              Ab dem Anmeldeschluss lassen sich Zeiten nur noch erweitern.
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Zurück</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              onClick={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSignedUp ? "Speichern" : "Verbindlich anmelden"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={withdrawOpen} onOpenChange={(o) => !saving && setWithdrawOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{locked ? "Abmeldung beim Eventteam" : "Anmeldung zurückziehen?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {locked
                ? "Nach dem Anmeldeschluss meldest du dich per PN im Forum ab. Die Nachricht ist vorbereitet."
                : "Du kannst sie bis zum Anmeldeschluss wiederherstellen."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {locked && (
            <p className="text-sm">
              <span className="text-muted-foreground">An: </span>
              {contacts === null ? (
                <Loader2 className="inline h-4 w-4 animate-spin" />
              ) : contacts.length > 0 ? (
                contacts.join(", ")
              ) : (
                "bitte die Eventleitung der FIR eintragen"
              )}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Abbrechen</AlertDialogCancel>
            {locked ? (
              <Button asChild disabled={contacts === null}>
                <a href={forumUrl} target="_blank" rel="noopener noreferrer" onClick={() => setWithdrawOpen(false)}>
                  PN öffnen
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            ) : (
              <AlertDialogAction
                className="bg-danger-700 text-white hover:bg-danger-800"
                disabled={saving}
                onClick={(e) => {
                  e.preventDefault();
                  void withdraw();
                }}
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Abmelden
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
