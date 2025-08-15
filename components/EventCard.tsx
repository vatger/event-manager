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
  import { Calendar, MapPin, Users } from "lucide-react";
import { useEventSignup } from "@/hooks/useEventSignup";
  
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
    };
    onClick: () => void;
  }
  
  export default function EventCard({ event, onClick }: EventCardProps) {
    const startDate = new Date(event.startTime).toLocaleString("en-GB", {
      dateStyle: "short",
      timeStyle: "short",
    });
    const endDate = new Date(event.endTime).toLocaleString("en-GB", {
      dateStyle: "short",
      timeStyle: "short",
    });
    
    const { isSignedUp } = useEventSignup(event.id)
  
    const statusColor =
      event.status === "controlleranmeldung"
        ? "bg-green-100 text-green-800"
        : "bg-gray-100 text-gray-700";
  
    return (
      <Card className="hover:shadow-xl transition-all duration-200 border border-gray-200 rounded-2xl">
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
            <span>{startDate} – {endDate}</span>
          </div>
  
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-500" />
            <span>{event.registrations} Registrations</span>
          </div>
  
          <Badge variant={event.status=="controlleranmeldung" ? "default" : "secondary"} className={statusColor}>{event.status}</Badge>
        </CardContent>
  
        <CardFooter>
          {event.status === "controlleranmeldung" ? (
            <Button className={isSignedUp ? "bg-green-600 hover:bg-green-700 w-full" : "w-full hover:bg-gray-700"} onClick={onClick}>
              {isSignedUp ? "Edit Sign up" : "Sign up"}
            </Button>
          ) : (
            <Button className="w-full" variant="outline" disabled>
              Not Open
            </Button>
          )}
        </CardFooter>
      </Card>
    );
  }
  