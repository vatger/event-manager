"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Image as ImageIcon } from "lucide-react";
import { useUser } from "@/hooks/useUser";

type TemplateType = "TWR" | "APP" | "CTR";

interface BannerData {
  template: TemplateType;
  name: string;
  station: string;
  date: string;
  startTime: string;
  endTime: string;
}

export default function CPTBannerGenerator() {
  const { user } = useUser();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bannerData, setBannerData] = useState<BannerData>({
    template: "TWR",
    name: "",
    station: "",
    date: "",
    startTime: "",
    endTime: "",
  });

  // Check if user is from FIR München
  const isEDMM = user?.fir?.code === "EDMM" || user?.role === "MAIN_ADMIN";

  const generateBanner = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size to match template (1920x1080)
    canvas.width = 1920;
    canvas.height = 1080;

    // Try to load template image from public folder
    const templatePath = `/banner/cpt-template/EDDM/${bannerData.template}/EmptyTemplateV1.png`;
    const bgImage = new Image();
    
    bgImage.onload = () => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw template background
      ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);

      // Draw text content with shadow for better readability
      ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
      ctx.shadowBlur = 15;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 3;
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "left";
      
      // Controller name - positioned below "CONTROLLER PRACTICAL TEST"
      if (bannerData.name) {
        ctx.font = "bold 72px sans-serif";
        ctx.fillText(`feat ${bannerData.name}`, 225, 530);
      }

      // Reset shadow for next elements
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;

      // Station and Date/Time info - position in lower area
      let yPos = 850;
      
      if (bannerData.station || bannerData.date || bannerData.startTime || bannerData.endTime) {
        // Station
        if (bannerData.station) {
          ctx.font = "bold 48px sans-serif";
          ctx.fillText(bannerData.station, 225, yPos);
          yPos += 60;
        }

        // Date and Time
        if (bannerData.date || bannerData.startTime || bannerData.endTime) {
          ctx.font = "42px sans-serif";
          let dateTimeText = "";
          
          if (bannerData.date) {
            // Format date to DD.MM.YYYY
            const dateObj = new Date(bannerData.date);
            const day = String(dateObj.getDate()).padStart(2, '0');
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const year = dateObj.getFullYear();
            dateTimeText = `${day}.${month}.${year}`;
          }
          
          if (bannerData.startTime && bannerData.endTime) {
            if (dateTimeText) dateTimeText += " • ";
            dateTimeText += `${bannerData.startTime} - ${bannerData.endTime}Z`;
          } else if (bannerData.startTime) {
            if (dateTimeText) dateTimeText += " • ";
            dateTimeText += `${bannerData.startTime}Z`;
          }
          
          if (dateTimeText) {
            ctx.fillText(dateTimeText, 225, yPos);
          }
        }
      }

      // Reset shadow
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    };

    bgImage.onerror = () => {
      // Fallback: draw a gradient background if template doesn't exist
      const colors = {
        TWR: { bg: "#1e3a8a", accent: "#3b82f6" },
        APP: { bg: "#134e4a", accent: "#14b8a6" },
        CTR: { bg: "#7c2d12", accent: "#f97316" },
      };

      const color = colors[bannerData.template];

      // Draw gradient background
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, color.bg);
      gradient.addColorStop(1, color.accent);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Add pattern overlay
      ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
      for (let i = 0; i < canvas.width; i += 60) {
        for (let j = 0; j < canvas.height; j += 60) {
          ctx.fillRect(i, j, 30, 30);
        }
      }

      // Template label at top
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.font = "bold 42px sans-serif";
      ctx.fillText(bannerData.template, 100, 100);

      // Draw border
      ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
      ctx.lineWidth = 6;
      ctx.strokeRect(30, 30, canvas.width - 60, canvas.height - 60);

      // Main content area
      ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
      ctx.fillRect(100, 200, canvas.width - 200, canvas.height - 400);

      // Draw text content with shadow for better readability
      ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
      ctx.shadowBlur = 15;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 3;
      ctx.fillStyle = "#FFFFFF";
      
      // CPT Title
      ctx.font = "bold 84px sans-serif";
      ctx.fillText("CPT Training", 120, 350);

      // Name
      if (bannerData.name) {
        ctx.font = "bold 64px sans-serif";
        ctx.fillText(bannerData.name, 120, 470);
      }

      // Station
      if (bannerData.station) {
        ctx.font = "56px sans-serif";
        ctx.fillText(`Station: ${bannerData.station}`, 120, 580);
      }

      // Date and Time
      if (bannerData.date || bannerData.startTime || bannerData.endTime) {
        ctx.font = "48px sans-serif";
        let dateTimeText = "";
        
        if (bannerData.date) {
          // Format date to DD.MM.YYYY
          const dateObj = new Date(bannerData.date);
          const day = String(dateObj.getDate()).padStart(2, '0');
          const month = String(dateObj.getMonth() + 1).padStart(2, '0');
          const year = dateObj.getFullYear();
          dateTimeText = `${day}.${month}.${year}`;
        }
        
        if (bannerData.startTime && bannerData.endTime) {
          dateTimeText += ` • ${bannerData.startTime} - ${bannerData.endTime}Z`;
        } else if (bannerData.startTime) {
          dateTimeText += ` • ${bannerData.startTime}Z`;
        }
        
        if (dateTimeText) {
          ctx.fillText(dateTimeText, 120, 690);
        }
      }

      // VATGER Logo area (placeholder text)
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.font = "bold 42px sans-serif";
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.textAlign = "right";
      ctx.fillText("VATGER", canvas.width - 100, canvas.height - 80);
      ctx.textAlign = "left"; // Reset alignment
    };

    // Start loading the image
    bgImage.src = templatePath;
  };

  useEffect(() => {
    if (bannerData.name || bannerData.station || bannerData.date || bannerData.startTime || bannerData.endTime) {
      generateBanner();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bannerData]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (!blob) return;
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `CPT-Banner-${bannerData.template}-${bannerData.station || "default"}.png`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    });
  };

  if (!isEDMM) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardHeader>
            <CardTitle>Zugriff verweigert</CardTitle>
            <CardDescription>
              Dieser Bereich ist nur für Mitglieder der FIR München verfügbar.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">CPT Banner Generator</h1>
        <p className="text-muted-foreground">
          Erstelle personalisierte Banner für CPT-Trainings
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form Section */}
        <Card>
          <CardHeader>
            <CardTitle>Banner-Daten</CardTitle>
            <CardDescription>
              Wähle eine Vorlage und gib die CPT-Informationen ein
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Template Selection */}
            <div className="space-y-2">
              <Label htmlFor="template">Vorlage</Label>
              <Select
                value={bannerData.template}
                onValueChange={(value) =>
                  setBannerData({ ...bannerData, template: value as TemplateType })
                }
              >
                <SelectTrigger id="template">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TWR">Tower (TWR)</SelectItem>
                  <SelectItem value="APP">Approach (APP)</SelectItem>
                  <SelectItem value="CTR">Center (CTR)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Name des Controllers</Label>
              <Input
                id="name"
                placeholder="z.B. Max Mustermann"
                value={bannerData.name}
                onChange={(e) =>
                  setBannerData({ ...bannerData, name: e.target.value })
                }
              />
            </div>

            {/* Station */}
            <div className="space-y-2">
              <Label htmlFor="station">Station</Label>
              <Input
                id="station"
                placeholder="z.B. EDDM_TWR"
                value={bannerData.station}
                onChange={(e) =>
                  setBannerData({ ...bannerData, station: e.target.value })
                }
              />
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="date">Datum</Label>
              <Input
                id="date"
                type="date"
                value={bannerData.date}
                onChange={(e) =>
                  setBannerData({ ...bannerData, date: e.target.value })
                }
              />
            </div>

            {/* Time Range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">Start Zeit (UTC)</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={bannerData.startTime}
                  onChange={(e) =>
                    setBannerData({ ...bannerData, startTime: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">End Zeit (UTC)</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={bannerData.endTime}
                  onChange={(e) =>
                    setBannerData({ ...bannerData, endTime: e.target.value })
                  }
                />
              </div>
            </div>

            {/* Download Button */}
            <Button
              className="w-full"
              size="lg"
              onClick={handleDownload}
              disabled={!bannerData.name && !bannerData.station}
            >
              <Download className="mr-2 h-4 w-4" />
              Banner herunterladen
            </Button>
          </CardContent>
        </Card>

        {/* Preview Section */}
        <Card>
          <CardHeader>
            <CardTitle>Vorschau</CardTitle>
            <CardDescription>
              Live-Vorschau des generierten Banners
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative rounded-lg overflow-hidden border bg-muted/50">
              {(!bannerData.name && !bannerData.station) ? (
                <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
                  <ImageIcon className="h-16 w-16 mb-4" />
                  <p>Füge Daten hinzu, um eine Vorschau zu sehen</p>
                </div>
              ) : (
                <canvas
                  ref={canvasRef}
                  className="w-full h-auto"
                  style={{ maxWidth: "100%" }}
                />
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
