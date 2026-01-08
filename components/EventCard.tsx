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
import { Calendar, CheckCircle, Clock, MapPin, Timer, UserCheck, Users, XCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import EventBanner from "@/components/Eventbanner";
import { Event } from "@/types";
import { CanControlIcon } from "./CanControlIcon";
import { getSessionUser } from "@/lib/getSessionUser";
import { getRatingValue } from "@/utils/ratingToValue";
import { useSession } from "next-auth/react";

interface EventCardProps {
  event: Event;
  showBanner: boolean;
}

export default function EventCard({ event, showBanner }: EventCardProps) {
  
  const statusConfig: Record<"SIGNUP_OPEN" | "SIGNUP_CLOSED" | "PLANNING" | "ROSTER_PUBLISHED" | "CANCELLED", { variant: "default" | "secondary" | "outline" | "destructive" | null; className: string; label: string }> = {
    SIGNUP_OPEN: {
      variant: "default",
      className: "bg-green-100 text-green-800",
      label: "Anmeldung offen",
    },
    SIGNUP_CLOSED: {
      variant: "secondary",
      className: "bg-gray-100 text-gray-700",
      label: "Anmeldung geschlossen",
    },
    PLANNING: {
      variant: "outline",
      className: "bg-blue-100 text-blue-800",
      label: "Geplant",
    },
    ROSTER_PUBLISHED: {
      variant: "default",
      className: "bg-teal-100 text-teal-800",
      label: "Besetzungsplan",
    },
    CANCELLED: {
      variant: "destructive",
      className: "bg-red-100 text-red-800",
      label: "Abgesagt",
    },
  };

  const status = statusConfig[event.status as keyof typeof statusConfig] || {
    variant: "secondary",
    className: "bg-gray-100 text-gray-700",
    label: event.status,
  };


  const start = new Date(event.startTime);
  const end = new Date(event.endTime);

  const startDateFormatted = start.toLocaleDateString("de-GB", { timeZone: "UTC", dateStyle: "medium" });
  const startTimeFormatted = start.toLocaleTimeString("de-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit" });
  const endTimeFormatted = end.toLocaleTimeString("de-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit" });

  const { data: session } = useSession();
  

  return (
    <Card className="hover:shadow-xl transition-all duration-200 border rounded-2xl">
      <CardHeader>
          {showBanner && (
              <EventBanner 
              bannerUrl={event.bannerUrl} 
              eventName={event.name}
              className="rounded-sm w-full object-cover"
            />
          )}

        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">{event.name}</CardTitle>
        
          {event.status === "SIGNUP_OPEN" && (
            <div className="mr-2">
              <CanControlIcon 
                params = {
                  { 
                    user: {
                      userCID: Number(session?.user?.cid),
                      rating: getRatingValue(session?.user?.rating || "OBS")
                    }, 
                    event: {
                      airport: event.airports,
                      fir: event.firCode
                    } 
                  }
                } 
              />
            </div>
          )}
        </div>

        <CardDescription className="flex items-center gap-2 text-sm">
          <Badge variant="secondary">
              {event.firCode}
        </Badge>
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-gray-500" />
          <span>{Array(event.airports).join(', ')}</span>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-500" />
          <span>
            {startDateFormatted} {startTimeFormatted}z -{endTimeFormatted}z
          </span>

        </div>

        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-gray-500" />
          <span>{event.registrations} {event.registrations == 1 ? "Anmeldung" : "Anmeldungen"}</span>
        </div>

        <div className="flex justify-between">
        {event.status == "SIGNUP_OPEN" && event.signupDeadline ? (
          <Badge variant="default" className="bg-green-100 text-green-800">Anmelden bis: {new Date(event.signupDeadline).toLocaleDateString("en-de", {
                dateStyle: "medium",
              })}</Badge>
        ) : (
              

              <Badge variant={status.variant} className={status.className}>
                {status.label}
              </Badge>
        )}
        
        </div>
      </CardContent>

      <CardFooter>
          <Link className="w-full" href={`/events/${event.id}`}>
          <Button
            variant="default"
            className="
              w-full h-10
              bg-gradient-to-r from-primary to-primary/80
              text-primary-foreground

              hover:from-primary/90 hover:to-primary/70

              transition-colors
            "
          >
            See More
              {typeof event.isSignedUp === "boolean" && event.isSignedUp && (
                <UserCheck />
              )} 
            </Button>
          </Link>
      </CardFooter>
    </Card>
  );
}
