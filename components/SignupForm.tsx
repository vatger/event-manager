"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarClock,
  ExternalLink,
  Loader2,
  Lock,
  MessageSquareText,
  RotateCcw,
  UserX,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { CharLimitHint } from "@/components/CharLimitHint";
import { cn } from "@/lib/utils";
import { useEventSignup } from "@/hooks/useEventSignup";
import type { Event } from "@/types";
import {
  fetchAirportEndorsements,
  getSelectedAirportsForDisplay,
  parseEventAirports,
} from "@/lib/multiAirport";
import { isSignupLocked, LOCKED_SIGNUP_CONTACT_HINT } from "@/lib/signups/signupLock";
import { SIGNUP_PREFERRED_MAX, SIGNUP_REMARKS_MAX } from "@/lib/signups/signupLimits";
import {
  availabilityFromBlocked,
  availableMinutes,
  blockedFromAvailability,
  buildAvailabilityGrid,
  shortAvailableRuns,
  slotRuns,
  type AvailabilityGrid,
} from "@/lib/signups/availabilitySlots";
import { forumMessageUrl, withdrawalTitle } from "@/lib/events/forumMessage";
import {
  formatEventDate,
  formatEventWeekday,
  formatLocalDate,
  formatLocalTime,
  formatZulu,
} from "@/lib/events/eventDisplay";
import { formatDuration } from "@/lib/roster/rosterTime";
import { AvailabilityPicker } from "./signup/AvailabilityPicker";
import { AirportPicker, type AirportEndorsements } from "./signup/AirportPicker";

interface SignupFormProps {
  event: Event;
  onClose: () => void;
  onChanged?: () => void;
}

/** Mindestlänge einer verfügbaren Spanne – kürzere lassen sich kaum einplanen */
const MIN_AVAILABLE_MINUTES = 60;

/** Verfügbare Zeitspannen für die Anzeige, in Zulu und Ortszeit */
function availableSpans(grid: AvailabilityGrid, blocked: boolean[]) {
  return slotRuns(blocked, false).map((r) => {
    const start = grid.slots[r.from].startMinute;
    const end =
      r.to < grid.slots.length
        ? grid.slots[r.to].startMinute
        : grid.slots[grid.slots.length - 1].startMinute + grid.slotMinutes;
    const a = new Date(start * 60000);
    const b = new Date(end * 60000);
    return {
      key: start,
      zulu: `${formatZulu(a)}–${formatZulu(b)}`,
      local: `${formatLocalTime(a)}–${formatLocalTime(b)} lcl`,
      minutes: end - start,
    };
  });
}

function Section({
  step,
  title,
  hint,
  aside,
  children,
}: {
  step: number;
  title: string;
  hint?: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {step}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold leading-6">{title}</h3>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        {aside}
      </div>
      <div className="sm:pl-9">{children}</div>
    </section>
  );
}

function Notice({
  tone,
  icon: Icon,
  children,
}: {
  tone: "info" | "warn";
  icon: typeof Lock;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border p-3 text-xs",
        tone === "warn"
          ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
          : "border-primary/20 bg-primary/5 text-foreground"
      )}
    >
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div className="space-y-1">{children}</div>
    </div>
  );
}

