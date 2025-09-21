"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Trash2, Edit, Eye, Users, Calendar, MapPin } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

interface Event {
  id: string;
  name: string;
  description: string;
  bannerUrl: string;
  airports: string[];
  startTime: string;
  endTime: string;
  staffedStations: string[];
  signupDeadline: string | null;
  registrations: number;
  status: string;
}

interface Props {
  event: Event;
  onEdit: () => void;
  onDelete: () => void;
  onOpenSignup: (event: Event) => void;
  onCloseSignup: (id: string) => void;
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export function EventCard({ event, onEdit, onDelete, onOpenSignup, onCloseSignup }: Props) {
  const formatZuluRange = useMemo(() => {
    const pad = (n: number) => n.toString().padStart(2, "0");
    const start = new Date(event.startTime);
    const end = new Date(event.endTime);
    
    return `${pad(start.getDate())} ${MONTHS[start.getMonth()]} ${String(start.getFullYear()).slice(2)} | ${pad(start.getHours())}${pad(start.getMinutes())}z - ${pad(end.getHours())}${pad(end.getMinutes())}z`;
  }, [event.startTime, event.endTime]);

  const formattedDeadline = useMemo(() => {
    if (!event.signupDeadline) return "—";
    const deadline = new Date(event.signupDeadline);
    return deadline.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }, [event.signupDeadline]);

  const statusBadgeConfig = {
    PLANNING: { variant: "outline" as const, label: "Geplant" },
    SIGNUP_OPEN: { variant: "default" as const, label: "Signup offen" },
    SIGNUP_CLOSED: { variant: "secondary" as const, label: "Signup geschlossen" },
    ROSTER_PUBLISHED: { variant: "secondary" as const, label: "Roster published" },
    DRAFT: { variant: "outline" as const, label: "Entwurf" },
    CANCELLED: { variant: "destructive" as const, label: "Abgesagt" }
  };

  const statusConfig = statusBadgeConfig[event.status as keyof typeof statusBadgeConfig] || 
                       { variant: "secondary" as const, label: event.status };

  return (
    <Card className="relative rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 hover:border-primary/20">
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        <Badge variant={statusConfig.variant} className="capitalize">
          {statusConfig.label}
        </Badge>
        <Button 
          size="icon" 
          variant="outline" 
          onClick={onEdit}
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
              <span>{(event.airports || []).join(", ")}</span>
            </>
          )}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="pb-3">
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="w-4 h-4" />
            <span>{event.registrations} Anmeldungen</span>
          </div>
          
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>Deadline: {formattedDeadline}</span>
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="flex flex-wrap gap-2 justify-end pt-3 border-t">
        {event.status === "SIGNUP_OPEN" ? (
          <Button 
            variant="outline" 
            onClick={() => onCloseSignup(event.id)}
            size="sm"
          >
            Anmeldung schließen
          </Button>
        ) : (
          <Button 
            variant="outline" 
            onClick={() => onOpenSignup(event)}
            size="sm"
            disabled={event.status === "COMPLETED" || event.status === "CANCELLED"}
          >
            Anmeldung öffnen
          </Button>
        )}
        
        <Button size="sm" variant="outline" asChild>
              <Link href={`/admin/events/${event.id}/signups`}>
              <Eye className="w-4 h-4 mr-1" />
              Anmeldungen
              </Link>
          </Button>
        
        
        <Button 
          size="sm" 
          variant="destructive" 
          onClick={onDelete}
          disabled={event.status === "COMPLETED"}
          aria-label="Event löschen"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}