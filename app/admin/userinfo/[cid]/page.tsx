'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
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

export default function UserQualificationsPage() {
  const params = useParams();
  const router = useRouter();
  const [currentCid, setCurrentCid] = useState(params.cid as string || '');
  const [searchCid, setSearchCid] = useState('');
  const [data, setData] = useState<UserQualifications | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lade Daten wenn CID in Params vorhanden
  useEffect(() => {
    if (params.cid) {
      setCurrentCid(params.cid as string);
      setSearchCid(params.cid as string);
      loadUserData(params.cid as string);
    }
  }, [params.cid]);

  const loadUserData = async (cid: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/endorsements/${cid}`);
      
      if (!response.ok) {
        throw new Error('Benutzerdaten konnten nicht geladen werden');
      }
      
      const userData = await response.json();
      setData(userData);
      setCurrentCid(cid);
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
    if (!searchCid.trim()) return;
    
    // Update URL ohne Page-Reload
    router.push(`/admin/userinfo/${searchCid.trim()}`);
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

  const totalEndorsements = data ? Object.values(data.endorsements).flat().length : 0;
  const totalSolos = data ? Object.values(data.solos).flat().length : 0;
  const totalFams = data ? Object.values(data.familiarizations).flat().length : 0;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header mit CID-Suche */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Zurück
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <User className="w-8 h-8" />
              User Qualifications
            </h1>
            <p className="text-muted-foreground">Qualifications & Berechtigungen anzeigen</p>
          </div>
        </div>
        
        {data?.rating && (
          <Badge className={`${getBadgeClassForEndorsement(data.rating)} text-lg px-3 py-1`}>
            Rating: {data.rating}
          </Badge>
        )}
      </div>

      {/* CID Suchfeld */}
      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="flex-1">
              <Input
                placeholder="CID eingeben (z.B. 1234567)"
                value={searchCid}
                onChange={(e) => setSearchCid(e.target.value)}
                type="number"
                className="text-lg"
              />
            </div>
            <Button type="submit" disabled={loading || !searchCid.trim()}>
              <Search className="w-4 h-4 mr-2" />
              {loading ? 'Lädt...' : 'Anzeigen'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {loading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      )}

      {error && !loading && (
        <Card className="border-destructive">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="w-12 h-12 text-destructive mb-4" />
            <h3 className="text-lg font-semibold mb-2">Fehler beim Laden</h3>
            <p className="text-muted-foreground text-center mb-4">{error}</p>
            <Button onClick={() => loadUserData(currentCid)} variant="outline">
              Erneut versuchen
            </Button>
          </CardContent>
        </Card>
      )}

      {data && !loading && (
        <>
          {/* Zusammenfassung */}
          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardContent className="flex flex-col items-center p-6">
                <CheckCircle2 className="w-8 h-8 text-green-600 mb-2" />
                <span className="text-2xl font-bold">{totalEndorsements}</span>
                <span className="text-sm text-muted-foreground">Endorsements</span>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="flex flex-col items-center p-6">
                <Clock className="w-8 h-8 text-blue-600 mb-2" />
                <span className="text-2xl font-bold">{totalSolos}</span>
                <span className="text-sm text-muted-foreground">Solo Validierungen</span>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="flex flex-col items-center p-6">
                <MapPin className="w-8 h-8 text-purple-600 mb-2" />
                <span className="text-2xl font-bold">{totalFams}</span>
                <span className="text-sm text-muted-foreground">CTR Fams</span>
              </CardContent>
            </Card>
          </div>

          {/* Endorsements Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                Endorsements
                <Badge variant="secondary">{totalEndorsements}</Badge>
              </CardTitle>
              <CardDescription>
                Aktive Position Endorsements für CID {data.cid}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {totalEndorsements === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Keine aktiven Endorsements vorhanden
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(data.endorsements).map(([airport, positions]) => (
                    <Card key={airport} className="bg-muted/50">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center justify-between text-base">
                          <div className="flex items-center gap-2">
                            <Building className="w-4 h-4" />
                            {airport}
                          </div>
                          <Badge variant="outline">{positions.length}</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {positions.map((position) => {
                            const positionName = position.split('_').pop();
                            return (
                              <Tooltip key={position}>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center justify-between p-2 rounded-lg bg-background">
                                    <span className="font-medium text-sm">{positionName}</span>
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

          {/* Solos Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                Solo Validierungen
                <Badge variant="secondary">{totalSolos}</Badge>
              </CardTitle>
              <CardDescription>
                Aktive Solo Validierungen für CID {data.cid}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {totalSolos === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Keine aktiven Solo Validierungen vorhanden
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {Object.entries(data.solos).map(([airport, solos]) => (
                    <Card key={airport} className="bg-muted/50">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center justify-between text-base">
                          <div className="flex items-center gap-2">
                            <Building className="w-4 h-4" />
                            {airport}
                          </div>
                          <Badge variant="outline">{solos.length}</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {solos.map((solo) => {
                            const expired = isExpired(solo.expiry);
                            return (
                              <div
                                key={solo.position}
                                className={`p-3 rounded-lg border ${
                                  expired 
                                    ? 'border-destructive/20 bg-destructive/5' 
                                    : 'border-green-200 bg-green-50'
                                }`}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-medium text-sm">{solo.position}</span>
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

          {/* Familiarizations Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-purple-600" />
                CTR Familiarizations
                <Badge variant="secondary">{totalFams}</Badge>
              </CardTitle>
              <CardDescription>
                Aktive CTR Familiarizations für CID {data.cid}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {totalFams === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Keine aktiven CTR Familiarizations vorhanden
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(data.familiarizations).map(([fir, sectors]) => (
                    <Card key={fir}>
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between text-base">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            {fir} FIR
                          </div>
                          <Badge variant="outline">{sectors.length} Sektoren</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                          {sectors.map((sector) => (
                            <div
                              key={sector}
                              className="flex items-center p-3 rounded-lg bg-blue-50 border border-blue-200"
                            >
                              <CheckCircle2 className="w-4 h-4 text-blue-600 mr-2" />
                              <span className="font-medium text-sm">{sector}</span>
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
        </>
      )}

      {!data && !loading && !error && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <User className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">CID eingeben</h3>
            <p className="text-muted-foreground text-center">
              Geben Sie eine CID ein, um die Qualifications anzuzeigen
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}