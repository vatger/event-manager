"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Image as ImageIcon, Link as LinkIcon, Copy, Check, ShieldX, Lock } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { getTemplateConfig, getAvailableTemplates, type TemplateType } from "./templateConfig";

interface BannerData {
  template: TemplateType;
  name: string;
  date: string;
  startTime: string;
  station?: string;
}

export default function CPTBannerGenerator() {
  const { user } = useUser();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bannerData, setBannerData] = useState<BannerData>({
    template: "APP",
    name: "",
    date: "",
    startTime: "",
    station: "",
  });
  const [generatedLink, setGeneratedLink] = useState<string>("");
  const [copied, setCopied] = useState(false);

  // Check if user is from FIR München
  const isEDMM = user?.fir?.code === "EDMM" || user?.role === "MAIN_ADMIN";

  // Get template configuration
  const templateConfig = getTemplateConfig(bannerData.template);

  useEffect(() => {
    const loadFonts = async () => {
      const montBold = new FontFace(
        "MontserratBold",
        "url(/fonts/Montserrat-Bold.ttf)"
      );
      const montExtraBold = new FontFace(
        "MontserratExtraBold",
        "url(/fonts/Montserrat-ExtraBold.ttf)"
      );

      await montBold.load();
      await montExtraBold.load();

      document.fonts.add(montBold);
      document.fonts.add(montExtraBold);
    };

    loadFonts();
  }, []);

  // Generate the banner link whenever data changes
  useEffect(() => {
    if (bannerData.name && bannerData.date && bannerData.startTime) {
      // Check if station is required but missing
      if (templateConfig.requiresStation && !bannerData.station) {
        setGeneratedLink("");
        return;
      }

      const params = new URLSearchParams({
        template: bannerData.template,
        name: bannerData.name,
        date: bannerData.date,
        time: bannerData.startTime,
      });

      if (bannerData.station && templateConfig.requiresStation) {
        params.append('station', bannerData.station);
      }

      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const link = `${baseUrl}/api/cpt-banner/generate?${params.toString()}`;
      setGeneratedLink(link);
    } else {
      setGeneratedLink("");
    }
  }, [bannerData, templateConfig.requiresStation]);

  const generateBanner = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size to match template (1920x1080)
    canvas.width = 1920;
    canvas.height = 1080;

    // Try to load template image from public folder
    const templatePath = templateConfig.templatePath;
    const bgImage = new Image();
    
    bgImage.onload = () => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw template background
      ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);

      // Set up text rendering - NO SHADOWS
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      
      // Draw controller name using config
      if (bannerData.name) {
        const nameConfig = templateConfig.name;
        ctx.fillStyle = nameConfig.style.color;
        ctx.textAlign = nameConfig.position.align || "left";
        const fontWeight = nameConfig.style.bold ? "bold" : "normal";
        ctx.font = `${fontWeight} ${nameConfig.style.size}px ${nameConfig.style.font}`;
        const nameText = (nameConfig.prefix || "") + bannerData.name;
        ctx.fillText(nameText, nameConfig.position.x, nameConfig.position.y);
      }

      // Draw weekday using config
      if (bannerData.date) {
        const weekdayConfig = templateConfig.weekday;
        if(weekdayConfig.style.size > 0){
          const dateObj = new Date(bannerData.date);
          const weekdays = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
          const weekday = weekdays[dateObj.getDay()];
          
          ctx.fillStyle = weekdayConfig.style.color;
          ctx.textAlign = weekdayConfig.position.align || "left";
          const fontWeight = weekdayConfig.style.bold ? "bold" : "normal";
          ctx.font = `${fontWeight} ${weekdayConfig.style.size}px ${weekdayConfig.style.font}`;
          ctx.fillText(weekday, weekdayConfig.position.x, weekdayConfig.position.y);
        }
      }
      
      // Draw date and time using config
      if (bannerData.date || bannerData.startTime) {
        const dateConfig = templateConfig.date;
        const timeConfig = templateConfig.time;
        
        let dateTimeText = "";
        
        if (bannerData.date) {
          const dateObj = new Date(bannerData.date);
          const day = String(dateObj.getDate()).padStart(2, '0');
          const month = String(dateObj.getMonth() + 1).padStart(2, '0');
          const year = dateObj.getFullYear();
          dateTimeText = `${day}.${month}.${year}`;
        }
        
        // Add time with separator
        if (bannerData.startTime) {
          if (dateTimeText && timeConfig.separator) {
            dateTimeText += timeConfig.separator;
          }
          dateTimeText += `${bannerData.startTime.replace(':', '')}z`;
        }
        
        if (dateTimeText) {
          ctx.fillStyle = dateConfig.style.color;
          ctx.textAlign = dateConfig.position.align || "left";
          const fontWeight = dateConfig.style.bold ? "bold" : "normal";
          ctx.font = `${fontWeight} ${dateConfig.style.size}px ${dateConfig.style.font}`;
          ctx.fillText(dateTimeText, dateConfig.position.x, dateConfig.position.y);
        }
      }

      // Draw station if provided and configured
      if (bannerData.station && templateConfig.station) {
        const stationConfig = templateConfig.station;
        ctx.fillStyle = stationConfig.style.color;
        ctx.textAlign = stationConfig.position.align || "left";
        const fontWeight = stationConfig.style.bold ? "bold" : "normal";
        ctx.font = `${fontWeight} ${stationConfig.style.size}px ${stationConfig.style.font}`;
        ctx.fillText(bannerData.station, stationConfig.position.x, stationConfig.position.y);
      }
    };

    bgImage.onerror = () => {
      // Fallback: draw a gradient background if template doesn't exist
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      if (templateConfig.fallbackGradient) {
        gradient.addColorStop(0, templateConfig.fallbackGradient.start);
        gradient.addColorStop(1, templateConfig.fallbackGradient.end);
      } else {
        gradient.addColorStop(0, "#134e4a");
        gradient.addColorStop(1, "#14b8a6");
      }
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
      if (bannerData.date || bannerData.startTime) {
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
        
        if (bannerData.startTime) {
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
    if (bannerData.name || bannerData.date || bannerData.startTime) {
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
      link.download = `CPT-Banner-${bannerData.template}-${bannerData.name.replace(/\s+/g, '_') || "default"}.png`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    });
  };

  const handleCopyLink = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isEDMM) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="container mx-auto py-8 px-4">
        <Card className="max-w-2xl mx-auto">
          <CardHeader className="text-center space-y-4 pb-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <ShieldX className="h-8 w-8 text-destructive" />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-2xl">Zugriff verweigert</CardTitle>
              <CardDescription className="text-base">
                Dieser Bereich ist nur für Mitglieder der FIR München verfügbar.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="text-center pb-6">
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-4 py-2 rounded-md">
              <Lock className="h-4 w-4" />
              <span>FIR interner Bereich</span>
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">CPT Banner Generator</h1>
        <p className="text-muted-foreground">
          Erstelle personalisierte Banner für CPTs der FIR München.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form Section */}
        <Card>
          <CardHeader>
            <CardTitle>Banner-Daten</CardTitle>
            <CardDescription>
              Wähle eine Vorlage und gib die CPT-Informationen ein:
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
                  {getAvailableTemplates().map((template) => (
                    <SelectItem key={template.value} value={template.value}>
                      {template.label}
                    </SelectItem>
                  ))}
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

            {/* Station - Only show for templates that require it */}
            {templateConfig.requiresStation && (
              <div className="space-y-2">
                <Label htmlFor="station">Station</Label>
                <Input
                  id="station"
                  placeholder="z.B. EDMM_STA_CTR"
                  value={bannerData.station || ""}
                  onChange={(e) =>
                    setBannerData({ ...bannerData, station: e.target.value })
                  }
                />
              </div>
            )}

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

            {/* Start Time */}
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

            {/* Download Button */}
            <Button
              className="w-full"
              size="lg"
              onClick={handleDownload}
              disabled={!bannerData.name}
            >
              <Download className="mr-2 h-4 w-4" />
              Banner herunterladen
            </Button>

            {/* Generated Link Display */}
            {generatedLink && (
              <div className="space-y-2 p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-green-800 dark:text-green-200 mb-2">
                  <LinkIcon className="h-4 w-4" />
                  <span className="font-medium">Direkt-Link zum Banner:</span>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    value={generatedLink}
                    readOnly
                    className="flex-1 font-mono text-xs"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopyLink}
                  >
                    {copied ? (
                      <>
                        <Check className="h-3 w-3 mr-1" />
                        Kopiert
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3 mr-1" />
                        Kopieren
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-green-700 dark:text-green-300">
                  Dieser Link generiert das Banner dynamisch und kann z.B. direkt im Forum eingebunden werden.
                </p>
              </div>
            )}
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
              {!bannerData.name ? (
                <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
                  <ImageIcon className="h-16 w-16 mb-4" />
                  <p>Füge Daten hinzu, um eine Vorschau zu sehen</p>
                </div>
              ) : (
                <canvas
                  ref={canvasRef}
                  className="w-full h-auto"
                  style={{ maxHeight: "600px" }}
                />
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
