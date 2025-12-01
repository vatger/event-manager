'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Bell, Send } from 'lucide-react';
import { toast } from 'sonner';

interface Qualification {
  type: 'endorsement' | 'solo';
  position: string;
  id: number;
  expiry?: string;
}

interface GroupData {
  qualifications: Qualification[];
  familiarizations?: string[];
}

interface Candidate {
  cid: number;
  name: string | null;
  rating: string | null;
  signedUp: boolean;
  groups: {
    GND: GroupData;
    TWR: GroupData;
    APP: GroupData;
    CTR: GroupData;
  };
}

interface Event {
  id: number;
  name: string;
  airports: string[];
  firCode: string | null;
}

interface ApiResponse {
  event: Event;
  candidates: Candidate[];
  isTier1: boolean;
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('de-DE');
}

function hasQualifications(groupData: GroupData) {
  return groupData.qualifications.length > 0 || (groupData.familiarizations && groupData.familiarizations.length > 0);
}

// Loading Skeleton Component
function LoadingSkeleton() {
  return (
    <div className="container mx-auto p-6">
      <Skeleton className="h-8 w-64 mb-2" />
      <Skeleton className="h-4 w-96 mb-6" />
      <Skeleton className="h-10 w-full mb-6" />
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    </div>
  );
}

