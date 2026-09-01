"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Loader2,
  AlertCircle,
  Info,
  MapPin,
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import EventBanner from "@/components/Eventbanner";
import { WeeklySignupDialog } from "./_components/WeeklySignupDialog";
import { useUser } from "@/hooks/useUser";
import { PublishedRoster } from "./_components/PublishedRoster";
import { SignupsTable } from "./_components/SignupTable";
import { SignupDialogs } from "./_components/SignupDialogs";
import { STATUS_TONE_CLASS, formatLocalDate, formatLocalTime } from "@/lib/events/eventDisplay";
import { occurrenceStatus, weeklyAirportList } from "@/lib/weeklys/publicDisplay";

interface FIR {
  code: string;
  name: string;
}

interface WeeklyConfig {
  id: number;
  firId: number | null;
  fir?: FIR;
  name: string;
  weekday: number;
  weeksOn: number;
  weeksOff: number;
  bannerUrl?: string;
  airports?: string[];
  startTime?: string;
  endTime?: string;
  description?: string;
  requiresRoster?: boolean;
  staffedStations?: string[];
  signupDeadlineHours?: number;
}

interface Occurrence {
  id: number;
  date: string;
  configId: number;
  signupDeadline: string | null;
  rosterPublishedAt: string | null;
  eventId: number | null;
  config: WeeklyConfig;
  signupStatus: "open" | "closed" | "auto";
}

interface User {
  cid: string;
  name: string;
  rating: number;
}

interface Signup {
  id: number;
  userCID: number;
  remarks: string | null;
  createdAt: string;
  user: User | null;
  endorsementGroup: string | null;
  restrictions: string[];
}

interface RosterEntry {
  id: number;
  station: string;
  userCID: number;
  assignmentType?: string;
  user?: {
    name: string;
    rating: number;
  };
  endorsementGroup?: string;
  restrictions?: string[];
}



