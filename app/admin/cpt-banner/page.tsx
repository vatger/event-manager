"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Image as ImageIcon, Link, Loader2, Check, Copy } from "lucide-react";
import { useUser } from "@/hooks/useUser";

type TemplateType = "TWR" | "APP" | "CTR";

interface BannerData {
  template: TemplateType;
  name: string;
  date: string;
  startTime: string;
}

export default function CPTBannerGenerator() {
  const { user } = useUser();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bannerData, setBannerData] = useState<BannerData>({
    template: "APP",
    name: "",
    date: "",
    startTime: "",
  });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

      // Set up text rendering - NO SHADOWS
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      
      // Controller name - positioned at 428, 692
      if (bannerData.name) {
        ctx.fillStyle = "#FFFFFF";  // White color
        ctx.textAlign = "left";
        ctx.font = "bold 62px Arial";
        ctx.fillText(`feat. ${bannerData.name}`, 428, 692);
      }

      // Date and Time info with weekday in top right
      if (bannerData.date || bannerData.startTime) {
        if(bannerData.template === "TWR") {
          ctx.fillStyle = "#f8b27e";  // Red-gray color
        } else if (bannerData.template === "APP") {
          ctx.fillStyle = "#6d8db8";
        } else {
          ctx.fillStyle = "#FFFFFF";
        }
        ctx.font = "50px MontserratBold";
        
        // Weekday at position 1438, 47
        if (bannerData.date) {
          const dateObj = new Date(bannerData.date);
          const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wensday', 'Thursday', 'Friday', 'Saturday'];
          const weekday = weekdays[dateObj.getDay()];
          
          ctx.textAlign = "left";
          ctx.fillText(weekday, 1480, 47);
        }
        
        // Date starting at position 1437, 105
        if (bannerData.date) {
          const dateObj = new Date(bannerData.date);
          const day = String(dateObj.getDate()).padStart(2, '0');
          const month = String(dateObj.getMonth() + 1).padStart(2, '0');
          const year = dateObj.getFullYear();
          
          let dateTimeText = `${day}.${month}.${year}`;
          
          // Add time with vertical bar separator
          if (bannerData.startTime) {
            dateTimeText += `|${bannerData.startTime.replace(':', '')}z`;
          }
          
          ctx.textAlign = "left";
          ctx.fillText(dateTimeText, 1480, 105);
        }
      }
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

  const handleGetLink = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsUploading(true);
    setUploadError(null);
    setUploadedUrl(null);
    setCopied(false);

    try {
      // Convert canvas to base64
      const imageData = canvas.toDataURL('image/png');
      
      // Generate filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `CPT-Banner-${bannerData.template}-${bannerData.name.replace(/\s+/g, '_') || "default"}-${timestamp}.png`;

      // Upload to NextCloud via API
      const response = await fetch('/api/cpt-banner/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageData,
          fileName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Upload failed');
      }

      // Set the uploaded URL
      const linkUrl = data.shareUrl || data.directLink;
      setUploadedUrl(linkUrl);

    } catch (error) {
      console.error('Error uploading banner:', error);
      setUploadError(error instanceof Error ? error.message : 'Failed to upload banner');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCopyLink = () => {
    if (uploadedUrl) {
      navigator.clipboard.writeText(uploadedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
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
          Erstelle personalisierte Banner für CPTs
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

            {/* Get Link Button */}
            <Button
              className="w-full"
              size="lg"
              variant="outline"
              onClick={handleGetLink}
              disabled={!bannerData.name || isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wird hochgeladen...
                </>
              ) : (
                <>
                  <Link className="mr-2 h-4 w-4" />
                  Link generieren
                </>
              )}
            </Button>

            {/* Link Display */}
            {uploadedUrl && (
              <div className="space-y-2 p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-green-800 dark:text-green-200">
                  <Check className="h-4 w-4" />
                  <span className="font-medium">Banner erfolgreich hochgeladen!</span>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    value={uploadedUrl}
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
                  Dieser Link kann direkt in Foren oder auf Webseiten eingebettet werden.
                </p>
              </div>
            )}

            {/* Error Display */}
            {uploadError && (
              <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-800 dark:text-red-200">
                  <strong>Fehler:</strong> {uploadError}
                </p>
                <p className="text-xs text-red-700 dark:text-red-300 mt-2">
                  Stellen Sie sicher, dass die NextCloud-Konfiguration in den Umgebungsvariablen korrekt eingerichtet ist.
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
