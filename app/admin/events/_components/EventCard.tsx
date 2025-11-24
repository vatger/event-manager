"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Trash2, Edit, Eye, Users, Calendar, MapPin } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { useSession } from "next-auth/react";
import { Event } from "@/types";
import { useUser } from "@/hooks/useUser";

interface Props {
  event: Event;
  onEdit: () => void;
  onDelete: () => void;
  onOpenSignup: (event: Event) => void;
  onCloseSignup: (id: string) => void;
  onpublishRoster: (event: Event) => void;
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export function EventCard({ event, onEdit, onDelete, onOpenSignup, onCloseSignup, onpublishRoster }: Props) {
  const { data: session } = useSession();
  const { canInFIR } = useUser();

  const formatZuluRange = useMemo(() => {
    const pad = (n: number) => n.toString().padStart(2, "0");
    const start = new Date(event.startTime);
    const end = new Date(event.endTime);

    return `${pad(start.getUTCDate())} ${MONTHS[start.getUTCMonth()]} ${String(start.getUTCFullYear()).slice(2)} | ${pad(start.getUTCHours())}${pad(start.getUTCMinutes())}z - ${pad(end.getUTCHours())}${pad(end.getUTCMinutes())}z`;
  }, [event.startTime, event.endTime]);

  const formattedDeadline = useMemo(() => {
    if (!event.signupDeadline) return "—";
    const deadline = new Date(event.signupDeadline);
    return deadline.toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }, [event.signupDeadline]);

  const statusBadgeConfig = {
    PLANNING: { variant: "outline" as const, label: "Geplant" },
    SIGNUP_OPEN: { variant: "default" as const, label: "Signup offen" },
    SIGNUP_CLOSED: { variant: "secondary" as const, label: "Signup geschlossen" },
    ROSTER_PUBLISHED: { variant: "secondary" as const, label: "Roster published" },
    DRAFT: { variant: "outline" as const, label: "Entwurf" },
    CANCELLED: { variant: "destructive" as const, label: "Abgesagt" },
  };

  const statusConfig = statusBadgeConfig[event.status as keyof typeof statusBadgeConfig] || {
    variant: "secondary" as const,
    label: event.status,
  };

  return (
    <Card className="relative rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 hover:border-primary/20">
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        <Button
          size="icon"
          variant="outline"
          onClick={onEdit}
          disabled={!canInFIR(event.firCode, "event.edit")}
          className="h-8 w-8"
          aria-label="Event bearbeiten"
        >
          <Edit className="w-4 h-4" />
        </Button>
      </div>

      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold line-clamp-1" title={event.name}>
          {event.name}
        </CardTitle>
        <CardDescription className="flex items-center gap-1 flex-wrap">
          <Calendar className="w-4 h-4" />
          <span>{formatZuluRange}</span>
          {event.airports?.length > 0 && (
            <>
              <span className="mx-1">•</span>
              <MapPin className="w-4 h-4" />
              <span>{event.airports}</span>
            </>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="w-4 h-4" />
            <span>{event.registrations} Anmeldungen</span>
          </div>

          <div className="flex items-center gap-2 text-muted-foreground pb-2">
            <Calendar className="w-4 h-4" />
            <span>Deadline: {formattedDeadline}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={"default"} className="capitalize">
              {event.firCode}
            </Badge>
            <Badge variant={statusConfig.variant} className="capitalize">
              {statusConfig.label}
            </Badge>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2 justify-between pt-3 border-t">
        <div className="flex flex-wrap gap-2">
          {event.status === "SIGNUP_OPEN" ? (
            <Button variant="outline" onClick={() => onCloseSignup(event.id)} size="sm">
              Anmeldung schließen
            </Button>
          ) : event.status === "SIGNUP_CLOSED" ? (
            <Button
              variant="outline"
              onClick={() => onpublishRoster(event)}
              size="sm"
              disabled={!canInFIR(event.firCode, "roster.publish")}
            >
              Roster veröffentlichen
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => onOpenSignup(event)}
              size="sm"
              disabled={event.status !== "PLANNING"}
            >
              Anmeldung öffnen
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link href={`/admin/events/${event.id}`}>
              <Eye className="w-4 h-4 mr-1" />
              Verwalten
            </Link>
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={onDelete}
            disabled={!canInFIR(event.firCode, "event.delete")}
            aria-label="Event löschen"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}