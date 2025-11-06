import { Event } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface EventHeaderProps {
  event: Event;
  onRefresh: () => void;
  loading: boolean;
}

export default function EventHeader({ event, onRefresh, loading }: EventHeaderProps) {
  const formatTimeZ = (dateIso?: string | Date) => {
    if (!dateIso) return "-";
    const d = new Date(dateIso);
    const hh = String(d.getUTCHours()).padStart(2, "0");
    const mm = String(d.getUTCMinutes()).padStart(2, "0");
    return `${hh}:${mm}z`;
  };

  const airportsLabel = (airports?: string[] | string | null) => {
    if (Array.isArray(airports)) return airports.join(", ");
    if (typeof airports === "string") return airports;
    return "-";
  };

  const dateLabel = new Date(event.startTime).toLocaleDateString("de-DE");
  const timeLabel = `${formatTimeZ(event.startTime)} - ${formatTimeZ(event.endTime)}`;

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Anmeldungen: {event.name}</h1>
        <div className="text-muted-foreground">{dateLabel} • {timeLabel} • {airportsLabel(event.airports)}</div>
      </div>
      <div className="flex gap-2">
        <Badge variant={event.status === "SIGNUP_OPEN" ? "default" : "secondary"}>
          {event.status || "-"}
        </Badge>
        <Button variant="outline" onClick={onRefresh} disabled={loading}>
          Neu laden
        </Button>
      </div>
    </div>
  );
}