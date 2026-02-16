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
    <Card className={`border-gray-200 dark:border-gray-800 hover:shadow-md transition-all duration-200 ${
      !config.enabled ? 'opacity-60 bg-gray-50 dark:bg-gray-900/40' : ''
    }`}>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${config.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                <CardTitle className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {config.name}
                </CardTitle>
              </div>
              {config.fir && (
                <Badge 
                  variant="outline" 
                  className="text-xs border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                >
                  {airports.join(", ")}
                </Badge>
              )}
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Clock className="h-3.5 w-3.5" />
                <span>{getPatternDescription()}</span>
              </div>
              
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
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
                className="h-8 w-8 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {canDelete && onDelete && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onDelete}
                className="h-8 w-8 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
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
              <div className="col-span-2 p-2 bg-gray-50 dark:bg-gray-900/40 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Uhrzeit (UTC)</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
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
              <div className="h-3 w-3 rounded-full bg-blue-500/20 flex items-center justify-center">
                <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              </div>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Zu besetzende Stationen
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {staffedStations.map((station: string) => (
                <Badge 
                  key={station} 
                  variant="secondary" 
                  className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                >
                  {station}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Nächste Termine */}
        {config.occurrences && config.occurrences.length > 0 && (
          <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-3.5 w-3.5 text-gray-500" />
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Nächste Termine
              </span>
            </div>
            
            <div className="space-y-1.5 mb-3">
              {config.occurrences.slice(0, 3).map((occ) => (
                <div
                  key={occ.id}
                  className="flex items-center justify-between text-sm py-1 px-2 bg-gray-50 dark:bg-gray-900/40 rounded"
                >
                  <span className="text-gray-900 dark:text-gray-100">
                    {format(new Date(occ.date), "dd.MM.yyyy", { locale: de })}
                  </span>
                  <Badge variant="outline" className="text-xs border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300">
                    {WEEKDAYS[new Date(occ.date).getDay()]}
                  </Badge>
                </div>
              ))}
            </div>
            
            {config.occurrences.length > 3 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                +{config.occurrences.length - 3} weitere Termine
              </p>
            )}
            
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2 border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
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
          <div className="flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <Power className="h-3.5 w-3.5 text-gray-500" />
            <span className="text-xs text-gray-600 dark:text-gray-400">
              Dieses Weekly ist aktuell deaktiviert
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}