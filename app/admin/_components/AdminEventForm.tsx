"use client";

import { useEffect, useState } from "react";
import { stationsConfig, StationGroup } from "@/data/station_configs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertCircleIcon } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: any;
  onSuccess: () => void;
}

export default function AdminEventForm({ open, onOpenChange, event, onSuccess }: Props) {
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    bannerUrl: "",
    startTime: "",
    endTime: "",
    airport: "",
    signupDeadline: "",
    staffedStations: [] as string[],
  });

  useEffect(() => {
      if (event) {
        const start = new Date(event.startTime);
        const end = new Date(event.endTime);
        console.log("EVENT", event)
        console.log(end.toISOString())
        setFormData({
          name: event.name,
          description: event.description,
          bannerUrl: event.bannerUrl,
          startTime: start.toISOString().slice(0, 16),
          endTime: end.toISOString().slice(0, 16),
          airport: event.airports.toString(),
          signupDeadline: event.signupDeadline
            ? new Date(event.signupDeadline).toISOString().slice(0, 16)
            : "",
          staffedStations: event.staffedStations as string[],
        });
      } else {
        setFormData({
          name: "",
          description: "",
          bannerUrl: "",
          startTime: "",
          endTime: "",
          airport: "",
          signupDeadline: "",
          staffedStations: [] as string[],
        });
      }
    }, [event]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const toggleStation = (callsign: string) => {
    setFormData((prev) => {
      const selected = prev.staffedStations.includes(callsign);
      return {
        ...prev,
        staffedStations: selected
          ? prev.staffedStations.filter((s) => s !== callsign)
          : [...prev.staffedStations, callsign],
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...formData,
      airports: [formData.airport],
    };

    const method = event ? "PUT" : "POST";
    const url = event ? `/api/events/${event.id}` : "/api/events";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

     const data = await res.json().catch(() => ({}));

    if (res.ok) {
      setError("")
    } else {
      setError("Fehler beim Erstellen oder Speichern des Events! " + data.error)
      console.log(data)
      return
    }
    onSuccess();
    onOpenChange(false);
  };

  const groups: StationGroup[] = ["GND", "TWR", "APP", "CTR"];
  const filteredStations = groups.map((group) => ({
    group,
    stations: stationsConfig.filter(
      (s) => s.group === group && (!s.airport || s.airport === formData.airport)
    ),
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {event ? "Edit Event" : "Create New Event"}
          </DialogTitle>
        </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Event Name"
              required
            />
            <Textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Event Beschreibung"
              required
            />
            <Input
              name="bannerUrl"
              value={formData.bannerUrl}
              onChange={handleChange}
              placeholder="Banner URL"
              required
            />

            <div className="flex gap-4">
              <Input
                type="datetime-local"
                name="startTime"
                value={formData.startTime}
                onChange={handleChange}
                required
              />
              <Input
                type="datetime-local"
                name="endTime"
                value={formData.endTime}
                onChange={handleChange}
                required
              />
            </div>

            <Input
              name="airport"
              value={formData.airport}
              onChange={handleChange}
              placeholder="ICAO Airport"
              required
            />

            {formData.airport && (
              <Accordion type="multiple" className="w-full">
                {filteredStations.map(({ group, stations }) =>
                  stations.length > 0 ? (
                    <AccordionItem key={group} value={group}>
                      <AccordionTrigger>{group}</AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2">
                          {stations.map((station) => (
                            <div key={station.callsign} className="flex items-center space-x-2">
                              <Checkbox
                                id={station.callsign}
                                checked={formData.staffedStations.includes(station.callsign)}
                                onCheckedChange={() => toggleStation(station.callsign)}
                              />
                              <Label htmlFor={station.callsign}>{station.callsign}</Label>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ) : null
                )}
              </Accordion>
            )}

            <Input
              type="datetime-local"
              name="signupDeadline"
              value={formData.signupDeadline}
              onChange={handleChange}
            />
            {error &&
            <Alert variant={"destructive"}>
              <AlertCircleIcon />
              <AlertTitle>Fehler</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            }
            <Button onClick={handleSubmit}>{event ? "Save" : "Create"}</Button>
          </form>
        </DialogContent>
    </Dialog>
  );
}
