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
import { Pencil, Trash2, Calendar, List } from "lucide-react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { de } from "date-fns/locale";

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
  canDelete: boolean;
}

export function WeeklyEventCard({
  config,
  onEdit,
  onDelete,
  canEdit,
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
    <Card className={!config.enabled ? "opacity-60" : ""}>
      <CardHeader>
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="truncate">{config.name}</CardTitle>
              {config.fir && (
                <Badge variant="outline" className="shrink-0">
                  {config.fir.code}
                </Badge>
              )}
              {!config.enabled && (
                <Badge variant="secondary" className="shrink-0">
                  Deaktiviert
                </Badge>
              )}
            </div>
            <CardDescription className="mt-1">
              {getPatternDescription()}
            </CardDescription>
          </div>
          <div className="flex gap-1 shrink-0">
            {canEdit && onEdit && (
              <Button variant="ghost" size="icon" onClick={onEdit}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {canDelete && onDelete && (
              <Button variant="ghost" size="icon" onClick={onDelete}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Start:</span>
            <span>
              {format(new Date(config.startDate), "dd.MM.yyyy", {
                locale: de,
              })}
            </span>
          </div>

          {(config.startTime || config.endTime) && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Uhrzeit (UTC):</span>
              <span>
                {config.startTime || "?"} - {config.endTime || "?"}
              </span>
            </div>
          )}

          {airports.length > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Flughäfen:</span>
              <span className="font-mono text-xs">{airports.join(", ")}</span>
            </div>
          )}

          {config.requiresRoster && staffedStations.length > 0 && (
            <div className="space-y-1">
              <span className="text-muted-foreground text-sm">
                Zu besetzende Stationen:
              </span>
              <div className="flex flex-wrap gap-1">
                {staffedStations.map((station: string) => (
                  <Badge key={station} variant="secondary" className="text-xs">
                    {station}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {config.occurrences && config.occurrences.length > 0 && (
          <div className="border-t pt-3">
            <p className="text-sm font-medium mb-2 flex items-center gap-2">
              <Calendar className="h-3 w-3" />
              Nächste Termine:
            </p>
            <div className="space-y-1">
              {config.occurrences.slice(0, 3).map((occ) => (
                <div
                  key={occ.id}
                  className="flex justify-between items-center text-sm"
                >
                  <span>
                    {format(new Date(occ.date), "dd.MM.yyyy", {
                      locale: de,
                    })}
                  </span>
                </div>
              ))}
              {config.occurrences.length > 3 && (
                <p className="text-xs text-muted-foreground">
                  +{config.occurrences.length - 3} weitere
                </p>
              )}
            </div>
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-3"
                onClick={() => router.push(`/admin/weeklys/${config.id}/occurrences`)}
              >
                <List className="h-4 w-4 mr-2" />
                Occurrences verwalten
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