export default function OccurrenceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const { user, canInFIR } = useUser();
  const [occurrence, setOccurrence] = useState<Occurrence | null>(null);
  const [signups, setSignups] = useState<Signup[]>([]);
  const [loading, setLoading] = useState(true);
  const [signupsLoading, setSignupsLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Edit/Delete dialog states
  const [editSignupDialog, setEditSignupDialog] = useState<{ open: boolean; signup: Signup | null }>({
    open: false,
    signup: null,
  });
  const [deleteSignupDialog, setDeleteSignupDialog] = useState<{ open: boolean; signup: Signup | null }>({
    open: false,
    signup: null,
  });
  const [editRemarks, setEditRemarks] = useState("");

  // Signup state - simplified for dialog usage
  const [isSignedUp, setIsSignedUp] = useState(false);

  // Roster state
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterPublished, setRosterPublished] = useState(false);

  useEffect(() => {
    if (params.id && params.occurrenceId) {
      fetchOccurrence();
      fetchSignups();
      fetchRoster();
    }
  }, [params.id, params.occurrenceId]);

  const fetchOccurrence = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/weeklys/${params.id}/occurrences/${params.occurrenceId}`
      );
      if (res.ok) {
        const data = await res.json();
        setOccurrence(data);
      } else {
        setError("Termin nicht gefunden");
      }
    } catch (err) {
      setError("Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  };

  const fetchSignups = async () => {
    setSignupsLoading(true);
    try {
      const res = await fetch(
        `/api/weeklys/${params.id}/occurrences/${params.occurrenceId}/signup`
      );
      if (res.ok) {
        const data = await res.json();
        setSignups(data);

        // Check if current user is signed up
        if (session?.user?.cid) {
          const userSignup = data.find(
            (s: Signup) => s.userCID === Number(session.user.cid)
          );
          setIsSignedUp(!!userSignup);
        }
      }
    } catch (err) {
      console.error("Error fetching signups:", err);
    } finally {
      setSignupsLoading(false);
    }
  };

  const fetchRoster = async () => {
    setRosterLoading(true);
    try {
      const res = await fetch(
        `/api/weeklys/${params.id}/occurrences/${params.occurrenceId}/roster`
      );
      if (res.ok) {
        const data = await res.json();
        setRoster(data.roster || []);
        setRosterPublished(true);
      } else {
        setRosterPublished(false);
      }
    } catch (err) {
      console.error("Error fetching roster:", err);
      setRosterPublished(false);
    } finally {
      setRosterLoading(false);
    }
  };

  const handleEditSignup = async () => {
    if (!editSignupDialog.signup) return;

    setBusy(true);
    try {
      const res = await fetch(
        `/api/weeklys/${params.id}/occurrences/${params.occurrenceId}/signup/${editSignupDialog.signup.userCID}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ remarks: editRemarks }),
        }
      );

      if (res.ok) {
        toast.success("Anmeldung aktualisiert");
        setEditSignupDialog({ open: false, signup: null });
        fetchSignups();
      } else {
        const data = await res.json();
        toast.error(data.error || "Fehler beim Aktualisieren");
      }
    } catch (err) {
      toast.error("Netzwerkfehler");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteSignup = async () => {
    if (!deleteSignupDialog.signup) return;

    setBusy(true);
    try {
      const res = await fetch(
        `/api/weeklys/${params.id}/occurrences/${params.occurrenceId}/signup/${deleteSignupDialog.signup.userCID}`,
        {
          method: "DELETE",
        }
      );

      if (res.ok) {
        toast.success("Anmeldung gelöscht");
        setDeleteSignupDialog({ open: false, signup: null });
        fetchSignups();
      } else {
        const data = await res.json();
        toast.error(data.error || "Fehler beim Löschen");
      }
    } catch (err) {
      toast.error("Netzwerkfehler");
    } finally {
      setBusy(false);
    }
  };

  // Check if user can manage signups
  const canManageSignups = (): boolean => {
    if (!occurrence?.config?.fir) return false;
    const firCode = occurrence.config.fir.code;
    return canInFIR(firCode, "signups.manage") || canInFIR(firCode, "event.manage");
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error || !occurrence) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || "Termin nicht gefunden"}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const occDate = new Date(occurrence.date);
  const deadline = occurrence.signupDeadline ? new Date(occurrence.signupDeadline) : null;
  const airports = weeklyAirportList(occurrence.config.airports);

  /**
   * Anmeldestatus dieses Termins – Text und Bedeutungston aus dem Modul, das
   * sich diese Seite und die Weekly-Detailseite teilen. "success" heißt
   * hier immer: Anmeldung ist gerade möglich (deckt exakt die frühere
   * isSignupOpen() && !rosterPublished-Bedingung ab, da rosterPublished
   * bereits vorrangig den highlight-Ton erzwingt).
   */
  const status = occurrenceStatus({
    requiresRoster: !!occurrence.config.requiresRoster,
    rosterPublished,
    signupStatus: occurrence.signupStatus,
    date: occDate,
    signupDeadline: deadline,
  });
  const signupOpen = status.tone === "success";

  const actionElement =
    session && occurrence.config.requiresRoster && !rosterPublished ? (
      signupOpen ? (
        <WeeklySignupDialog
          occurrence={{
            id: occurrence.id,
            date: occDate,
            signupDeadline: deadline,
          }}
          config={{
            id: occurrence.config.id,
            requiresRoster: occurrence.config.requiresRoster || false,
          }}
          user={{
            userCID: Number(session.user.cid),
            rating: session.user.rating,
          }}
          airports={occurrence.config.airports || []}
          fir={occurrence.config.fir?.code}
          userSignup={isSignedUp ? signups.find((s) => s.userCID === Number(session.user.cid)) : null}
          onSignupChange={fetchSignups}
        />
      ) : (
        // status.label nennt den tatsächlichen Grund (Anmeldeschluss überschritten,
        // öffnet erst am ..., manuell geschlossen) – vorher stand hier unabhängig
        // vom Grund immer "Anmeldeschluss abgelaufen", auch wenn die Anmeldung
        // schlicht noch nicht begonnen hatte.
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{status.label}.</AlertDescription>
        </Alert>
      )
    ) : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <Button variant="ghost" size="sm" onClick={() => router.push(`/weeklys/${params.id}`)} className="-ml-2 gap-1.5">
        <ArrowLeft className="h-4 w-4" />
        Zurück zu den Terminen
      </Button>

      {/* Kopfbereich im Zuschnitt der übrigen Detailseiten */}
      <div className="relative h-64 overflow-hidden rounded-2xl border bg-primary-900 md:h-80">
        <EventBanner
          bannerUrl={occurrence.config.bannerUrl ?? ""}
          eventName={occurrence.config.name}
          className="absolute inset-0 h-full w-full object-cover object-center"
          showFallbackCaption={false}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-primary-900 via-primary-900/60 to-transparent" />

        <div className="absolute left-5 top-4 flex flex-wrap items-center gap-1.5 sm:left-7">
          <Badge className={cn("font-medium", STATUS_TONE_CLASS[status.tone])}>{status.label}</Badge>
          {occurrence.config.fir?.code && (
            <Badge className="bg-secondary-50/15 font-semibold text-secondary-50 backdrop-blur-sm">
              {occurrence.config.fir.code}
            </Badge>
          )}
        </div>

        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 px-5 pb-5 pt-8 sm:px-7">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-accent-500">
            {format(occDate, "EEEE, dd. MMMM yyyy", { locale: de })}
            {(occurrence.config.startTime || occurrence.config.endTime) &&
              ` · ${occurrence.config.startTime || "?"} – ${occurrence.config.endTime || "?"} lcl`}
          </span>
          <h1 className="text-pretty text-2xl font-bold leading-tight text-secondary-50 sm:text-3xl">
            {occurrence.config.name}
          </h1>
          {airports.length > 0 && (
            <span className="flex min-w-0 items-center gap-1.5 text-sm text-secondary-300">
              <MapPin className="h-4 w-4 shrink-0" />
              <span className="truncate" title={airports.join(", ")}>
                {airports.length > 3 ? `${airports.length} Flughäfen` : airports.join(", ")}
              </span>
            </span>
          )}
        </div>
      </div>

      {/* Fakten und Handlung */}
      <Card>
        <CardContent className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
          <dl className="grid flex-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <div className="flex items-start gap-2.5">
              <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <dt className="text-xs font-medium text-muted-foreground">Termin</dt>
                <dd className="text-sm font-semibold text-foreground">
                  {format(occDate, "EEEE, dd.MM.yyyy", { locale: de })}
                </dd>
              </div>
            </div>

            {(occurrence.config.startTime || occurrence.config.endTime) && (
              <div className="flex items-start gap-2.5">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <dt className="text-xs font-medium text-muted-foreground">Zeit</dt>
                  <dd className="text-sm font-semibold tabular-nums text-foreground">
                    {occurrence.config.startTime || "?"} – {occurrence.config.endTime || "?"} lcl
                  </dd>
                </div>
              </div>
            )}

            {occurrence.config.requiresRoster && deadline && (
              <div className="flex items-start gap-2.5">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-accent-600 dark:text-accent-500" />
                <div className="min-w-0">
                  <dt className="text-xs font-medium text-muted-foreground">Anmeldeschluss</dt>
                  <dd className="text-sm font-semibold text-accent-600 dark:text-accent-500">
                    {formatLocalDate(deadline)} · {formatLocalTime(deadline)} lcl
                  </dd>
                </div>
              </div>
            )}
          </dl>

          {actionElement && <div className="w-full shrink-0 lg:w-72">{actionElement}</div>}
        </CardContent>
      </Card>

      {/* Flughäfen vollständig, wenn mehr als einer */}
      {airports.length > 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              Flughäfen
              <Badge variant="secondary" className="ml-1 font-semibold">
                {airports.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {airports.map((icao) => (
                <span
                  key={icao}
                  className="inline-flex items-center rounded-md border bg-muted/50 px-2.5 py-1 font-mono text-[13px] font-semibold tracking-wide text-foreground"
                >
                  {icao}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {occurrence.config.description && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Beschreibung</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">{occurrence.config.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Vorschau der geplanten Stationen, solange noch kein Roster veröffentlicht ist –
          danach zeigt PublishedRoster dieselben Stationen bereits mit ihrer Zuweisung. */}
      {occurrence.config.requiresRoster &&
        !rosterPublished &&
        occurrence.config.staffedStations &&
        occurrence.config.staffedStations.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Geplante Stationen</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {occurrence.config.staffedStations.map((station) => (
                  <Badge key={station} variant="outline" className="py-1 font-mono">
                    {station}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

      {/* Hinweis für Events ohne Roster */}
      {session && !occurrence.config.requiresRoster && (
        <Alert className="border-primary-200 bg-primary-50 dark:border-primary-800 dark:bg-primary-900/20">
          <Info className="h-4 w-4 text-primary-700 dark:text-primary-300" />
          <AlertDescription className="text-primary-800 dark:text-primary-200">
            Für dieses Weekly Event ist kein Roster vorgesehen. Bitte buche eine Station direkt über das{" "}
            <a
              href="https://vatsim-germany.org/controllers/booking"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline underline-offset-2"
            >
              VATGER Booking System.
            </a>
          </AlertDescription>
        </Alert>
      )}

      {!session && occurrence.config.requiresRoster && (
        <Alert className="border-warning-300 bg-warning-50 dark:border-warning-800 dark:bg-warning-900/20">
          <AlertCircle className="h-4 w-4 text-warning-800 dark:text-warning-400" />
          <AlertDescription className="text-warning-900 dark:text-warning-200">
            Bitte melde dich an, um dich für diesen Termin anzumelden.
          </AlertDescription>
        </Alert>
      )}

      {rosterPublished && occurrence.config.staffedStations && (
        <PublishedRoster staffedStations={occurrence.config.staffedStations} roster={roster} />
      )}

      {occurrence.config.requiresRoster && (
        <SignupsTable
          signups={signups}
          loading={signupsLoading}
          canManage={canManageSignups()}
          configId={occurrence.config.id}
          occurrenceId={occurrence.id}
          currentUserCID={session?.user?.cid ? Number(session.user.cid) : undefined}
          onSignupAdded={fetchSignups}
          onEdit={(signup) => {
            setEditRemarks(signup.remarks || "");
            setEditSignupDialog({ open: true, signup });
          }}
          onDelete={(signup) => setDeleteSignupDialog({ open: true, signup })}
        />
      )}

      <SignupDialogs
        editState={editSignupDialog}
        deleteState={deleteSignupDialog}
        editRemarks={editRemarks}
        busy={busy}
        onEditRemarksChange={setEditRemarks}
        onEditClose={() => setEditSignupDialog({ open: false, signup: null })}
        onDeleteClose={() => setDeleteSignupDialog({ open: false, signup: null })}
        onEditConfirm={handleEditSignup}
        onDeleteConfirm={handleDeleteSignup}
      />
    </div>
  );
}