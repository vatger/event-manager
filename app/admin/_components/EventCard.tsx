"use client";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Trash2, Edit, Eye } from "lucide-react";
import Link from "next/link";

interface Props {
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
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (id: string, status: string) => void;
}

export function EventCard({ event, onEdit, onDelete, onStatusChange }: Props) {
  const formatZuluRange = (startTime: string, endTime: string): string => {
    const pad = (n: number) => n.toString().padStart(2, "0");
    const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
    const start = new Date(startTime);
    const end = new Date(endTime);
    return `${pad(start.getUTCDate())} ${months[start.getUTCMonth()]} ${String(start.getUTCFullYear()).slice(2)} | ${pad(start.getUTCHours())}${pad(start.getUTCMinutes())}z - ${pad(end.getUTCHours())}${pad(end.getUTCMinutes())}z`;
  };

  return (
    <Card className="relative rounded-xl shadow-sm hover:shadow-lg transition">
      <div className="absolute top-4 right-4">
        <Button size="sm" variant="outline" onClick={onEdit}>
        <Edit className="w-4 h-4" />
        </Button>
      </div>
      <CardHeader>
        <CardTitle>{event.name}</CardTitle>
        <CardDescription>
          {formatZuluRange(event.startTime, event.endTime)} — {event.airports}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-500">
          {event.registrations} Registrations
        </p>
        <p className="text-sm text-gray-500">
          Deadline: {new Date(event.signupDeadline).toLocaleString()}
        </p>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2 justify-end">
        {event.status=="SIGNUP_OPEN" ? (
            <Button
          variant="outline"
          onClick={() => onStatusChange(event.id, "COMPLETED")}
        >
          Controlleranmeldung schließen
        </Button>
        ) : (
        <Button
          variant="outline"
          onClick={() => onStatusChange(event.id, "SIGNUP_OPEN")}
        >
          Controlleranmeldung öffnen
        </Button>
        )}
        <Link href={`admin/events/${event.id}/signups`}>
          <Button size="sm" variant="outline">
            <Eye className="w-4 h-4 mr-1" /> View Signups
          </Button>
        </Link>
        <Button size="sm" variant="destructive" onClick={onDelete}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
