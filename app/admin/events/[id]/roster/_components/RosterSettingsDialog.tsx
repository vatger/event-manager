"use client";

import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { CalendarClock, ExternalLink } from "lucide-react";
import { StationsSection } from "./StationsSection";
import { EditorsSection } from "./EditorsSection";
import type { ApiRoster, Assignment } from "../_lib/rosterTypes";

interface RosterSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: number;
  eventAirports: string[];
  firCode?: string;
  roster: ApiRoster;
  assignments: Assignment[];
  /** Zeitfenster des Events, nur zur Anzeige – geändert wird es am Event */
  eventWindow: string;
  canEdit: boolean;
  canManageEditors: boolean;
  apiHeaders: Record<string, string>;
  onUpdated: () => void;
}

/**
 * Alle Einstellungen des Besetzungsplans an einem Ort.
 *
 * Vorher lagen Raster, Stationen und Zugriff in getrennten Dialogen, die sich
 * je nach Berechtigung einzeln in der Kopfleiste stapelten. Zusammengefasst
 * beantwortet der Dialog eine Frage – „wie ist dieser Plan aufgesetzt?" – und
 * verweist für das Zeitfenster dorthin, wo es hingehört: an das Event selbst.
 */
export function RosterSettingsDialog({
  open,
  onOpenChange,
  eventId,
  eventAirports,
  firCode,
  roster,
  assignments,
  eventWindow,
  canEdit,
  canManageEditors,
  apiHeaders,
  onUpdated,
}: RosterSettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-full overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Einstellungen des Besetzungsplans</DialogTitle>
          <DialogDescription>
            Zeitraster, Stationen und wer den Plan bearbeiten darf.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue={canEdit ? "plan" : "access"}>
          <TabsList className="w-full">
            {canEdit && (
              <TabsTrigger value="plan" className="flex-1">
                Stationen &amp; Raster
              </TabsTrigger>
            )}
            {canManageEditors && (
              <TabsTrigger value="access" className="flex-1">
                Zugriff
              </TabsTrigger>
            )}
            <TabsTrigger value="event" className="flex-1">
              Zeitraum
            </TabsTrigger>
          </TabsList>

          {canEdit && (
            <TabsContent value="plan" className="mt-4">
              <StationsSection
                open={open}
                eventId={eventId}
                eventAirports={eventAirports}
                firCode={firCode}
                roster={roster}
                assignments={assignments}
                onUpdated={onUpdated}
                onDone={() => onOpenChange(false)}
              />
            </TabsContent>
          )}

          {canManageEditors && (
            <TabsContent value="access" className="mt-4">
              <EditorsSection open={open} eventId={eventId} apiHeaders={apiHeaders} />
            </TabsContent>
          )}

          <TabsContent value="event" className="mt-4 space-y-3">
            {/* Der Zeitraum gehört dem Event, nicht dem Plan: Er bestimmt auch
                Anmeldung und öffentliche Anzeige und wird deshalb dort
                geändert – hier steht nur der Verweis. */}
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground mb-1">Aktueller Eventzeitraum</p>
              <p className="text-sm font-medium flex items-center gap-1.5">
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
                {eventWindow}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              Der Zeitraum gilt für das gesamte Event – er bestimmt auch die Anmeldung
              und die öffentliche Anzeige. Geändert wird er deshalb in den
              Event-Einstellungen. Die Breite des Besetzungsplans folgt automatisch.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href={`/admin/events/${eventId}/edit`}>
                Event-Einstellungen öffnen
                <ExternalLink className="h-4 w-4 ml-1.5" />
              </Link>
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export default RosterSettingsDialog;
