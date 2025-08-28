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
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    bannerUrl: "",
    startTime: "",
    endTime: "",
    airport: "",
    staffedStations: [] as string[],
  });

  useEffect(() => {
      if (event) {
        const start = new Date(event.startTime);
        const end = new Date(event.endTime);
        setFormData({
          name: event.name,
          description: event.description,
          bannerUrl: event.bannerUrl,
          startTime: start.toISOString().slice(0, 16),
          endTime: end.toISOString().slice(0, 16),
          airport: event.airports.toString(),
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
          staffedStations: [] as string[],
        });
      }
    }, [event]);

  useEffect(() => {
    if (open) {
      setError("");
      setSaving(false);
    }
  }, [open]);

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
    setSaving(true);
    const payload = {
      name: formData.name,
      description: formData.description,
      bannerUrl: formData.bannerUrl,
      startTime: formData.startTime,
      endTime: formData.endTime,
      airports: [formData.airport],
      staffedStations: formData.staffedStations,
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
      setSaving(false)
      return
    }
    onSuccess();
    setError("");
    onOpenChange(false);
    setSaving(false)
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
      <DialogContent className="sm:max-w-2xl max-h-[calc(100vh-4rem)] overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            {event ? "Edit Event" : "Create New Event"}
          </DialogTitle>
        </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col h-full">
            {error && (
                    <Alert variant={"destructive"} className="mb-4 mr-2">
                      <AlertCircleIcon />
                      <AlertTitle>Fehler</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
              <div className={`space-y-4 overflow-y-auto pr-2 ${error ? "max-h-[calc(100vh-17rem)]" : "max-h-[calc(100vh-14rem)]"}`}>
                <div className="space-y-1">
                  <Label htmlFor="name">Event Name</Label>
                  <Input id="name" name="name" value={formData.name} onChange={handleChange} placeholder="z. B. Munich Overload" required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="description">Beschreibung</Label>
                  <Textarea id="description" name="description" value={formData.description} onChange={handleChange} placeholder="Kurze Eventbeschreibung" required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="bannerUrl">Banner URL</Label>
                  <Input id="bannerUrl" name="bannerUrl" value={formData.bannerUrl} onChange={handleChange} placeholder="https://..." required />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="startTime">Startzeit (zulu)</Label>
                    <Input id="startTime" type="datetime-local" name="startTime" value={formData.startTime} onChange={handleChange} required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="endTime">Endzeit (zulu)</Label>
                    <Input id="endTime" type="datetime-local" name="endTime" value={formData.endTime} onChange={handleChange} required />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="airport">Airport (ICAO)</Label>
                  <Input id="airport" name="airport" value={formData.airport} onChange={handleChange} placeholder="z. B. EDDM" required />
                </div>

                {formData.airport && (
                  <div className="space-y-2">
                    <Label>Stationen</Label>
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
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button type="submit" disabled={saving}>
                  {event ? (saving ? "Saving..." : "Save") : (saving ? "Creating..." : "Create")}
                </Button>
              </div>
            </form>
          </DialogContent>
    </Dialog>
  );
}
