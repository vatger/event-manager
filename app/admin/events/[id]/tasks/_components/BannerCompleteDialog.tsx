"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Image } from "lucide-react";

interface BannerCompleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (bannerUrl: string) => void;
}

export function BannerCompleteDialog({ open, onOpenChange, onComplete }: BannerCompleteDialogProps) {
  const [bannerUrl, setBannerUrl] = useState("");
  const [previewError, setPreviewError] = useState(false);

  const handleComplete = () => {
    onComplete(bannerUrl.trim());
    setBannerUrl("");
    setPreviewError(false);
  };

  const handleSkipUrl = () => {
    onComplete("");
    setBannerUrl("");
    setPreviewError(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Image className="h-5 w-5" />
            Banner als erledigt markieren
          </DialogTitle>
          <DialogDescription>
            Gib die Banner-URL an, um sie im Event zu hinterlegen. Der Banner wird erst nach dem Clearing öffentlich sichtbar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="banner-url">Banner URL</Label>
            <Input
              id="banner-url"
              value={bannerUrl}
              onChange={(e) => { setBannerUrl(e.target.value); setPreviewError(false); }}
              placeholder="https://example.com/banner.jpg"
              type="url"
            />
          </div>

          {bannerUrl.trim() && (
            <div className="rounded-lg border overflow-hidden">
              {!previewError ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={bannerUrl.trim()}
                  alt="Banner Vorschau"
                  className="w-full h-32 object-cover"
                  onError={() => setPreviewError(true)}
                />
              ) : (
                <div className="h-32 flex items-center justify-center bg-muted text-muted-foreground text-sm">
                  Vorschau nicht verfügbar
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="ghost" onClick={handleSkipUrl} className="sm:mr-auto">
            Ohne URL abschließen
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleComplete}>
            Erledigt markieren
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
