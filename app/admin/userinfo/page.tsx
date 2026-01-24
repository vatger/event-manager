'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ArrowLeft, User, MapPin, Clock, Building, AlertCircle, CheckCircle2, Search } from 'lucide-react';
import Link from 'next/link';
import { getBadgeClassForEndorsement } from '@/utils/EndorsementBadge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface UserQualifications {
  cid: number;
  rating: string | null;
  endorsements: Record<string, string[]>;
  solos: Record<string, { position: string; expiry: Date }[]>;
  familiarizations: Record<string, string[]>;
}

export default function UserInfoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlCid = searchParams.get('cid');
  
  const [cid, setCid] = useState(urlCid || '');
  const [data, setData] = useState<UserQualifications | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lade Daten wenn CID in URL-Param vorhanden
  useEffect(() => {
    if (urlCid) {
      setCid(urlCid);
      loadUserData(urlCid);
    }
  }, [urlCid]);

  const loadUserData = async (cidToLoad: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/endorsements/${cidToLoad}`);
      
      if (!response.ok) {
        throw new Error('Benutzerdaten konnten nicht geladen werden');
      }
      
      const userData = await response.json();
      setData(userData);
    } catch (err) {
      console.error('Failed to load user data:', err);
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cid.trim()) return;
    
    // Update URL mit Query-Parameter
    router.push(`/admin/userinfo?cid=${cid.trim()}`);
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const isExpired = (expiry: Date) => {
    return new Date(expiry) < new Date();
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 justify-between">
        <div>
          <h1 className="text-3xl font-bold">Controller information</h1>
          <p className="text-muted-foreground">Endorsements, Solos...</p>
        </div>
        {data?.rating && (
            <Badge className={`${getBadgeClassForEndorsement(data.rating)} text-lg px-3 py-1`}>
            Rating: {data.rating}
            </Badge>
        )}
      </div>

      {/* CID Suchfeld */}
      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              placeholder="CID eingeben (z.B. 1234567)"
              value={cid}
              onChange={(e) => setCid(e.target.value)}
              type="number"
            />
            <Button type="submit" disabled={loading || !cid.trim()}>
              <Search className="w-4 h-4 mr-2" />
              Anzeigen
            </Button>
          </form>
        </CardContent>
      </Card>

      {loading && (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      )}

      {error && !loading && (
        <div className="text-center py-8">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Fehler beim Laden</h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => loadUserData(cid)} variant="outline">
            Erneut versuchen
          </Button>
        </div>
      )}

      {data && !loading && (
        <div className="space-y-6">

          {/* Endorsements */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Endorsements
                <Badge variant="secondary">
                  {Object.values(data.endorsements).flat().length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(data.endorsements).length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Keine Endorsements vorhanden
                </p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(data.endorsements).map(([airport, positions]) => (
                    <Card key={airport} className="bg-muted/50">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <Building className="w-4 h-4" />
                            {airport}
                          </span>
                          <Badge variant="outline">{positions.length}</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-1">
                          {positions.map((position) => {
                            const positionName = position.split('_').pop();
                            return (
                              <Tooltip key={position}>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center justify-between p-2 rounded bg-background text-sm">
                                    <span>{positionName}</span>
                                    <Badge variant="secondary" className="text-xs">
                                      {position.split('_')[0]}
                                    </Badge>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{position}</p>
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Solo Validierungen */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Solo Validierungen
                <Badge variant="secondary">
                  {Object.values(data.solos).flat().length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(data.solos).length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Keine Solo Validierungen vorhanden
                </p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {Object.entries(data.solos).map(([airport, solos]) => (
                    <Card key={airport} className="bg-muted/50">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <Building className="w-4 h-4" />
                            {airport}
                          </span>
                          <Badge variant="outline">{solos.length}</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-2">
                          {solos.map((solo) => {
                            const expired = isExpired(solo.expiry);
                            return (
                              <div
                                key={solo.position}
                                className={`p-2 rounded border text-sm ${
                                  expired 
                                    ? 'border-destructive/20 bg-destructive/5' 
                                    : 'border-green-200 bg-green-50'
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-medium">{solo.position}</span>
                                  <Badge 
                                    variant={expired ? "destructive" : "default"}
                                    className="text-xs"
                                  >
                                    {expired ? 'Abgelaufen' : 'Aktiv'}
                                  </Badge>
                                </div>
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                  <span>Gültig bis:</span>
                                  <span className={expired ? 'text-destructive font-medium' : ''}>
                                    {formatDate(solo.expiry)}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* CTR Familiarizations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                CTR Familiarizations
                <Badge variant="secondary">
                  {Object.values(data.familiarizations).flat().length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(data.familiarizations).length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Keine CTR Familiarizations vorhanden
                </p>
              ) : (
                <div className="space-y-4">
                  {Object.entries(data.familiarizations).map(([fir, sectors]) => (
                    <Card key={fir}>
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            {fir} FIR
                          </span>
                          <Badge variant="outline">{sectors.length} Sektoren</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                          {sectors.map((sector) => (
                            <div
                              key={sector}
                              className="flex items-center p-2 rounded bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-900 text-sm"
                            >
                              <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-200 mr-2" />
                              <span>{sector}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {!data && !loading && !error && urlCid && (
        <Card>
          <CardContent className="text-center py-8">
            <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">User nicht gefunden</h3>
            <p className="text-muted-foreground">
              Für CID {urlCid} wurden keine Daten gefunden
            </p>
          </CardContent>
        </Card>
      )}

      {!data && !loading && !error && !urlCid && (
        <Card>
          <CardContent className="text-center py-8">
            <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">CID eingeben</h3>
            <p className="text-muted-foreground">
              Geben Sie eine CID ein, um die User-Informationen anzuzeigen
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}