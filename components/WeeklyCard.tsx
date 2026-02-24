import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, Repeat } from "lucide-react";
import Link from "next/link";

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
  startDate: string;
  airports?: string[];
  startTime?: string;
  endTime?: string;
  description?: string;
  bannerUrl?: string | null;
  requiresRoster?: boolean;
  staffedStations?: string[];
  enabled: boolean;
}

interface WeeklyCardProps {
  config: WeeklyConfig;
  showBanner?: boolean;
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

export default function WeeklyCard({ config, showBanner = false }: WeeklyCardProps) {
  const parseAirports = (airports: string[] | string | null | undefined): string[] => {
    if (!airports) return [];
    if (Array.isArray(airports)) return airports;
    if (typeof airports === "string") {
      try {
        return JSON.parse(airports);
      } catch {
        return [];
      }
    }
    return [];
  };

  const airports = parseAirports(config.airports);

  return (
    <Card className="hover:shadow-xl transition-all duration-200 border rounded-2xl">
      <CardHeader>
        {showBanner && config.bannerUrl && (
          <div className="relative w-full h-40 overflow-hidden rounded-sm mb-4">
            <img
              src={config.bannerUrl}
              alt={`${config.name} Banner`}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">{config.name}</CardTitle>
          <Repeat className="w-5 h-5 text-muted-foreground" />
        </div>

        <CardDescription className="flex items-center gap-2 text-sm">
          <Badge variant="secondary">
            {config.fir?.code || "N/A"}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {config.weeksOff === 0 
              ? `Jeden ${WEEKDAYS[config.weekday]}`
              : `${WEEKDAYS[config.weekday]}s`
            }
          </Badge>
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3 text-sm">
        {airports.length > 0 && (
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-gray-500" />
            <span className="font-mono">{airports.join(", ")}</span>
          </div>
        )}

        {(config.startTime || config.endTime) && (
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-500" />
            <span>
              {config.startTime || "?"} - {config.endTime || "?"} Uhr (MEZ/MESZ)
            </span>
          </div>
        )}

        {config.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 pt-1">
            {config.description}
          </p>
        )}

        <div className="flex justify-between pt-2">
          <Badge variant="secondary" className="text-xs">
            {config.weeksOn} {config.weeksOn === 1 ? "Woche" : "Wochen"} aktiv
          </Badge>
          {config.weeksOff > 0 && (
            <Badge variant="outline" className="text-xs">
              {config.weeksOff} {config.weeksOff === 1 ? "Woche" : "Wochen"} Pause
            </Badge>
          )}
        </div>
      </CardContent>

      <CardFooter>
        <Link className="w-full" href={`/weeklys/${config.id}`}>
          <Button className="w-full" variant="default">
            Details ansehen
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
