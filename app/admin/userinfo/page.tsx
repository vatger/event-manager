'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { User, MapPin, Clock, Building, AlertCircle, CheckCircle2, Search, BarChart2, ChevronDown, ChevronUp } from 'lucide-react';
import { getBadgeClassForEndorsement } from '@/utils/EndorsementBadge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface UserQualifications {
  cid: number;
  rating: string | null;
  endorsements: Record<string, string[]>;
  solos: Record<string, { position: string; expiry: Date }[]>;
  familiarizations: Record<string, string[]>;
}

interface SessionDetail {
  callsign: string;
  date: string;
  minutes: number;
}

interface StationStat {
  station: string;
  totalMinutes: number;
  sessionCount: number;
  lastSession?: string;
  sessions: SessionDetail[];
}

export default function UserInfoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlCid = searchParams.get('cid');
  
  const [cid, setCid] = useState(urlCid || '');
  const [data, setData] = useState<UserQualifications | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ATC Stats state – lädt unabhängig von den Endorsements
  const [stats, setStats] = useState<StationStat[] | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [stationSearch, setStationSearch] = useState('');
  // Menge der aufgeklappten Stationen (station-Name als Key)
  const [expandedStations, setExpandedStations] = useState<Set<string>>(new Set());

  // Lade Daten wenn CID in URL-Param vorhanden
  useEffect(() => {
    if (urlCid) {
      setCid(urlCid);
      loadUserData(urlCid);
    }
  }, [urlCid]);

  const loadUserData = (cidToLoad: string) => {
    setLoading(true);
    setError(null);
    setStats(null);
    setStatsLoading(true);
    setExpandedStations(new Set());

    // Endorsements (Hauptdaten)
    fetch(`/api/endorsements/${cidToLoad}`)
      .then((r) => {
        if (!r.ok) throw new Error('Benutzerdaten konnten nicht geladen werden');
        return r.json();
      })
      .then((d) => setData(d))
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten');
        setData(null);
      })
      .finally(() => setLoading(false));

    // ATC-Statistiken – parallel, Fehler werden still ignoriert
    fetch(`/api/admin/userinfo/${cidToLoad}/stats`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { stations: StationStat[] }) => setStats(d.stations))
      .catch(() => setStats([]))
      .finally(() => setStatsLoading(false));
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cid.trim()) return;
    router.push(`/admin/userinfo?cid=${cid.trim()}`);
  };

  const toggleStation = (station: string) => {
    setExpandedStations((prev) => {
      const next = new Set(prev);
      if (next.has(station)) {
        next.delete(station);
      } else {
        next.add(station);
      }
      return next;
    });
  };

  const formatHours = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatDateTime = (iso: string) => {
    return new Date(iso).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isExpired = (expiry: Date) => {
    return new Date(expiry) < new Date();
  };

  // Top 5 + Suchfilter
  const top5 = stats ? stats.slice(0, 5) : [];
  const searchResults = stationSearch.trim()
    ? (stats ?? []).filter((s) =>
        s.station.toLowerCase().includes(stationSearch.trim().toLowerCase())
      )
    : [];

  const isDataVisible = data && !loading;

  /** Wiederverwendbare Station-Zeile mit Drill-Down */
  const StationRow = ({ s, rank }: { s: StationStat; rank?: number }) => {
    const expanded = expandedStations.has(s.station);
    return (
      <div className="rounded-lg border overflow-hidden">
        <button
          type="button"
          onClick={() => toggleStation(s.station)}
          className="w-full flex items-center justify-between p-3 bg-muted/50 hover:bg-muted/80 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            {rank !== undefined && (
              <span className="text-muted-foreground font-mono text-sm w-5 text-right">
                {rank}.
              </span>
            )}
            <span className="font-medium font-mono">{s.station}</span>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary" className="font-mono">
                  {formatHours(s.totalMinutes)}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>{s.sessionCount} Sessions</p>
                {s.lastSession && (
                  <p>Letzte Session: {formatDate(s.lastSession)}</p>
                )}
              </TooltipContent>
            </Tooltip>
            <span className="text-muted-foreground text-sm">{s.sessionCount}×</span>
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </button>

        {expanded && (
          <div className="divide-y border-t bg-background">
            {s.sessions.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-3">
                Keine Sessions vorhanden
              </p>
            ) : (
              s.sessions.map((session, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-4 py-2 text-sm"
                >
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>{formatDateTime(session.date)}</span>
                    {session.callsign !== s.station && (
                      <span className="font-mono text-xs text-muted-foreground/60">
                        ({session.callsign})
                      </span>
                    )}
                  </div>
                  <Badge variant="outline" className="font-mono text-xs">
                    {formatHours(session.minutes)}
                  </Badge>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 justify-between">
        <div>
          <h1 className="text-3xl font-bold">Controller information</h1>
          <p className="text-muted-foreground">Endorsements, Solos, ATC-Statistiken</p>
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
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

      {isDataVisible && (
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
                                  ? 'border-destructive/30 bg-destructive/10 dark:border-destructive/50 dark:bg-destructive/20'
                                  : 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900'
                                }`}
                                >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-medium">{solo.position}</span>
                                  <Badge
                                  variant={expired ? 'destructive' : 'default'}
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

      {/* ATC-Statistiken – zeigt Skeleton bis Daten geladen */}
      {(statsLoading || (stats !== null && urlCid)) && (
        <div className="space-y-6">
          {/* Stations-Suche */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-4 h-4" />
                Stationssuche
              </CardTitle>
              <CardDescription>
                Nach Airport oder Position suchen (z.B. &quot;EDDM&quot; oder &quot;TWR&quot;) – klicken zum Aufklappen
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Station suchen..."
                value={stationSearch}
                onChange={(e) => setStationSearch(e.target.value)}
                disabled={statsLoading}
              />
              {stationSearch.trim() && (
                <>
                  {statsLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-10 w-full" />
                      ))}
                    </div>
                  ) : searchResults.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">
                      Keine Stationen für &quot;{stationSearch}&quot; gefunden
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {searchResults.map((s) => (
                        <StationRow key={s.station} s={s} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
          
          {/* Top 5 Stationen */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4" />
                Top 5 Stationen
                {!statsLoading && stats && (
                  <Badge variant="secondary">{stats.length} gesamt</Badge>
                )}
              </CardTitle>
              <CardDescription>
                Stationen mit den meisten kontrollierten Stunden – klicken zum Aufklappen
              </CardDescription>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : top5.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Keine ATC-Statistiken vorhanden
                </p>
              ) : (
                <div className="space-y-2">
                  {top5.map((s, idx) => (
                    <StationRow key={s.station} s={s} rank={idx + 1} />
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
              Geben Sie eine CID ein, um die Controller-Informationen anzuzeigen
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
