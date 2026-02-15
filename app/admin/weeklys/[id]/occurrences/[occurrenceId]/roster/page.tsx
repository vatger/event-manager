"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { ArrowLeft, Users, Check, X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { extractStationGroup, getBadgeClassForGroup } from "@/lib/weeklys/stationUtils";

interface User {
  firstName: string;
  lastName: string;
  rating: number;
}

interface Signup {
  id: number;
  userCID: number;
  remarks: string | null;
  user: User;
  endorsementGroup: string | null;
  restrictions: string[];
}

interface RosterEntry {
  id: number;
  station: string;
  userCID: number;
}

interface WeeklyConfig {
  id: number;
  name: string;
  requiresRoster: boolean;
  staffedStations: string[];
}

interface Occurrence {
  id: number;
  date: string;
  rosterPublished: boolean;
}

interface RosterData {
  occurrence: Occurrence;
  config: WeeklyConfig;
  signups: Signup[];
  roster: RosterEntry[];
}

export default function RosterEditorPage() {
  const router = useRouter();
  const params = useParams();
  const { data: session } = useSession();
  const configId = parseInt(params.id as string);
  const occurrenceId = parseInt(params.occurrenceId as string);

  const [data, setData] = useState<RosterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishDialog, setPublishDialog] = useState(false);

  // Fetch roster data
  useEffect(() => {
    if (!session) return;
    fetchData();
  }, [session, configId, occurrenceId]);

  const fetchData = async () => {
    try {
      const res = await fetch(
        `/api/admin/weeklys/${configId}/occurrences/${occurrenceId}/roster`
      );
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setData(json);
    } catch (error) {
      console.error("Fetch error:", error);
      toast.error("Fehler beim Laden der Daten");
    } finally {
      setLoading(false);
    }
  };

  const assignUser = async (station: string, userCID: number) => {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/admin/weeklys/${configId}/occurrences/${occurrenceId}/roster`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ station, userCID }),
        }
      );

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to assign");
      }

      toast.success("Benutzer zugewiesen");
      await fetchData(); // Refresh
    } catch (error: any) {
      console.error("Assign error:", error);
      toast.error(error.message || "Fehler beim Zuweisen");
    } finally {
      setSaving(false);
    }
  };

  const unassignUser = async (rosterId: number) => {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/admin/weeklys/${configId}/occurrences/${occurrenceId}/roster/${rosterId}`,
        {
          method: "DELETE",
        }
      );

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to unassign");
      }

      toast.success("Zuweisung entfernt");
      await fetchData(); // Refresh
    } catch (error: any) {
      console.error("Unassign error:", error);
      toast.error(error.message || "Fehler beim Entfernen");
    } finally {
      setSaving(false);
    }
  };

  const publishRoster = async (publish: boolean) => {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/admin/weeklys/${configId}/occurrences/${occurrenceId}/roster/publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ published: publish }),
        }
      );

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to publish");
      }

      toast.success(publish ? "Roster veröffentlicht" : "Veröffentlichung zurückgezogen");
      await fetchData();
      setPublishDialog(false);
    } catch (error: any) {
      console.error("Publish error:", error);
      toast.error(error.message || "Fehler beim Veröffentlichen");
    } finally {
      setSaving(false);
    }
  };

  const getRatingBadge = (rating: number) => {
    const ratings = ["OBS", "S1", "S2", "S3", "C1", "C3", "I1", "I3", "SUP", "ADM"];
    return ratings[rating] || `R${rating}`;
  };

  const getAssignedUser = (station: string): Signup | null => {
    if (!data) return null;
    const rosterEntry = data.roster.find(r => r.station === station);
    if (!rosterEntry) return null;
    return data.signups.find(s => s.userCID === rosterEntry.userCID) || null;
  };

  const isUserAssigned = (userCID: number): boolean => {
    return data?.roster.some(r => r.userCID === userCID) || false;
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Laden...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center text-red-500">Fehler beim Laden</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/admin/weeklys/${configId}/occurrences`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Roster Editor</h1>
            <p className="text-muted-foreground">
              {data.config.name} -{" "}
              {format(new Date(data.occurrence.date), "PPP", { locale: de })}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {data.occurrence.rosterPublished ? (
            <Badge variant="default" className="bg-green-600">
              <Check className="h-3 w-3 mr-1" />
              Veröffentlicht
            </Badge>
          ) : (
            <Badge variant="secondary">
              <X className="h-3 w-3 mr-1" />
              Nicht veröffentlicht
            </Badge>
          )}
          <Button
            onClick={() => setPublishDialog(true)}
            disabled={saving}
          >
            <Save className="h-4 w-4 mr-2" />
            {data.occurrence.rosterPublished ? "Zurückziehen" : "Veröffentlichen"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stations */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Stationen</CardTitle>
              <CardDescription>
                Weise Benutzer den zu besetzenden Stationen zu
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.config.staffedStations.map((station) => {
                const assigned = getAssignedUser(station);
                const rosterEntry = data.roster.find(r => r.station === station);
                const stationGroup = extractStationGroup(station);

                return (
                  <Card key={station} className="border-2">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <CardTitle className="text-lg">{station}</CardTitle>
                          <Badge className={getBadgeClassForGroup(stationGroup)}>
                            {stationGroup}
                          </Badge>
                        </div>
                        {assigned && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => rosterEntry && unassignUser(rosterEntry.id)}
                            disabled={saving}
                          >
                            Entfernen
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      {assigned ? (
                        <div className="flex items-center space-x-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {assigned.user.firstName} {assigned.user.lastName}
                          </span>
                          <Badge variant="outline">
                            {getRatingBadge(assigned.user.rating)}
                          </Badge>
                          {assigned.endorsementGroup && (
                            <Badge className={getBadgeClassForGroup(assigned.endorsementGroup)}>
                              {assigned.endorsementGroup}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <Select
                          onValueChange={(value) => assignUser(station, parseInt(value))}
                          disabled={saving}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Nicht zugewiesen" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none" disabled>
                              Benutzer auswählen
                            </SelectItem>
                            {data.signups.map((signup) => {
                              const canStaff = signup.endorsementGroup 
                                ? ["DEL", "GND", "TWR", "APP", "CTR"].indexOf(signup.endorsementGroup) >= 
                                  ["DEL", "GND", "TWR", "APP", "CTR"].indexOf(stationGroup)
                                : false;
                              
                              return (
                                <SelectItem
                                  key={signup.userCID}
                                  value={signup.userCID.toString()}
                                  disabled={!canStaff}
                                >
                                  {signup.user.firstName} {signup.user.lastName} (
                                  {signup.endorsementGroup || "?"}) - {getRatingBadge(signup.user.rating)}
                                  {!canStaff && " - Nicht qualifiziert"}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Signups */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Anmeldungen ({data.signups.length})</CardTitle>
              <CardDescription>Verfügbare Benutzer</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.signups.length === 0 ? (
                <p className="text-sm text-muted-foreground">Keine Anmeldungen</p>
              ) : (
                data.signups.map((signup) => {
                  const assigned = isUserAssigned(signup.userCID);
                  return (
                    <Card
                      key={signup.userCID}
                      className={`border-2 ${
                        assigned ? "border-blue-500 bg-blue-50" : "border-green-500 bg-green-50"
                      }`}
                    >
                      <CardContent className="p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">
                            {signup.user.firstName} {signup.user.lastName}
                          </div>
                          <div className="flex items-center space-x-1">
                            <Badge variant="outline">
                              {getRatingBadge(signup.user.rating)}
                            </Badge>
                            {signup.endorsementGroup && (
                              <Badge className={getBadgeClassForGroup(signup.endorsementGroup)}>
                                {signup.endorsementGroup}
                              </Badge>
                            )}
                          </div>
                        </div>
                        {signup.restrictions && signup.restrictions.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {signup.restrictions.map((r, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {r}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {signup.remarks && (
                          <p className="text-xs text-muted-foreground italic">
                            {signup.remarks}
                          </p>
                        )}
                        {assigned && (
                          <Badge variant="default" className="text-xs">
                            Zugewiesen
                          </Badge>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Publish Dialog */}
      <Dialog open={publishDialog} onOpenChange={setPublishDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {data.occurrence.rosterPublished
                ? "Roster zurückziehen?"
                : "Roster veröffentlichen?"}
            </DialogTitle>
            <DialogDescription>
              {data.occurrence.rosterPublished
                ? "Das Roster wird für Benutzer nicht mehr sichtbar sein."
                : "Das Roster wird für alle Benutzer sichtbar sein. Weitere Anmeldungen sind dann möglicherweise nicht mehr möglich."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishDialog(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={() =>
                publishRoster(!data.occurrence.rosterPublished)
              }
              disabled={saving}
            >
              {data.occurrence.rosterPublished ? "Zurückziehen" : "Veröffentlichen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
