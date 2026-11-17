"use client";

import type * as React from "react";
import { useState } from "react";
import { Event } from "@/types";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RequiresRight } from "@/components/RequiresRight";
import { useEventCapabilities } from "@/hooks/useEventCapabilities";
import { ImageIcon, X } from "lucide-react";

interface BannerUrlDialogProps {
  event: Event;
  onUpdate: (updatedEvent: Event) => void;
  children?: React.ReactNode;
}

export function BannerUrlDialog({ event, onUpdate, children }: BannerUrlDialogProps) {
  const { capabilities } = useEventCapabilities(event.id);
  const [open, setOpen] = useState(false);
  const [bannerUrl, setBannerUrl] = useState(event.bannerUrl || "");
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!bannerUrl.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ bannerUrl: bannerUrl.trim() }),
      });

      if (!res.ok) throw new Error("Fehler beim Aktualisieren");

      const updatedEvent = await res.json();
      onUpdate(updatedEvent);
      toast.success("Banner-URL aktualisiert");
      setOpen(false);
    } catch (error) {
      console.error("Fehler:", error);
      toast.error("Fehler beim Aktualisieren der Banner-URL");
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ bannerUrl: null }),
      });

      if (!res.ok) throw new Error("Fehler beim Entfernen");

      const updatedEvent = await res.json();
      onUpdate(updatedEvent);
      setBannerUrl("");
      toast.success("Banner entfernt");
      setOpen(false);
    } catch (error) {
      console.error("Fehler:", error);
      toast.error("Fehler beim Entfernen des Banners");
    } finally {
      setLoading(false);
    }
  };


  // Ohne Recht bleibt der Knopf sichtbar, ist aber gesperrt und sagt warum
  const allowed = capabilities.banner;
  const trigger = (children as React.ReactElement<{ disabled?: boolean }> | undefined) || (
          <Button variant="outline" size="sm">
            <ImageIcon className="h-4 w-4 mr-2" />
            {event.bannerUrl ? "Banner bearbeiten" : "Banner hinzufügen"}
          </Button>
        );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {allowed ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : (
        <RequiresRight allowed={false} capability="banner">{trigger}</RequiresRight>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Banner-URL bearbeiten</DialogTitle>
          <DialogDescription>
            Füge eine Bild-URL hinzu, die als Banner für dieses Event verwendet wird.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bannerUrl">Bild-URL</Label>
            <Input
              id="bannerUrl"
              placeholder="https://example.com/banner.jpg"
              value={bannerUrl}
              onChange={(e) => setBannerUrl(e.target.value)}
            />
          </div>

          {bannerUrl && (
            <div className="space-y-2">
              <Label>Vorschau</Label>
              <div className="border rounded-md overflow-hidden h-32">
                {/* eslint-disable-next-line @next/next/no-img-element -- Banner von beliebigen URLs */}
                <img
                  src={bannerUrl}
                  alt="Banner Vorschau"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between">
          <div>
            {event.bannerUrl && (
              <Button 
                variant="outline" 
                onClick={handleRemove}
                disabled={loading}
                type="button"
              >
                <X className="h-4 w-4 mr-2" />
                Entfernen
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setOpen(false)}
              disabled={loading}
              type="button"
            >
              Abbrechen
            </Button>
            <Button 
              onClick={handleSave}
              disabled={loading || !bannerUrl.trim()}
              type="button"
            >
              {loading ? "Wird gespeichert..." : "Speichern"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}