"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Loader2,
  AlertCircle,
  UserPlus,
  UserMinus,
  Users,
} from "lucide-react";
import { format, isBefore } from "date-fns";
import { de } from "date-fns/locale";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

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
}

interface User {
  cid: string;
  name: string;
  rating: number;
}

interface Signup {
  id: number;
  userCID: string;
  remarks: string | null;
  createdAt: string;
  user: User | null;
}

const WEEKDAYS = [
  "Sonntag",
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
];

const RATINGS: Record<number, string> = {
  1: "OBS",
  2: "S1",
  3: "S2",
  4: "S3",
  5: "C1",
  7: "C3",
  8: "I1",
  9: "I2",
  10: "I3",
  11: "SUP",
  12: "ADM",
};

export default function OccurrenceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const [occurrence, setOccurrence] = useState<Occurrence | null>(null);
  const [signups, setSignups] = useState<Signup[]>([]);
  const [loading, setLoading] = useState(true);
  const [signupsLoading, setSignupsLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Signup form state
  const [remarks, setRemarks] = useState("");
  const [isSignedUp, setIsSignedUp] = useState(false);

  useEffect(() => {
    if (params.id && params.occurrenceId) {
      fetchOccurrence();
      fetchSignups();
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
        if (session?.user?.id) {
          const userSignup = data.find(
            (s: Signup) => s.userCID === session.user.id
          );
          setIsSignedUp(!!userSignup);
          if (userSignup) {
            setRemarks(userSignup.remarks || "");
          }
        }
      }
    } catch (err) {
      console.error("Error fetching signups:", err);
    } finally {
      setSignupsLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!session) {
      toast.error("Bitte melde dich an, um dich anzumelden");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(
        `/api/weeklys/${params.id}/occurrences/${params.occurrenceId}/signup`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ remarks: remarks || null }),
        }
      );

      if (res.ok) {
        toast.success("Erfolgreich angemeldet!");
        setIsSignedUp(true);
        fetchSignups();
      } else {
        const data = await res.json();
        toast.error(data.error || "Fehler bei der Anmeldung");
      }
    } catch (err) {
      toast.error("Netzwerkfehler");
    } finally {
      setBusy(false);
    }
  };

  const handleCancelSignup = async () => {
    if (!confirm("Möchtest du deine Anmeldung wirklich stornieren?")) return;

    setBusy(true);
    try {
      const res = await fetch(
        `/api/weeklys/${params.id}/occurrences/${params.occurrenceId}/signup`,
        {
          method: "DELETE",
        }
      );

      if (res.ok) {
        toast.success("Anmeldung storniert");
        setIsSignedUp(false);
        setRemarks("");
        fetchSignups();
      } else {
        const data = await res.json();
        toast.error(data.error || "Fehler beim Stornieren");
      }
    } catch (err) {
      toast.error("Netzwerkfehler");
    } finally {
      setBusy(false);
    }
  };

  const isSignupOpen = (): boolean => {
    if (!occurrence?.signupDeadline) return true;
    return isBefore(new Date(), new Date(occurrence.signupDeadline));
  };

  if (loading) {
    return (
      <div className="container mx-auto max-w-5xl p-6">
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error || !occurrence) {
    return (
      <div className="container mx-auto max-w-5xl p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || "Termin nicht gefunden"}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const occDate = new Date(occurrence.date);
  const deadline = occurrence.signupDeadline
    ? new Date(occurrence.signupDeadline)
    : null;
  const signupOpen = isSignupOpen();

  return (
    <div className="container mx-auto max-w-5xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/weeklys/${params.id}`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{occurrence.config.name}</h1>
          <p className="text-muted-foreground">
            {format(occDate, "EEEE, dd. MMMM yyyy", { locale: de })}
          </p>
        </div>
      </div>

      {/* Event Details */}
      <Card>
        <CardHeader>
          <CardTitle>Event Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Datum</p>
                <p className="text-sm text-muted-foreground">
                  {format(occDate, "dd.MM.yyyy", { locale: de })} ({WEEKDAYS[occDate.getDay()]})
                </p>
              </div>
            </div>

            {(occurrence.config.startTime || occurrence.config.endTime) && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Uhrzeit (UTC)</p>
                  <p className="text-sm text-muted-foreground">
                    {occurrence.config.startTime || "?"} - {occurrence.config.endTime || "?"}
                  </p>
                </div>
              </div>
            )}

            {occurrence.config.airports && occurrence.config.airports.length > 0 && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Flughäfen</p>
                  <p className="text-sm text-muted-foreground font-mono">
                    {occurrence.config.airports.join(", ")}
                  </p>
                </div>
              </div>
            )}

            {deadline && (
              <div>
                <p className="text-sm font-medium">Anmeldeschluss</p>
                <p className="text-sm text-muted-foreground">
                  {format(deadline, "dd.MM.yyyy HH:mm", { locale: de })}
                </p>
              </div>
            )}
          </div>

          {occurrence.config.description && (
            <div>
              <h3 className="font-semibold mb-2">Beschreibung</h3>
              <p className="text-muted-foreground">{occurrence.config.description}</p>
            </div>
          )}

          {occurrence.config.requiresRoster &&
            occurrence.config.staffedStations &&
            occurrence.config.staffedStations.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Zu besetzende Stationen</h3>
                <div className="flex flex-wrap gap-2">
                  {occurrence.config.staffedStations.map((station) => (
                    <Badge key={station} variant="outline">
                      {station}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
        </CardContent>
      </Card>

      {/* Signup Form */}
      {session && (
        <Card>
          <CardHeader>
            <CardTitle>
              {isSignedUp ? "Deine Anmeldung" : "Anmelden"}
            </CardTitle>
            <CardDescription>
              {signupOpen
                ? isSignedUp
                  ? "Du bist für diesen Termin angemeldet"
                  : "Melde dich für diesen Termin an"
                : "Anmeldeschluss ist abgelaufen"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {signupOpen ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="remarks">Bemerkungen (optional)</Label>
                  <Textarea
                    id="remarks"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Optionale Bemerkungen..."
                    rows={3}
                    disabled={isSignedUp || busy}
                  />
                </div>

                {isSignedUp ? (
                  <Button
                    onClick={handleCancelSignup}
                    variant="destructive"
                    disabled={busy}
                  >
                    <UserMinus className="mr-2 h-4 w-4" />
                    {busy ? "Wird storniert..." : "Anmeldung stornieren"}
                  </Button>
                ) : (
                  <Button onClick={handleSignup} disabled={busy}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    {busy ? "Wird angemeldet..." : "Jetzt anmelden"}
                  </Button>
                )}
              </>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Der Anmeldeschluss für diesen Termin ist abgelaufen.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {!session && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Bitte melde dich an, um dich für diesen Termin anzumelden.
          </AlertDescription>
        </Alert>
      )}

      {/* Signups List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Anmeldungen ({signups.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {signupsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : signups.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Noch keine Anmeldungen
            </p>
          ) : (
            <div className="space-y-3">
              {signups.map((signup) => (
                <div
                  key={signup.id}
                  className="flex items-start justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold">
                        {signup.user?.name || `CID ${signup.userCID}`}
                      </p>
                      {signup.user?.rating && (
                        <Badge variant="outline" className="text-xs">
                          {RATINGS[signup.user.rating] || `S${signup.user.rating}`}
                        </Badge>
                      )}
                    </div>
                    {signup.remarks && (
                      <p className="text-sm text-muted-foreground mt-2">
                        {signup.remarks}
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(signup.createdAt), "dd.MM.yyyy", { locale: de })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