// Group Table Component
function GroupTable({ 
  group, 
  candidates,
  groupLabel,
  eventId,
  eventName
}: { 
  group: keyof typeof groupLabels;
  candidates: Candidate[];
  groupLabel: string;
  eventId: number;
  eventName: string;
}) {
  const isCTRGroup = group === 'CTR';
  const [notifyDialogOpen, setNotifyDialogOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [notifyTitle, setNotifyTitle] = useState('');
  const [notifyMessage, setNotifyMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleNotifyClick = (candidate: Candidate) => {
    setSelectedCandidate(candidate);
    setNotifyTitle(`Unterstützung gesucht - ${eventName}`);
    setNotifyMessage(`Hallo ${candidate.name || 'Lotse'},\nwir suchen noch Unterstützung für das Event "${eventName}". Hast du Zeit und Lust mitzuhelfen?\nMelde dich jetzt an!`);
    setNotifyDialogOpen(true);
  };

  const handleSendNotification = async () => {
    if (!selectedCandidate || !notifyMessage.trim()) {
      toast.error('Bitte gib eine Nachricht ein');
      return;
    }

    setSending(true);
    try {
      const response = await fetch(`/api/events/${eventId}/notify-candidates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userCIDs: [selectedCandidate.cid],
          customMessage: notifyMessage.trim(),
          customTitle: notifyTitle.trim() || `Unterstützung gesucht - ${eventName}`,
        }),
      });

      if (response.ok) {
        toast.success(`Benachrichtigung an ${selectedCandidate.name || 'Lotse'} gesendet`);
        setNotifyDialogOpen(false);
      } else {
        const error = await response.json();
        toast.error(error.message || 'Fehler beim Senden der Benachrichtigung');
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      toast.error('Netzwerkfehler beim Senden der Benachrichtigung');
    } finally {
      setSending(false);
    }
  };

  if (candidates.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{groupLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Keine Kandidaten für {groupLabel} gefunden
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>{groupLabel}</span>
          <Badge variant="outline">
            {candidates.length} Kandidaten
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lotsen-Info</TableHead>
              <TableHead>Qualifikationen</TableHead>
              {isCTRGroup && <TableHead>Familiarizations</TableHead>}
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {candidates.map(candidate => (
              <TableRow key={`${candidate.cid}-${group}`}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div>
                      <div className="font-medium">
                        {candidate.name || `CID ${candidate.cid}`}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        CID {candidate.cid} • {candidate.rating || 'Unbekannt'}
                      </div>
                      {candidate.signedUp && (
                        <Badge variant="destructive" className="mt-1 bg-green-600">
                          Bereits angemeldet
                        </Badge>
                      )}
                    </div>
                  </div>
                </TableCell>
                
                <TableCell>
                  {candidate.groups[group].qualifications.length > 0 ? (
                    <div className="space-y-2">
                      {candidate.groups[group].qualifications.map((qual) => (
                        <div key={qual.id} className="flex items-center gap-2">
                          <div className="text-sm">{qual.position}</div>
                          {qual.type === 'solo' && (
                            <Badge variant="secondary" className="text-xs">
                              Solo
                              {qual.expiry && (
                                <span className="ml-1">(bis {formatDate(qual.expiry)})</span>
                              )}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </TableCell>

                {isCTRGroup && (
                  <TableCell>
                    {candidate.groups.CTR.familiarizations && candidate.groups.CTR.familiarizations.length > 0 ? (
                      <div className="text-sm">
                        {candidate.groups.CTR.familiarizations.join(', ')}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                )}

                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleNotifyClick(candidate)}
                    disabled={candidate.signedUp}
                  >
                    <Bell className="h-4 w-4 mr-1" />
                    Benachrichtigen
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Notification Dialog */}
        <Dialog open={notifyDialogOpen} onOpenChange={setNotifyDialogOpen}>
          <DialogContent className="sm:max-w-[525px]">
            <DialogHeader>
              <DialogTitle>Lotsen benachrichtigen</DialogTitle>
              <DialogDescription>
                Sende eine Benachrichtigung an {selectedCandidate?.name || 'den Lotsen'} ({selectedCandidate?.cid})
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="notify-title">Titel</Label>
                <Input
                  id="notify-title"
                  value={notifyTitle}
                  onChange={(e) => setNotifyTitle(e.target.value)}
                  placeholder={`Unterstützung gesucht - ${eventName}`}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notify-message">Nachricht *</Label>
                <Textarea
                  id="notify-message"
                  value={notifyMessage}
                  onChange={(e) => setNotifyMessage(e.target.value)}
                  rows={6}
                  placeholder="Gib hier deine Benachrichtigungsnachricht ein..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNotifyDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button 
                onClick={handleSendNotification} 
                disabled={!notifyMessage.trim() || sending}
              >
                {sending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Sende...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Senden
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

const groupLabels = {
  GND: 'Ground',
  TWR: 'Tower', 
  APP: 'Approach',
  CTR: 'Center'
};

export default function CandidatesPage() {
  const params = useParams();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCandidates() {
      try {
        const eventId = params.id;
        const response = await fetch(`/api/events/${eventId}/candidates`);
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Event nicht gefunden');
          }
          throw new Error('Fehler beim Laden der Daten');
        }
        
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
      } finally {
        setLoading(false);
      }
    }

    if (params.id) {
      fetchCandidates();
    }
  }, [params.id]);

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center text-destructive">
          <h1 className="text-2xl font-bold mb-4">Fehler</h1>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!data || !data.isTier1) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Keine Kandidaten verfügbar</h1>
          <p>Für Events ohne Tier-1-Airports werden keine Kandidaten angezeigt.</p>
        </div>
      </div>
    );
  }

  const { event, candidates } = data;

  const getCandidatesForGroup = (group: keyof typeof groupLabels) => {
    return candidates
      .filter(candidate => hasQualifications(candidate.groups[group]))
      .sort((a, b) => {
        const nameA = a.name || a.cid.toString();
        const nameB = b.name || b.cid.toString();
        return nameA.localeCompare(nameB);
      });
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Kandidaten für {event.name}</h1>
        <p className="text-muted-foreground">
          Potentielle Lotsen für die Event-Airports: {event.airports.join(', ')}
          {event.firCode && ` • FIR: ${event.firCode}`}
        </p>
      </div>

      <Tabs defaultValue="GND" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          {Object.entries(groupLabels).map(([key, label]) => (
            <TabsTrigger key={key} value={key}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {Object.keys(groupLabels).map((group) => (
          <TabsContent key={group} value={group} className="space-y-4">
            <GroupTable 
              group={group as keyof typeof groupLabels}
              candidates={getCandidatesForGroup(group as keyof typeof groupLabels)}
              groupLabel={groupLabels[group as keyof typeof groupLabels]}
              eventId={event.id}
              eventName={event.name}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}