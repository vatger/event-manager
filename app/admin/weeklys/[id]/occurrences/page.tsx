"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { ArrowLeft, Calendar, MoreVertical, Trash2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { getEffectiveSignupStatus } from "@/lib/weeklys/signupStatus";

interface WeeklyConfig {
  id: number;
  name: string;
  requiresRoster: boolean;
}

interface Occurrence {
  id: number;
  date: string;
  signupDeadline: string | null;
  signupStatus: string;
  rosterPublished: boolean;
  rosterPublishedAt: string | null;
  _count: {
    signups: number;
  };
}

export default function OccurrencesPage() {
  const router = useRouter();
  const params = useParams();
  const { data: session } = useSession();
  const configId = parseInt(params.id as string);

  const [config, setConfig] = useState<WeeklyConfig | null>(null);
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [editDateDialog, setEditDateDialog] = useState<{ open: boolean; occurrence: Occurrence | null }>({
    open: false,
    occurrence: null,
  });
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");

  const [statusDialog, setStatusDialog] = useState<{ open: boolean; occurrence: Occurrence | null }>({
    open: false,
    occurrence: null,
  });
  const [newStatus, setNewStatus] = useState("auto");

  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; occurrence: Occurrence | null }>({
    open: false,
    occurrence: null,
  });

  const [rosterDialog, setRosterDialog] = useState<{ open: boolean; occurrence: Occurrence | null }>({
    open: false,
    occurrence: null,
  });

  const [submitting, setSubmitting] = useState(false);

  // Fetch data
  useEffect(() => {
    fetchData();
  }, [configId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch weekly config
      const configRes = await fetch(`/api/admin/discord/weekly-events/${configId}`);
      if (!configRes.ok) throw new Error("Failed to fetch config");
      const configData = await configRes.json();
      setConfig(configData);

      // Fetch occurrences
      const occRes = await fetch(`/api/admin/weeklys/${configId}/occurrences`);
      if (!occRes.ok) throw new Error("Failed to fetch occurrences");
      const occData = await occRes.json();
      setOccurrences(occData.occurrences || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Fehler", {
        description: "Daten konnten nicht geladen werden.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditDate = async () => {
    if (!editDateDialog.occurrence || !newDate || !newTime) return;

    setSubmitting(true);
    try {
      const dateTime = new Date(`${newDate}T${newTime}:00Z`);
      const res = await fetch(
        `/api/admin/weeklys/${configId}/occurrences/${editDateDialog.occurrence.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: dateTime.toISOString() }),
        }
      );

      if (!res.ok) throw new Error("Failed to update occurrence");

      toast.success("Erfolg", {
        description: "Datum wurde aktualisiert.",
      });

      setEditDateDialog({ open: false, occurrence: null });
      fetchData();
    } catch (error) {
      console.error("Error updating date:", error);
      toast.error("Fehler", {
        description: "Datum konnte nicht aktualisiert werden.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangeStatus = async () => {
    if (!statusDialog.occurrence) return;

    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/admin/weeklys/${configId}/occurrences/${statusDialog.occurrence.id}/signup-status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (!res.ok) throw new Error("Failed to update status");

      toast.success("Erfolg", {
        description: "Status wurde aktualisiert.",
      });

      setStatusDialog({ open: false, occurrence: null });
      fetchData();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Fehler", {
        description: "Status konnte nicht aktualisiert werden.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.occurrence) return;

    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/admin/weeklys/${configId}/occurrences/${deleteDialog.occurrence.id}`,
        {
          method: "DELETE",
        }
      );

      if (!res.ok) throw new Error("Failed to delete occurrence");

      toast.success("Erfolg", {
        description: "Occurrence wurde gelöscht.",
      });

      setDeleteDialog({ open: false, occurrence: null });
      fetchData();
    } catch (error) {
      console.error("Error deleting occurrence:", error);
      toast.error("Fehler", {
        description: "Occurrence konnte nicht gelöscht werden.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublishRoster = async () => {
    if (!rosterDialog.occurrence) return;

    setSubmitting(true);
    try {
      const willPublish = !rosterDialog.occurrence.rosterPublished;
      const res = await fetch(
        `/api/admin/weeklys/${configId}/occurrences/${rosterDialog.occurrence.id}/publish-roster`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ published: willPublish }),
        }
      );

      if (!res.ok) throw new Error("Failed to publish roster");

      toast.success("Erfolg", {
        description: willPublish ? "Roster wurde veröffentlicht." : "Roster wurde zurückgezogen.",
      });

      setRosterDialog({ open: false, occurrence: null });
      fetchData();
    } catch (error) {
      console.error("Error publishing roster:", error);
      toast.error("Fehler", {
        description: "Roster konnte nicht veröffentlicht werden.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (occurrence: Occurrence) => {
    if (!config) return null;

    if (occurrence.signupStatus === "open") {
      return <Badge className="bg-green-600">Offen</Badge>;
    }
    if (occurrence.signupStatus === "closed") {
      return <Badge className="bg-red-600">Geschlossen</Badge>;
    }

    // Auto mode - calculate effective status
    const status = getEffectiveSignupStatus(
      {
        date: new Date(occurrence.date),
        signupDeadline: occurrence.signupDeadline ? new Date(occurrence.signupDeadline) : null,
        signupStatus: occurrence.signupStatus,
      },
      { requiresRoster: config.requiresRoster }
    );

    if (status.isOpen) {
      return <Badge className="bg-blue-600">Auto (Offen)</Badge>;
    }

    if (status.reason === "not_yet_open" && status.opensAt) {
      return (
        <Badge className="bg-blue-600">
          Auto (Öffnet {format(status.opensAt, "dd.MM.", { locale: de })})
        </Badge>
      );
    }

    return <Badge className="bg-gray-600">Auto (Geschlossen)</Badge>;
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push("/admin/events")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Zurück
          </Button>
          <h1 className="text-3xl font-bold">
            Occurrences - {config?.name || "Loading..."}
          </h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Alle Occurrences</CardTitle>
        </CardHeader>
        <CardContent>
          {occurrences.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Keine Occurrences vorhanden.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Anmeldeschluss</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Anmeldungen</TableHead>
                  <TableHead>Roster</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {occurrences.map((occ) => (
                  <TableRow key={occ.id}>
                    <TableCell>
                      {format(new Date(occ.date), "dd.MM.yyyy HH:mm", { locale: de })} UTC
                    </TableCell>
                    <TableCell>
                      {occ.signupDeadline
                        ? format(new Date(occ.signupDeadline), "dd.MM. HH:mm", { locale: de })
                        : "-"}
                    </TableCell>
                    <TableCell>{getStatusBadge(occ)}</TableCell>
                    <TableCell>{occ._count.signups}</TableCell>
                    <TableCell>
                      {occ.rosterPublished ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <XCircle className="w-5 h-5 text-gray-400" />
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              const date = new Date(occ.date);
                              setNewDate(date.toISOString().split("T")[0]);
                              setNewTime(date.toISOString().split("T")[1].substring(0, 5));
                              setEditDateDialog({ open: true, occurrence: occ });
                            }}
                          >
                            <Calendar className="w-4 h-4 mr-2" />
                            Datum bearbeiten
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setNewStatus(occ.signupStatus);
                              setStatusDialog({ open: true, occurrence: occ });
                            }}
                          >
                            Status ändern
                          </DropdownMenuItem>
                          {config?.requiresRoster && (
                            <DropdownMenuItem
                              onClick={() => setRosterDialog({ open: true, occurrence: occ })}
                            >
                              {occ.rosterPublished ? "Roster zurückziehen" : "Roster veröffentlichen"}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => setDeleteDialog({ open: true, occurrence: occ })}
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Löschen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Date Dialog */}
      <Dialog open={editDateDialog.open} onOpenChange={(open) => setEditDateDialog({ open, occurrence: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Datum bearbeiten</DialogTitle>
            <DialogDescription>Neues Datum und Uhrzeit für diese Occurrence festlegen.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Datum</Label>
              <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            </div>
            <div>
              <Label>Uhrzeit (UTC)</Label>
              <Input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDateDialog({ open: false, occurrence: null })}>
              Abbrechen
            </Button>
            <Button onClick={handleEditDate} disabled={submitting}>
              {submitting ? "Wird gespeichert..." : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Status Dialog */}
      <Dialog open={statusDialog.open} onOpenChange={(open) => setStatusDialog({ open, occurrence: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Status ändern</DialogTitle>
            <DialogDescription>Anmeldestatus für diese Occurrence festlegen.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Automatisch (2 Wochen vorher)</SelectItem>
                  <SelectItem value="open">Offen</SelectItem>
                  <SelectItem value="closed">Geschlossen</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialog({ open: false, occurrence: null })}>
              Abbrechen
            </Button>
            <Button onClick={handleChangeStatus} disabled={submitting}>
              {submitting ? "Wird gespeichert..." : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, occurrence: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Occurrence löschen</DialogTitle>
            <DialogDescription>
              Möchten Sie diese Occurrence wirklich löschen?
              {deleteDialog.occurrence && deleteDialog.occurrence._count.signups > 0 && (
                <span className="block mt-2 text-red-600 font-semibold">
                  Achtung: Es gibt {deleteDialog.occurrence._count.signups} Anmeldung(en) für diese Occurrence!
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, occurrence: null })}>
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={submitting}>
              {submitting ? "Wird gelöscht..." : "Löschen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Publish Roster Dialog */}
      <Dialog open={rosterDialog.open} onOpenChange={(open) => setRosterDialog({ open, occurrence: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {rosterDialog.occurrence?.rosterPublished ? "Roster zurückziehen" : "Roster veröffentlichen"}
            </DialogTitle>
            <DialogDescription>
              {rosterDialog.occurrence?.rosterPublished
                ? "Möchten Sie das Roster wirklich zurückziehen?"
                : "Möchten Sie das Roster wirklich veröffentlichen? Alle Teilnehmer werden benachrichtigt."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRosterDialog({ open: false, occurrence: null })}>
              Abbrechen
            </Button>
            <Button onClick={handlePublishRoster} disabled={submitting}>
              {submitting ? "Wird gespeichert..." : rosterDialog.occurrence?.rosterPublished ? "Zurückziehen" : "Veröffentlichen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
