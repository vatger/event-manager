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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Info,
  Check,
  X,
  Award,
  BookOpen,
  GripVertical,
  Pencil,
  Trash2,
  MoreVertical,
} from "lucide-react";
import { format, isBefore } from "date-fns";
import { de } from "date-fns/locale";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { getBadgeClassForEndorsement } from "@/utils/EndorsementBadge";
import { isTrainee } from "@/lib/weeklys/traineeUtils";
import { cn } from "@/lib/utils";
import EventBanner from "@/components/Eventbanner";
import { WeeklySignupDialog } from "./_components/WeeklySignupDialog";
import { AddSignupByCIDDialog } from "./_components/AddSignupByCIDDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useUser } from "@/hooks/useUser";

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
  user?: {
    name: string;
    rating: number;
  };
  endorsementGroup?: string;
  restrictions?: string[];
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

  const isSignupOpen = (): boolean => {
    if (!occurrence) return false;
    
    // Manual override - closed
    if (occurrence.signupStatus === "closed") return false;
    
    // Manual override - open
    if (occurrence.signupStatus === "open") {
      // Still need to check deadline
      if (occurrence.signupDeadline) {
        return isBefore(new Date(), new Date(occurrence.signupDeadline));
      }
      return true;
    }
    
    // Auto mode - check if within 2 weeks and before deadline
    if (occurrence.signupStatus === "auto") {
      const now = new Date();
      const occDate = new Date(occurrence.date);
      const twoWeeksBefore = new Date(occDate);
      twoWeeksBefore.setDate(twoWeeksBefore.getDate() - 14);
      
      // Not yet 2 weeks before
      if (now < twoWeeksBefore) {
        return false;
      }
      
      // Check deadline
      if (occurrence.signupDeadline) {
        return isBefore(now, new Date(occurrence.signupDeadline));
      }
      
      return true;
    }
    
    return false;
  };

  const getSignupStatusMessage = (): { text: string; color: string } => {
    if (!occurrence || !occurrence.config.requiresRoster) {
      return { text: "Kein Roster vorgesehen", color: "text-gray-500" };
    }
    
    if (rosterPublished) {
      return { text: "Roster veröffentlicht", color: "text-green-600" };
    }
    
    if (occurrence.signupStatus === "closed") {
      return { text: "Anmeldung geschlossen", color: "text-red-600" };
    }
    
    if (occurrence.signupStatus === "open") {
      if (occurrence.signupDeadline && !isBefore(new Date(), new Date(occurrence.signupDeadline))) {
        return { text: "Anmeldeschluss überschritten", color: "text-red-600" };
      }
      return { text: "Anmeldung offen", color: "text-green-600" };
    }
    
    // Auto mode
    if (occurrence.signupStatus === "auto") {
      const now = new Date();
      const occDate = new Date(occurrence.date);
      const twoWeeksBefore = new Date(occDate);
      twoWeeksBefore.setDate(twoWeeksBefore.getDate() - 14);
      
      if (now < twoWeeksBefore) {
        const opensAtStr = twoWeeksBefore.toLocaleDateString("de-DE", { 
          day: "2-digit", 
          month: "2-digit", 
          year: "numeric" 
        });
        return { 
          text: `Anmeldung öffnet am ${opensAtStr}`, 
          color: "text-amber-600" 
        };
      }
      
      if (occurrence.signupDeadline && !isBefore(now, new Date(occurrence.signupDeadline))) {
        return { text: "Anmeldeschluss überschritten", color: "text-red-600" };
      }
      
      return { text: "Anmeldung offen", color: "text-green-600" };
    }
    
    return { text: "Status unbekannt", color: "text-gray-500" };
  };

  const getStatusDotColor = (statusMessage: { text: string; color: string }): string => {
    if (statusMessage.color.includes("green")) return "bg-green-500";
    if (statusMessage.color.includes("amber")) return "bg-amber-500";
    if (statusMessage.color.includes("blue")) return "bg-blue-500";
    if (statusMessage.color.includes("red")) return "bg-red-500";
    return "bg-gray-400";
  };

  const getStatusBadgeColor = (statusMessage: { text: string; color: string }): string => {
    if (statusMessage.color.includes("green")) return "bg-green-600";
    if (statusMessage.color.includes("amber")) return "bg-amber-600";
    if (statusMessage.color.includes("blue")) return "bg-blue-600";
    if (statusMessage.color.includes("red")) return "bg-red-600";
    return "";
  };

  const getRatingBadge = (rating: number) => {
    return RATINGS[rating] || `R${rating}`;
  };

  const getAssignedUserForStation = (station: string): RosterEntry | null => {
    return roster.find(r => r.station === station) || null;
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !occurrence) {
    return (
      <div className="min-h-screen">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <Alert variant="destructive" className="border-red-200 dark:border-red-800">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error || "Termin nicht gefunden"}</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const occDate = new Date(occurrence.date);
  const deadline = occurrence.signupDeadline
    ? new Date(occurrence.signupDeadline)
    : null;
  const signupOpen = isSignupOpen() && !rosterPublished;

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Header mit Back-Button */}
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push(`/weeklys/${params.id}`)}
            className="h-8 w-8 border-gray-300 dark:border-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {occurrence.config.name}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                <Calendar className="h-3.5 w-3.5" />
                <span>{format(occDate, "EEEE, dd. MMMM yyyy", { locale: de })}</span>
              </div>
              {(occurrence.config.startTime || occurrence.config.endTime) && (
                <>
                  <span className="text-gray-300 dark:text-gray-700">•</span>
                  <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{occurrence.config.startTime || "?"} - {occurrence.config.endTime || "?"} Uhr (Lokalzeit)</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Main Grid - Banner + Info Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Info Card */}
          <Card className="md:col-span-1 border-gray-200 dark:border-gray-800">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  getStatusDotColor(getSignupStatusMessage())
                )} />
                <CardTitle className="text-lg">Event Informationen</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Status */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">Status</span>
                <Badge 
                  variant={signupOpen ? "default" : "secondary"}
                  className={cn(
                    getStatusBadgeColor(getSignupStatusMessage())
                  )}
                >
                  {getSignupStatusMessage().text}
                </Badge>
              </div>

              {/* Deadline */}
              {deadline && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Anmeldeschluss</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {format(deadline, "dd.MM.yyyy HH:mm", { locale: de })}
                  </span>
                </div>
              )}

              {/* Airports */}
              {occurrence.config.airports && occurrence.config.airports.length > 0 && (
                <div className="space-y-1">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Flughäfen</span>
                  <div className="flex flex-wrap gap-1">
                    {occurrence.config.airports.map((apt) => (
                      <Badge key={apt} variant="outline" className="text-xs font-mono">
                        {apt}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Beschreibung */}
              {occurrence.config.description && (
                <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {occurrence.config.description}
                  </p>
                </div>
              )}

              {session && occurrence.config.requiresRoster && !rosterPublished && (
                signupOpen ? (
                  <div className="flex gap-2">
                    <WeeklySignupDialog
                      occurrence={{
                        id: occurrence.id,
                        date: new Date(occurrence.date),
                        signupDeadline: occurrence.signupDeadline ? new Date(occurrence.signupDeadline) : null,
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
                      userSignup={isSignedUp ? signups.find(s => s.userCID === Number(session.user.cid)) : null}
                      onSignupChange={fetchSignups}
                    />
                  </div>
                ) : (
                  <Alert className="border-gray-200 dark:border-gray-800">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Der Anmeldeschluss für diesen Termin ist abgelaufen.
                    </AlertDescription>
                  </Alert>
                )
            )}
            </CardContent>
          </Card>
          {/* Banner */}
          <div className="md:col-span-2 min-h-0">
            <div className="relative h-56 md:h-full rounded-xl overflow-hidden">
              <EventBanner
                bannerUrl={occurrence.config.bannerUrl || ""}
                eventName={occurrence.config.name}
                className="absolute inset-0 w-full h-full object-cover object-center"
              />
            </div>
          </div>
        </div>

        {/* Info for non-rostered events */}
        {session && !occurrence.config.requiresRoster && (
          <Alert className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-blue-700 dark:text-blue-300">
              Für dieses Weekly Event ist kein Roster vorgesehen. Bitte buche eine Station direkt über das{" "}
              <a
                href="https://vatsim-germany.org/gdp/roster"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline underline-offset-2"
              >
                VATGER Booking System
              </a>
              .
            </AlertDescription>
          </Alert>
        )}

        {!session && occurrence.config.requiresRoster && (
          <Alert className="border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20">
            <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            <AlertDescription className="text-yellow-700 dark:text-yellow-300">
              Bitte melde dich an, um dich für diesen Termin anzumelden.
            </AlertDescription>
          </Alert>
        )}

        {/* Published Roster - Wie im Editor */}
        {rosterPublished && occurrence.config.staffedStations && (
          <Card className="border-gray-200 dark:border-gray-800">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-green-600"></div>
                <CardTitle className="text-lg">Besetzungsplan</CardTitle>
              </div>
              <CardDescription>
                Offizielle Zuweisung für dieses Event
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {/* Header Row */}
                <div className="grid grid-cols-[200px_1fr] gap-4 mb-2 px-3">
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Station
                  </div>
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Zugewiesener Lotse
                  </div>
                </div>

                {/* Station Rows */}
                {occurrence.config.staffedStations.map((station) => {
                  const assigned = getAssignedUserForStation(station);
                  const stationGroup = station.split("_").pop() || "";

                  return (
                    <div
                      key={station}
                      className={cn(
                        "grid grid-cols-[200px_1fr] gap-4 items-center p-3 rounded-lg border transition-colors",
                        "border-gray-200 dark:border-gray-800",
                        assigned ? "bg-green-50 dark:bg-green-900/10" : "bg-gray-50 dark:bg-gray-900/40"
                      )}
                    >
                      {/* Station Info */}
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 dark:text-gray-100">
                              {station}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Assigned User Slot */}
                      <div>
                        {assigned ? (
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                              <span className="font-semibold text-blue-600 dark:text-blue-400">
                                {assigned.user?.name?.split(' ').map(n => n[0]).join('') || '??'}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-gray-100">
                                {assigned.user?.name || `CID ${assigned.userCID}`}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {assigned.user?.rating && (
                                  <Badge variant="outline" className="text-[10px] h-4">
                                    {getRatingBadge(assigned.user.rating)}
                                  </Badge>
                                )}
                                {assigned.endorsementGroup && (
                                  <Badge className={cn(
                                    "text-[10px] h-4",
                                    getBadgeClassForEndorsement(assigned.endorsementGroup)
                                  )}>
                                    {assigned.endorsementGroup}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center h-full py-2">
                            <p className="text-sm text-gray-400 dark:text-gray-600">
                              Nicht besetzt
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Signups List - Als Tabelle */}
        {occurrence.config.requiresRoster && (
          <Card className="border-gray-200 dark:border-gray-800">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-gray-600"></div>
                  <CardTitle className="text-lg">Angemeldete Lotsen</CardTitle>
                  <Badge variant="outline" className="ml-2">
                    {signups.length}
                  </Badge>
                </div>
                {canManageSignups() && (
                  <AddSignupByCIDDialog
                    configId={occurrence.config.id}
                    occurrenceId={occurrence.id}
                    onSignupAdded={fetchSignups}
                  />
                )}
              </div>
              <CardDescription>
                {signups.length === 1 ? "Ein Lotse hat sich angemeldet" : `${signups.length} Lotsen haben sich angemeldet`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {signupsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : signups.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-gray-300 dark:text-gray-700 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">Noch keine Anmeldungen</p>
                </div>
              ) : (
                <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50 dark:bg-gray-900/40">
                        <TableHead>Lotse</TableHead>
                        <TableHead className="w-[100px]">Rating</TableHead>
                        <TableHead className="w-[120px]">Endorsement</TableHead>
                        <TableHead className="w-[200px]">Einschränkungen</TableHead>
                        <TableHead className="w-[120px]">Angemeldet seit</TableHead>
                        <TableHead className="w-[150px]">Bemerkungen</TableHead>
                        {canManageSignups() && <TableHead className="w-[50px]"></TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {signups
                        .sort((a, b) => {
                          if (a.user?.rating !== b.user?.rating) {
                            return (b.user?.rating || 0) - (a.user?.rating || 0);
                          }
                          return (a.user?.name || "").localeCompare(b.user?.name || "");
                        })
                        .map((signup) => {
                          const isCurrentUser = signup.userCID === Number(session?.user?.cid);
                          const restrictions = signup.restrictions || [];

                          return (
                            <TableRow key={signup.id} className={isCurrentUser ? "bg-blue-50 dark:bg-blue-900/10" : ""}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className={cn(
                                    "h-6 w-6 rounded-full flex items-center justify-center",
                                    isCurrentUser 
                                      ? "bg-blue-200 dark:bg-blue-800" 
                                      : "bg-gray-100 dark:bg-gray-800"
                                  )}>
                                    <span className="text-xs font-semibold">
                                      {signup.user?.name?.split(' ').map(n => n[0]).join('') || '??'}
                                    </span>
                                  </div>
                                  <span className="font-medium">
                                    {signup.user?.name || `CID ${signup.userCID}`}
                                  </span>
                                  {isCurrentUser && (
                                    <Badge variant="default" className="bg-blue-600 text-[8px] h-3 px-1">
                                      Du
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                {signup.user?.rating && (
                                  <Badge variant="outline" className="text-[10px] h-4">
                                    {getRatingBadge(signup.user.rating)}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {signup.endorsementGroup ? (
                                    <Badge className={cn(
                                      "text-[10px] h-4",
                                      getBadgeClassForEndorsement(signup.endorsementGroup)
                                    )}>
                                      {signup.endorsementGroup}
                                    </Badge>
                                  ) : (
                                    <span className="text-gray-400 dark:text-gray-600 text-xs">-</span>
                                  )}
                                  {isTrainee(signup.restrictions) && (
                                    <Badge className="text-[10px] h-4 bg-yellow-500 hover:bg-yellow-600 text-black">
                                      Trainee
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                {restrictions.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {restrictions.map((r, i) => (
                                      <Badge key={i} variant="secondary" className="text-[8px] h-3 px-1">
                                        {r}
                                      </Badge>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-gray-400 dark:text-gray-600 text-xs">Keine</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <span className="text-xs text-gray-600 dark:text-gray-400">
                                  {format(new Date(signup.createdAt), "dd.MM.yyyy", { locale: de })}
                                </span>
                              </TableCell>
                              <TableCell>
                                {signup.remarks ? (
                                  <span className="text-xs text-gray-600 dark:text-gray-400 italic line-clamp-1">
                                    {signup.remarks}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 dark:text-gray-600 text-xs">-</span>
                                )}
                              </TableCell>
                              {canManageSignups() && (
                                <TableCell>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                        <MoreVertical className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem
                                        onClick={() => {
                                          setEditRemarks(signup.remarks || "");
                                          setEditSignupDialog({ open: true, signup });
                                        }}
                                      >
                                        <Pencil className="mr-2 h-4 w-4" />
                                        Bearbeiten
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => setDeleteSignupDialog({ open: true, signup })}
                                        className="text-red-600"
                                      >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Löschen
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit Signup Dialog */}
      <Dialog open={editSignupDialog.open} onOpenChange={(open) => setEditSignupDialog({ open, signup: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anmeldung bearbeiten</DialogTitle>
            <DialogDescription>
              Bearbeite die Anmeldung von {editSignupDialog.signup?.user?.name || `CID ${editSignupDialog.signup?.userCID}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="remarks">Bemerkungen</Label>
              <Textarea
                id="remarks"
                value={editRemarks}
                onChange={(e) => setEditRemarks(e.target.value)}
                placeholder="Optional: Bemerkungen zur Anmeldung"
                rows={3}
                maxLength={500}
              />
              <p className="text-xs text-gray-500 mt-1">{editRemarks.length}/500 Zeichen</p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditSignupDialog({ open: false, signup: null })}
              disabled={busy}
            >
              Abbrechen
            </Button>
            <Button onClick={handleEditSignup} disabled={busy}>
              {busy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Speichert...
                </>
              ) : (
                "Speichern"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Signup Dialog */}
      <Dialog open={deleteSignupDialog.open} onOpenChange={(open) => setDeleteSignupDialog({ open, signup: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anmeldung löschen</DialogTitle>
            <DialogDescription>
              Möchtest du die Anmeldung von {deleteSignupDialog.signup?.user?.name || `CID ${deleteSignupDialog.signup?.userCID}`} wirklich löschen?
            </DialogDescription>
          </DialogHeader>
          <Alert className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <AlertDescription className="text-red-700 dark:text-red-300">
              Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDescription>
          </Alert>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteSignupDialog({ open: false, signup: null })}
              disabled={busy}
            >
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={handleDeleteSignup} disabled={busy}>
              {busy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Löscht...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Löschen
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}