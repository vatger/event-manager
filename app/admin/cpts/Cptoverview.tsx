"use client";
import React, { useEffect, useState } from 'react';
import { Calendar, CheckCircle2, Clock, User, MapPin, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

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

interface CPTOverviewProps {
  trainingCPTURL: string;
  bearerToken: string;
  firCode?: string; // z.B. "EDGG", "EDWW", etc.
}

const CPTOverview: React.FC<CPTOverviewProps> = ({ 
  trainingCPTURL, 
  bearerToken,
  firCode 
}) => {
  const [cptData, setCptData] = useState<CPTData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCPTData();
  }, []);

  const fetchCPTData = async () => {
    try {
      setLoading(true);
      const response = await fetch(trainingCPTURL, {
        headers: {
          'Authorization': `Bearer ${bearerToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Fehler beim Laden der CPT-Daten');
      }

      const result = await response.json();
      let filteredData = result.data || [];

      // Filter nach FIR wenn firCode angegeben
      if (firCode) {
        filteredData = filteredData.filter((cpt: CPTData) => 
          cpt.position.startsWith(firCode)
        );
      }

      // Sortiere nach Datum (nächste zuerst)
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
    return new Intl.DateTimeFormat('de-DE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Berlin',
    }).format(date);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">CPT Übersicht</h2>
          <p className="text-muted-foreground">
            Anstehende Checkouts für Event-Marketing
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          {upcomingCPTs.length} anstehend
        </Badge>
      </div>

      {upcomingCPTs.length === 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Aktuell sind keine anstehenden CPTs geplant.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        {upcomingCPTs.map((cpt) => (
          <Card 
            key={cpt.id} 
            className={`transition-all hover:shadow-lg ${
              cpt.confirmed 
                ? 'border-green-500 border-2 bg-green-50/50 dark:bg-green-950/20' 
                : 'border-amber-500 border-2 bg-amber-50/50 dark:bg-amber-950/20'
            }`}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-xl flex items-center gap-2">
                    {cpt.course_name}
                    {cpt.confirmed && (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    )}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {cpt.position}
                  </CardDescription>
                </div>
                <div className="text-right">
                  <Badge 
                    variant={cpt.confirmed ? "default" : "secondary"}
                    className={cpt.confirmed ? "bg-green-600" : "bg-amber-600"}
                  >
                    {cpt.confirmed ? 'Bestätigt' : 'Ausstehend'}
                  </Badge>
                  <p className="text-sm text-muted-foreground mt-1">
                    {getTimeUntil(cpt.date)}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{formatDate(cpt.date)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>Trainee: {cpt.trainee_name}</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>Prüfer: {cpt.examiner_name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>Lotse: {cpt.local_name}</span>
                  </div>
                </div>
              </div>
              
              {cpt.confirmed && (
                <Alert className="mt-4 border-green-200 bg-green-50 dark:bg-green-950/30">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800 dark:text-green-200">
                    Dieses CPT ist bestätigt. Bitte Banner vorbereiten und Marketing starten!
                  </AlertDescription>
                </Alert>
              )}
              {!cpt.confirmed && (
                <Alert className="mt-4 border-amber-200 bg-amber-50 dark:bg-amber-950/30">
                  <Clock className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800 dark:text-amber-200">
                    Dieses CPT wartet noch auf Bestätigung. Banner-Vorbereitung kann beginnen.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {pastCPTs.length > 0 && (
        <div className="mt-8">
          <h3 className="text-xl font-semibold mb-4 text-muted-foreground">
            Vergangene CPTs
          </h3>
          <div className="space-y-2">
            {pastCPTs.slice(0, 3).map((cpt) => (
              <Card key={cpt.id} className="opacity-60">
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm">{cpt.course_name}</CardTitle>
                      <CardDescription className="text-xs">
                        {cpt.position} • {formatDate(cpt.date)}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      Abgeschlossen
                    </Badge>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CPTOverview;