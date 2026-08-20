"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Calendar, List, Clock, MapPin, Power } from "lucide-react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { extractStationGroup } from "@/lib/weeklys/stationUtils";
import { getBadgeClassForEndorsement } from "@/utils/EndorsementBadge";

interface WeeklyEventConfig {
  id: number;
  firId: number | null;
  fir?: { code: string; name: string };
  name: string;
  weekday: number;
  weeksOn: number;
  weeksOff: number;
  startDate: string;
  airports?: string[];
  startTime?: string;
  endTime?: string;
  description?: string;
  requiresRoster?: boolean;
  staffedStations?: string[];
  signupDeadlineHours?: number;
  enabled: boolean;
  occurrences?: Array<{
    id: number;
    date: string;
  }>;
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

interface WeeklyEventCardProps {
  config: WeeklyEventConfig;
  onEdit?: () => void;
  onDelete?: () => void;
  canEdit: boolean;
  canManage: boolean;
  canDelete: boolean;
}

export function WeeklyEventCard({
  config,
  onEdit,
  onDelete,
  canEdit,
  canManage,
  canDelete,
}: WeeklyEventCardProps) {
  const router = useRouter();
  
  const getPatternDescription = () => {
    const weekdayName = WEEKDAYS[config.weekday];
    if (config.weeksOff === 0) {
      return `Jeden ${weekdayName}`;
    }
    return `${config.weeksOn} ${config.weeksOn === 1 ? "Woche" : "Wochen"} aktiv, ${
      config.weeksOff
    } ${config.weeksOff === 1 ? "Woche" : "Wochen"} Pause`;
  };

  const parseJsonField = (field: string[] | string | undefined): string[] => {
    if (!field) return [];
    if (typeof field === "string") {
      try {
        return JSON.parse(field);
      } catch {
        return [];
      }
    }
    return field;
  };

  const airports = parseJsonField(config.airports);
  const staffedStations = parseJsonField(config.staffedStations);

  return (
    <Card
      className={cn(
        "relative rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 hover:border-primary/20",
        !config.enabled && "opacity-60 bg-muted/40"
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <div className="flex items-center gap-2">
                <div className={cn("h-2 w-2 rounded-full", config.enabled ? "bg-success-500" : "bg-muted-foreground/40")} />
                <CardTitle className="text-base font-semibold truncate">
                  {config.name}
                </CardTitle>
              </div>
              {config.fir && (
                <Badge
                  variant="outline"
                  className="text-xs border-accent-500/30 bg-accent-500/10 text-accent-700 dark:text-accent-400"
                >
                  {airports.join(", ")}
                </Badge>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>{getPatternDescription()}</span>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                <span>Start: {format(new Date(config.startDate), "dd.MM.yyyy", { locale: de })}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-1 shrink-0">
            {canEdit && onEdit && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onEdit}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {canDelete && onDelete && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onDelete}
                className="h-8 w-8 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Zeit & Airports */}
        {(config.startTime || config.endTime || airports.length > 0) && (
          <div className="grid grid-cols-2 gap-3">
            {config.startTime && config.endTime && (
              <div className="col-span-2 p-2 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Uhrzeit (lcl)</span>
                  <span className="text-sm font-medium">
                    {config.startTime} - {config.endTime}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Staffed Stations */}
        {config.requiresRoster && staffedStations.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-accent-500/20 flex items-center justify-center">
                <div className="h-1.5 w-1.5 rounded-full bg-accent-500" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">
                Zu besetzende Stationen
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {staffedStations.map((station: string) => (
                <Badge
                  key={station}
                  className={cn("text-xs", getBadgeClassForEndorsement(extractStationGroup(station)))}
                >
                  {station}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Nächste Termine */}
        {config.occurrences && config.occurrences.length > 0 && (
          <div className="pt-3 border-t">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">
                Nächste Termine
              </span>
            </div>

            <div className="space-y-1.5 mb-3">
              {config.occurrences.slice(0, 3).map((occ) => (
                <div
                  key={occ.id}
                  className="flex items-center justify-between text-sm py-1 px-2 bg-muted/50 rounded"
                >
                  <span>
                    {format(new Date(occ.date), "dd.MM.yyyy", { locale: de })}
                  </span>
                  <Badge variant="outline" className="text-xs border-success-500/30 bg-success-500/10 text-success-700 dark:text-success-400">
                    {WEEKDAYS[new Date(occ.date).getDay()]}
                  </Badge>
                </div>
              ))}
            </div>

            {config.occurrences.length > 3 && (
              <p className="text-xs text-muted-foreground mb-3">
                +{config.occurrences.length - 3} weitere Termine
              </p>
            )}

            {canManage && (
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2"
                onClick={() => router.push(`/admin/weeklys/${config.id}/occurrences`)}
              >
                <List className="h-3.5 w-3.5 mr-2" />
                Termine verwalten
              </Button>
            )}
          </div>
        )}

        {/* Deaktiviert Badge */}
        {!config.enabled && (
          <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
            <Power className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              Dieses Weekly ist aktuell deaktiviert
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}