/**
 * Anmelden, Anmeldung bearbeiten, abmelden.
 *
 * Drei Schritte – Verfügbarkeit, Flughäfen, Wünsche – mit fester
 * Aktionsleiste unten. Auf dem Handy füllt der Dialog den Bildschirm.
 *
 * - Eine neue Anmeldung und geänderte Zeiten werden in einem eigenen Schritt
 *   bestätigt: Wer sich anmeldet, sagt die Zeiten zu.
 * - Nach dem Anmeldeschluss nur noch in positive Richtung (siehe
 *   lib/signups/signupLock): Zeiten freigeben, Flughäfen hinzufügen, Wünsche
 *   ändern. Abmelden geht dann über eine vorbereitete Forum-PN an die
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
  const [desiredPosition, setDesiredPosition] = useState("");
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
    setDesiredPosition(signupData?.preferredStations ?? "");
    setRemarks(signupData?.remarks ?? "");
    setHydrated(true);
  }, [loading, hydrated, grid, signupData]);

  // Freigaben je Flughafen
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

  if (!session) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nicht angemeldet</DialogTitle>
            <DialogDescription>Bitte melde dich zuerst im Eventmanager an.</DialogDescription>
          </DialogHeader>
          <Button onClick={onClose}>Schließen</Button>
        </DialogContent>
      </Dialog>
    );
  }

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

  // Ableitungen für Anzeige und Prüfung
  const spans = availableSpans(grid, blocked);
  const totalAvailable = availableMinutes(grid, blocked);
  const shortRuns = shortAvailableRuns(grid, blocked, MIN_AVAILABLE_MINUTES);
  const selectedAirports = getSelectedAirportsForDisplay(eventAirports, endorsements, excluded);
  const availabilityChanged = blocked.some((b, i) => b !== initialBlocked[i]);

  const start = new Date(event.startTime);
  const end = new Date(event.endTime);
  const dateLine = `${formatEventWeekday(start)}, ${formatEventDate(start)}`;
  const timeLine = `${formatZulu(start)}–${formatZulu(end)} · ${formatLocalTime(start)}–${formatLocalTime(end)} lcl`;

  /** Prüft das Formular; liefert die erste Meldung oder null */
  const validationError = (): string | null => {
    if (totalAvailable === 0) return "Wähle mindestens eine Zeit, in der du verfügbar bist.";
    if (shortRuns.length > 0) {
      const list = shortRuns.map((r) => `${r.start}–${r.end}z`).join(", ");
      return `Verfügbare Zeiten müssen mindestens ${MIN_AVAILABLE_MINUTES} Minuten am Stück sein (${list}).`;
    }
    if (!loadingEndorsements && selectedAirports.length === 0) {
      return eventAirports.length > 1
        ? "Wähle mindestens einen Flughafen, für den du eine Freigabe hast."
        : "Für diesen Flughafen hast du laut Trainingsdaten keine Freigabe.";
    }
    return null;
  };

  const requestSubmit = () => {
    const problem = validationError();
    if (problem) {
      setError(problem);
      toast.error(problem);
      return;
    }
    setError("");
    // Zusage der Zeiten bestätigen lassen – bei neuer Anmeldung und wenn
    // sich die Verfügbarkeit geändert hat
    if (!isSignedUp || availabilityChanged) setConfirmOpen(true);
    else void save();
  };

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(
        isSignedUp ? `/api/events/${event.id}/signup/${userCID}` : `/api/events/${event.id}/signup`,
        {
          method: isSignedUp ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId: event.id,
            availability: availabilityFromBlocked(grid, blocked),
            endorsement: null,
            preferredStations: desiredPosition.trim(),
            remarks: remarks.trim(),
            excludedAirports: excluded,
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Speichern fehlgeschlagen.");
        setConfirmOpen(false);
        return;
      }
      toast.success(isSignedUp ? "Anmeldung gespeichert" : "Du bist angemeldet");
      onChanged?.();
      onClose();
    } catch (err) {
      console.error("Anmeldung speichern fehlgeschlagen:", err);
      setError("Netzwerkfehler. Bitte erneut versuchen.");
      setConfirmOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function withdraw() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/events/${event.id}/signup/${userCID}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Abmelden fehlgeschlagen.");
        return;
      }
      toast.success("Du bist abgemeldet");
      onChanged?.();
      onClose();
    } catch (err) {
      console.error("Abmelden fehlgeschlagen:", err);
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setSaving(false);
      setWithdrawOpen(false);
    }
  }

  async function restore() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/events/${event.id}/signup/${userCID}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restore: true,
          availability: signupData?.availability,
          preferredStations: signupData?.preferredStations,
          remarks: signupData?.remarks,
          excludedAirports: signupData?.excludedAirports,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Wiederherstellen fehlgeschlagen.");
        return;
      }
      toast.success("Anmeldung wiederhergestellt");
      onChanged?.();
      onClose();
    } catch (err) {
      console.error("Wiederherstellen fehlgeschlagen:", err);
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setSaving(false);
    }
  }

  const openWithdraw = () => {
    setWithdrawOpen(true);
    if (locked && contacts === null) {
      fetch(`/api/events/${event.id}/contacts`)
        .then((res) => (res.ok ? res.json() : { contacts: [] }))
        .then((data) => setContacts((data.contacts ?? []).map((c: { name: string }) => c.name)))
        .catch(() => setContacts([]));
    }
  };

  const messageTitle = withdrawalTitle(event.name, userName);
  const forumUrl = forumMessageUrl(contacts ?? [], messageTitle);

  const stateLabel = isDeleted
    ? "Abgemeldet"
    : locked
    ? "Nach Anmeldeschluss"
    : isSignedUp
    ? "Angemeldet"
    : isAfterDeadline
    ? "Nachmeldung"
    : "Neue Anmeldung";

  const showWithdraw = isSignedUp && !isDeleted;

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent
        className={cn(
          "flex flex-col gap-0 p-0",
          // Handy: ganzer Bildschirm, Aktionsleiste unten fest
          "top-0 left-0 h-[100dvh] max-h-[100dvh] w-full max-w-full translate-x-0 translate-y-0 rounded-none border-0",
          "sm:top-[50%] sm:left-[50%] sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-xl sm:border"
        )}
      >
        <DialogHeader className="space-y-1 border-b px-5 pb-4 pt-5 pr-12 text-left">
          <span className="inline-flex w-fit items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {stateLabel}
          </span>
          <DialogTitle className="text-lg leading-snug">{event.name}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-x-2 text-xs tabular-nums">
            <CalendarClock className="h-3.5 w-3.5" />
            <span>{dateLine}</span>
            <span aria-hidden>·</span>
            <span>{timeLine}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          {loading || !hydrated ? (
            <div className="space-y-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : isDeleted ? (
            <Notice tone="info" icon={RotateCcw}>
              <p className="font-medium">Du hast dich von diesem Event abgemeldet.</p>
              <p>
                Du kannst deine frühere Anmeldung mit denselben Angaben wiederherstellen und sie
                danach bearbeiten.
              </p>
            </Notice>
          ) : (
            <>
              {locked && (
                <Notice tone="warn" icon={Lock}>
                  <p className="font-medium">Der Anmeldeschluss ist vorbei.</p>
                  <p>
                    Du kannst weitere Zeiten freigeben, Flughäfen hinzufügen und Wunschposition und
                    Bemerkungen anpassen. Zeiten streichen, Flughäfen abwählen oder abmelden geht
                    nur noch über das Eventteam.
                  </p>
                </Notice>
              )}
              {!isSignedUp && isAfterDeadline && (
                <Notice tone="warn" icon={AlertTriangle}>
                  <p className="font-medium">Der Anmeldeschluss ist vorbei.</p>
                  <p>Deine Anmeldung gilt als Nachmeldung – das Eventteam wird informiert.</p>
                </Notice>
              )}

              <Section
                step={1}
                title="Wann bist du verfügbar?"
                hint={
                  locked
                    ? "Gesperrte Zeiten kannst du noch freigeben. Alle Zeiten in UTC."
                    : "Antippen schaltet einen Slot um, die Stunde links die ganze Stunde. Alle Zeiten in UTC."
                }
                aside={
                  !locked && (
                    <div className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setBlocked(blocked.map(() => false))}
                      >
                        Alles
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setBlocked(blocked.map(() => true))}
                      >
                        Nichts
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
                <div className="mt-3 rounded-lg bg-muted/50 px-3 py-2 text-xs">
                  {totalAvailable === 0 ? (
                    <span className="text-muted-foreground">Noch keine Zeit ausgewählt.</span>
                  ) : (
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-medium">Verfügbar: {formatDuration(totalAvailable)}</span>
                      {spans.map((s) => (
                        <span key={s.key} className="tabular-nums text-muted-foreground">
                          {s.zulu}
                        </span>
                      ))}
                    </span>
                  )}
                  {shortRuns.length > 0 && (
                    <p className="mt-1 text-danger-700 dark:text-danger-300">
                      Zu kurz (unter {MIN_AVAILABLE_MINUTES} min am Stück):{" "}
                      {shortRuns.map((r) => `${r.start}–${r.end}z`).join(", ")}
                    </p>
                  )}
                </div>
              </Section>

              <Section
                step={2}
                title={eventAirports.length > 1 ? "Wo möchtest du lotsen?" : "Deine Freigabe"}
                hint={
                  eventAirports.length > 1
                    ? locked
                      ? "Du kannst noch Flughäfen hinzunehmen."
                      : "Tippe einen Flughafen an, um ihn ab- oder wieder auszuwählen."
                    : "Ermittelt aus deinen Trainingsdaten."
                }
              >
                <AirportPicker
                  airports={eventAirports}
                  endorsements={endorsements}
                  loading={loadingEndorsements}
                  excluded={excluded}
                  onToggle={toggleAirport}
                  canExclude={canExclude}
                />
              </Section>

              <Section
                step={3}
                title="Wünsche & Bemerkungen"
                hint="Optional – hilft dem Eventteam beim Planen."
              >
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-position" className="text-xs">
                      Wunschposition
                    </Label>
                    <Input
                      id="signup-position"
                      placeholder="z. B. TWR, gern auch APP – kein DEL"
                      value={desiredPosition}
                      maxLength={SIGNUP_PREFERRED_MAX}
                      onChange={(e) => setDesiredPosition(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="signup-remarks" className="text-xs">
                        Bemerkungen
                      </Label>
                      <CharLimitHint length={remarks.length} max={SIGNUP_REMARKS_MAX} />
                    </div>
                    <Textarea
                      id="signup-remarks"
                      placeholder="z. B. komme etwas später, brauche eine längere Pause …"
                      value={remarks}
                      maxLength={SIGNUP_REMARKS_MAX}
                      onChange={(e) => setRemarks(e.target.value)}
                      className="min-h-[80px]"
                    />
                  </div>
                </div>
              </Section>
            </>
          )}
        </div>

        <div className="border-t bg-background px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {error && (
            <p className="mb-2 text-xs text-danger-700 dark:text-danger-300" role="alert">
              {error}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
            {showWithdraw && (
              <Button
                type="button"
                variant="ghost"
                className="text-danger-700 hover:bg-danger-50 hover:text-danger-800 dark:text-danger-300 dark:hover:bg-danger-900/30 sm:mr-auto"
                onClick={openWithdraw}
                disabled={saving}
              >
                {locked ? <MessageSquareText className="h-4 w-4" /> : <UserX className="h-4 w-4" />}
                {locked ? "Abmelden per Forum-PN" : "Abmelden"}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
              className={cn(!showWithdraw && "sm:ml-auto")}
            >
              Abbrechen
            </Button>
            {isDeleted ? (
              <Button type="button" onClick={restore} disabled={saving || loading}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                Anmeldung wiederherstellen
              </Button>
            ) : (
              <Button type="button" onClick={requestSubmit} disabled={saving || loading || !hydrated}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSignedUp ? "Änderungen speichern" : "Weiter"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>

      {/* Zusage der Zeiten */}
      <AlertDialog open={confirmOpen} onOpenChange={(o) => !saving && setConfirmOpen(o)}>
        <AlertDialogContent className="max-h-[90dvh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Bist du zu diesen Zeiten verfügbar?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>
                  Das Eventteam plant dich für diese Zeiten fest ein. Gib bitte nur Zeiten an, zu
                  denen du sicher lotsen kannst.
                </p>
                <ul className="space-y-1 rounded-lg border bg-muted/40 p-3 text-foreground">
                  {spans.map((s) => (
                    <li key={s.key} className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="font-medium tabular-nums">{s.zulu}</span>
                      <span className="text-xs tabular-nums text-muted-foreground">{s.local}</span>
                    </li>
                  ))}
                  <li className="border-t pt-1 text-xs text-muted-foreground">
                    {dateLine} · insgesamt {formatDuration(totalAvailable)}
                    {eventAirports.length > 1 && selectedAirports.length > 0 && (
                      <> · {selectedAirports.join(", ")}</>
                    )}
                  </li>
                </ul>
                {event.signupDeadline && (
                  <p className="text-xs">
                    Nach dem Anmeldeschluss ({formatLocalDate(new Date(event.signupDeadline))},{" "}
                    {formatLocalTime(new Date(event.signupDeadline))} lcl) kannst du Zeiten nur noch
                    erweitern. Abmelden geht dann nur noch per PN an das Eventteam.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
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
              {isSignedUp ? "Ja, Zeiten speichern" : "Ja, verbindlich anmelden"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Abmelden – vor dem Anmeldeschluss direkt, danach per Forum-PN */}
      <AlertDialog open={withdrawOpen} onOpenChange={(o) => !saving && setWithdrawOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {locked ? "Abmelden nach dem Anmeldeschluss" : "Wirklich abmelden?"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                {locked ? (
                  <>
                    <p>
                      Der Plan baut schon auf deiner Anmeldung auf. Abmelden kannst du dich deshalb
                      nur noch beim Eventteam. {LOCKED_SIGNUP_CONTACT_HINT}
                    </p>
                    <p>Die Nachricht ist vorbereitet – schreib nur noch kurz den Grund dazu.</p>
                    <div className="rounded-lg border bg-muted/40 p-3 text-xs text-foreground">
                      <p className="font-medium">Empfänger</p>
                      {contacts === null ? (
                        <p className="flex items-center gap-1.5 text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" /> wird geladen …
                        </p>
                      ) : contacts.length > 0 ? (
                        <p>{contacts.join(", ")}</p>
                      ) : (
                        <p className="text-muted-foreground">
                          Keine Ansprechpartner hinterlegt – trag bitte die Eventleitung der FIR
                          selbst als Empfänger ein.
                        </p>
                      )}
                      <p className="mt-2 font-medium">Betreff</p>
                      <p>{messageTitle}</p>
                    </div>
                  </>
                ) : (
                  <p>
                    Deine Anmeldung wird zurückgezogen. Bis zum Anmeldeschluss kannst du sie
                    wiederherstellen.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Abbrechen</AlertDialogCancel>
            {locked ? (
              <Button asChild disabled={contacts === null}>
                <a
                  href={forumUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setWithdrawOpen(false)}
                >
                  <ExternalLink className="h-4 w-4" />
                  PN im Forum öffnen
                </a>
              </Button>
            ) : (
              <AlertDialogAction
                className="bg-danger-600 text-white hover:bg-danger-700"
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
    </Dialog>
  );
}
