"use client";

import { useEffect, useState, useCallback } from "react";
import { stationsConfig, StationGroup } from "@/data/station_configs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertCircleIcon, Loader2 } from "lucide-react";

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
  registrations: number,
  status: "DRAFT" | "PLANNING" | "SIGNUP_OPEN" | "SIGNUP_CLOSED" | "ROSTER_PUBLISHED" | "CANCELLED" | string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: Event | null;
  onSuccess: () => void;
}

interface FormData {
  name: string;
  description: string;
  bannerUrl: string;
  startTime: string;
  endTime: string;
  airport: string;
  staffedStations: string[];
}

const GROUPS: StationGroup[] = ["GND", "TWR", "APP", "CTR"];

export default function AdminEventForm({ open, onOpenChange, event, onSuccess }: Props) {
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    description: "",
    bannerUrl: "",
    startTime: "",
    endTime: "",
    airport: "",
    staffedStations: [],
  });

  const resetForm = useCallback(() => {
    if (event) {
      const start = new Date(event.startTime);
      const end = new Date(event.endTime);
      setFormData({
        name: event.name || "",
        description: event.description || "",
        bannerUrl: event.bannerUrl || "",
        startTime: start.toISOString().slice(0, 16),
        endTime: end.toISOString().slice(0, 16),
        airport: event.airports?.toString() || "",
        staffedStations: event.staffedStations || [],
      });
    } else {
      setFormData({
        name: "",
        description: "",
        bannerUrl: "",
        startTime: "",
        endTime: "",
        airport: "",
        staffedStations: [],
      });
    }
    setError("");
    setIsSaving(false);
  }, [event]);

  useEffect(() => {
    if (open) {
      resetForm();
    }
  }, [open, resetForm]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const toggleStation = useCallback((callsign: string) => {
    setFormData((prev) => {
      const isSelected = prev.staffedStations.includes(callsign);
      return {
        ...prev,
        staffedStations: isSelected
          ? prev.staffedStations.filter((s) => s !== callsign)
          : [...prev.staffedStations, callsign],
      };
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formValidation()) return;
    
    setIsSaving(true);
    setError("");

    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        bannerUrl: formData.bannerUrl.trim(),
        startTime: formData.startTime,
        endTime: formData.endTime,
        airports: [formData.airport.trim().toUpperCase()],
        staffedStations: formData.staffedStations,
      };

      const method = event ? "PUT" : "POST";
      const url = event ? `/api/events/${event.id}` : "/api/events";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP error! status: ${res.status}`);
      }

      onSuccess();
      onOpenChange(false);
    } catch (err) {
      setError(`Fehler beim ${event ? "Speichern" : "Erstellen"} des Events! ${err instanceof Error ? err.message : "Unbekannter Fehler"}`);
      console.error("Error saving event:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const formValidation = (): boolean => {
    if (!formData.name.trim()) {
      setError("Event Name ist erforderlich");
      return false;
    }
    
    if (!formData.airport.trim() || formData.airport.trim().length !== 4) {
      setError("Bitte geben Sie einen gültigen ICAO-Code (4 Zeichen) ein");
      return false;
    }

    const startTime = new Date(formData.startTime);
    const endTime = new Date(formData.endTime);
    
    if (startTime >= endTime) {
      setError("Endzeit muss nach der Startzeit liegen");
      return false;
    }

    return true;
  };

  const filteredStations = GROUPS.map((group) => ({
    group,
    stations: stationsConfig.filter(
      (s) => s.group === group && (!s.airport || s.airport === formData.airport.toUpperCase())
    ),
  })).filter(({ stations }) => stations.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[calc(100vh-4rem)] overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            {event ? "Event bearbeiten" : "Neues Event erstellen"}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircleIcon className="h-4 w-4" />
              <AlertTitle>Fehler</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <div className={`space-y-4 overflow-y-auto pr-2 ${error ? "max-h-[calc(100vh-17rem)]" : "max-h-[calc(100vh-14rem)]"}`}>
            <div className="space-y-1">
              <Label htmlFor="name">Event Name *</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="z. B. Munich Overload"
                required
                disabled={isSaving}
              />
            </div>
            
            <div className="space-y-1">
              <Label htmlFor="description">Beschreibung *</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Kurze Eventbeschreibung"
                required
                disabled={isSaving}
                rows={3}
              />
            </div>
            
            <div className="space-y-1">
              <Label htmlFor="bannerUrl">Banner URL *</Label>
              <Input
                id="bannerUrl"
                name="bannerUrl"
                type="url"
                value={formData.bannerUrl}
                onChange={handleChange}
                placeholder="https://..."
                required
                disabled={isSaving}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="startTime">Startzeit (UTC) *</Label>
                <Input
                  id="startTime"
                  type="datetime-local"
                  name="startTime"
                  value={formData.startTime}
                  onChange={handleChange}
                  required
                  disabled={isSaving}
                />
              </div>
              
              <div className="space-y-1">
                <Label htmlFor="endTime">Endzeit (UTC) *</Label>
                <Input
                  id="endTime"
                  type="datetime-local"
                  name="endTime"
                  value={formData.endTime}
                  onChange={handleChange}
                  required
                  disabled={isSaving}
                />
              </div>
            </div>
            
            <div className="space-y-1">
              <Label htmlFor="airport">Airport (ICAO) *</Label>
              <Input
                id="airport"
                name="airport"
                value={formData.airport}
                onChange={handleChange}
                placeholder="z. B. EDDM"
                required
                disabled={isSaving}
                className="uppercase"
                maxLength={4}
              />
            </div>

            {formData.airport && (
              <div className="space-y-2">
                <Label>Stationen</Label>
                <Accordion type="multiple" className="w-full">
                  {filteredStations.map(({ group, stations }) => (
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
                                disabled={isSaving}
                              />
                              <Label htmlFor={station.callsign} className="cursor-pointer">
                                {station.callsign}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            )}
          </div>
          
          <div className="flex justify-end gap-2 pt-4 mt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {event ? "Speichern" : "Erstellen"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}