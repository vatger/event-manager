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
  import { Calendar, MapPin, UserCheck, Users } from "lucide-react";
  import Link from "next/link";
  
  interface EventCardProps {
    event: {
      id: string;
      name: string;
      description: string;
      bannerUrl: string;
      airports: string;
      startTime: string;
      endTime: string;
      staffedStations: string[];
      signupDeadline: string;
      registrations: number;
      status: string;
      isSignedUp?: boolean;
    };
    onClick: () => void;
  }
  
  export default function EventCard({ event, onClick }: EventCardProps) {
    const startDate = new Date(event.startTime).toLocaleString("en-de", {
      dateStyle: "medium",
      timeStyle: "short",
    });
    const endDate = new Date(event.endTime).toLocaleString("en-de", {
      dateStyle: "medium",
      timeStyle: "short",
    });
    
      
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

        
  
    return (
      <Card className="hover:shadow-xl transition-all duration-200 border rounded-2xl">
        <CardHeader>
          <img src={event.bannerUrl} className="rounded-sm"/>
          <CardTitle className="text-lg font-semibold">{event.name}</CardTitle>
          <CardDescription className="flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4" /> {event.airports}
          </CardDescription>
        </CardHeader>
  
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <span>
              {startDate.split(", ")[0]} {startDate.split(", ")[1].split(":")[0]}:{startDate.split(", ")[1].split(":")[1]}-
              {endDate.split(", ")[1].split(":")[0]}:{endDate.split(", ")[1].split(":")[1]}lcl
            </span>
          </div>
  
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-500" />
            <span>{event.registrations} {event.registrations == 1 ? "Registration" : "Registrations"}</span>
          </div>

          
          {event.status == "SIGNUP_OPEN" && event.signupDeadline ? (
            <Badge variant="default" className="bg-green-100 text-green-800">Anmelden bis: {new Date(event.signupDeadline).toLocaleDateString("en-de", {
                  dateStyle: "medium",
                })}</Badge>
          ) : (
                

                <Badge variant={status.variant} className={status.className}>
                  {status.label}
                </Badge>
          )}
          
          
        </CardContent>
  
        <CardFooter>
            <Link className="w-full" href={`/events/${event.id}`}>
              <Button className="w-full hover:bg-gray-700">
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
  