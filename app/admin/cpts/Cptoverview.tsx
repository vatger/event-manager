"use client";

import React, { useEffect, useState } from 'react';
import { Calendar, CheckCircle2, Clock, User, MapPin, AlertCircle, Bell, BellOff, RefreshCw, ImageIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getFIRConfig } from '@/config/firStations';
import { useUser } from '@/hooks/useUser';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface CPTData {
  id: number;
  trainee_vatsim_id: number;
  trainee_name: string;
  examiner_vatsim_id: number;
  examiner_name: string;
  local_vatsim_id: number;
  local_name: string;
  course_name: string;
  position: string;
  date: string;
  confirmed: boolean;
}

const CPTOverview: React.FC = () => {
  const [cptData, setCptData] = useState<CPTData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, isVATGERLead } = useUser();
  const [fir, setfir] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (user?.fir?.code && fir === undefined) {
      setfir(user.fir.code);
    }
  }, [user?.fir?.code]);

  useEffect(() => {
    if (fir || isVATGERLead()) {
      fetchCPTData();
    }
  }, [fir]);

  const fetchCPTData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/cpt`);

      if (!response.ok) {
        throw new Error('Fehler beim Laden der CPT-Daten');
      }

      const result = await response.json();
      let filteredData = result.data || [];

      // Filter by FIR if specified
      if (fir) {
        // Hole die FIR-Konfiguration
        const firConfig = getFIRConfig(fir); // z.B. CONFIG['EDMM']
        
        if (firConfig && firConfig.stations) {
          // Extrahiere alle Callsigns aus den Stations
          const validCallsigns = firConfig.stations.map(station => station.callsign);
        
          // Filtere nach Callsigns
          filteredData = filteredData.filter((cpt: CPTData) => 
            validCallsigns.includes(cpt.position) || // Exakte Übereinstimmung mit Config
            cpt.position.startsWith(fir + '_') // Beginnt mit FIR-Code (z.B. EDMM_WLD_CTR, EDGG_CH_CTR)
          );
        }
      }

      // Sort by date (upcoming first)
      filteredData.sort((a: CPTData, b: CPTData) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      setCptData(filteredData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten');
    } finally {
      setLoading(false);
    }
  };

  

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('de-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    }).format(date);
  };

  // Hilfsfunktion um das Template zu bestimmen
  const getBannerTemplate = (position: string): string | null => {
    if (position === 'EDDM_TWR') return 'EDDMTWR';
    if (position === 'EDDM_APP') return 'APP';
    if (position === 'EDDN_TWR') return 'EDDNTWR';
    if (position.match(/^EDMM_[A-Z]+_CTR$/)) return 'CTR';
    return null;
  };

  const formatDateShort = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  };
  
  // Hilfsfunktion um Zeit zu formatieren (HH:MM)
  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toTimeString().slice(0, 5); // "HH:MM"
  };
  
  // Banner-URL generieren
  const generateBannerUrl = (cpt: CPTData): string => {
    const template = getBannerTemplate(cpt.position);
    if (!template) return '';
    
    const params = new URLSearchParams({
      template: template,
      name: cpt.trainee_name,
      date: formatDateShort(cpt.date),
      time: formatTime(cpt.date),
    });
    
    return `/api/cpt-banner/generate/?${params.toString()}`;
  };

  const isUpcoming = (dateString: string) => {
    return new Date(dateString) > new Date();
  };

  const getTimeUntil = (dateString: string) => {
    const now = new Date();
    const cptDate = new Date(dateString);
    const diffMs = cptDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'Vergangen';
    if (diffDays === 0) return 'Heute';
    if (diffDays === 1) return 'Morgen';
    return `In ${diffDays} Tagen`;
  };

  const getStationName = (position: string) => {
    // Extract FIR code (first 4 characters)
    if (position.length < 4) return position;
    
    const fir = position.substring(0, 4);
    const firConfig = getFIRConfig(fir);
    if (!firConfig) return position;
    
    // Find matching station by checking if position starts with the station's base callsign
    const station = firConfig.stations.find(s => {
      const baseCallsign = s.callsign.replace(/_/g, '');
      return position.startsWith(baseCallsign);
    });
    
    return station ? station.name : position;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const upcomingCPTs = cptData.filter(cpt => isUpcoming(cpt.date));
  const pastCPTs = cptData.filter(cpt => !isUpcoming(cpt.date));

  const confirmedCount = upcomingCPTs.filter(cpt => cpt.confirmed).length;
  const pendingCount = upcomingCPTs.filter(cpt => !cpt.confirmed).length;

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            {fir ? getFIRConfig(fir)?.fullName : 'Alle FIRs'}
          </h2>
          <p className="text-muted-foreground mt-1">
            Anstehende Controller Practical Tests
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchCPTData}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Aktualisieren
          </Button>
          {/* FIR Switcher */}
          {isVATGERLead() && (
            <Select
              defaultValue={fir}
              onValueChange={(value) => {
                setfir(value);
              }}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder="FIR auswählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EDMM">EDMM</SelectItem>
                <SelectItem value="EDGG">EDGG</SelectItem>
                <SelectItem value="EDWW">EDWW</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Anstehende CPTs</CardDescription>
            <CardTitle className="text-3xl">{upcomingCPTs.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Bestätigt</CardDescription>
            <CardTitle className="text-3xl text-green-600">{confirmedCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Ausstehend</CardDescription>
            <CardTitle className="text-3xl text-amber-600">{pendingCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Empty State */}
      {upcomingCPTs.length === 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Aktuell sind keine anstehenden CPTs geplant.
          </AlertDescription>
        </Alert>
      )}

      {/* CPT List */}
      <div className="space-y-4">
        {upcomingCPTs.map((cpt) => (
          <Card 
            key={cpt.id} 
            className={`relative transition-all hover:shadow-md ${
              cpt.confirmed 
                ? 'border-l-4 border-l-green-500' 
                : 'border-l-4 border-l-amber-500'
            }`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-xl">
                      {cpt.trainee_name} - {cpt.course_name}
                    </CardTitle>
                    {cpt.confirmed && (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    )}
                  </div>
                  <CardDescription className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4" />
                    <span className="font-medium">{cpt.position.split("_")[0]}</span>
                    <span className="text-muted-foreground">•</span>
                    <span>{getStationName(cpt.position)}</span>
                  </CardDescription>
                </div>
                <div className="text-right space-y-1">
                  <Badge 
                    variant={cpt.confirmed ? "default" : "secondary"}
                    className={cpt.confirmed ? "bg-green-600 hover:bg-green-700" : "bg-amber-600 hover:bg-amber-700"}
                  >
                    {cpt.confirmed ? 'Bestätigt' : 'Ausstehend'}
                  </Badge>
                  <p className="text-xs text-muted-foreground font-medium">
                    {getTimeUntil(cpt.date)}
                  </p>
                  {getBannerTemplate(cpt.position) && (
                    <Button asChild className="absolute bottom-5 right-6">
                      <a 
                        href={generateBannerUrl(cpt)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ImageIcon className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left Column */}
                <div className="space-y-2">
                  <div className="flex items-start gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">{formatDate(cpt.date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div>
                      <span className="text-muted-foreground">Trainee:</span>
                      <span className="font-medium ml-1">{cpt.trainee_name}</span>
                      <span className="text-xs text-muted-foreground ml-1">({cpt.trainee_vatsim_id})</span>
                    </div>
                  </div>
                </div>
                
                {/* Right Column */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div>
                      <span className="text-muted-foreground">ATD:</span>
                      <span className="font-medium ml-1">{cpt.examiner_name}</span>
                      <span className="text-xs text-muted-foreground ml-1">({cpt.examiner_vatsim_id})</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div>
                      <span className="text-muted-foreground">Mentor:</span>
                      <span className="font-medium ml-1">{cpt.local_name}</span>
                      <span className="text-xs text-muted-foreground ml-1">({cpt.local_vatsim_id})</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default CPTOverview;
