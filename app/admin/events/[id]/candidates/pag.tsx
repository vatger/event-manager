'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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

interface GroupData {
  qualifications: Array<{
    type: 'endorsement' | 'solo';
    position: string;
    id: number;
    expiry?: string;
  }>;
  familiarizations?: string[];
}

interface Event {
  id: number;
  name: string;
  airports: string[];
  firCode: string | null;
}

interface CandidatesClientProps {
  event: Event;
  candidates: Candidate[];
}

const groupLabels = {
  GND: 'Ground',
  TWR: 'Tower', 
  APP: 'Approach',
  CTR: 'Center'
};

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('de-DE');
}

function hasQualifications(groupData: GroupData) {
  return groupData.qualifications.length > 0 || groupData.familiarizations && groupData.familiarizations.length > 0;
}

export default function CandidatesClient({ event, candidates }: CandidatesClientProps) {
  const getCandidatesForGroup = (group: keyof typeof groupLabels) => {
    return candidates
      .filter(candidate => hasQualifications(candidate.groups[group]))
      .sort((a, b) => {
        const nameA = a.name || a.cid.toString();
        const nameB = b.name || b.cid.toString();
        return nameA.localeCompare(nameB);
      });
  };

  const QualificationDisplay = ({ qualifications }: { qualifications: GroupData['qualifications'] }) => {
    if (qualifications.length === 0) {
      return <span className="text-muted-foreground text-sm">-</span>;
    }

    return (
      <div className="space-y-2">
        {qualifications.map((qual) => (
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
    );
  };

  const FamiliarizationDisplay = ({ familiarizations }: { familiarizations: string[] }) => {
    if (familiarizations.length === 0) {
      return <span className="text-muted-foreground text-sm">-</span>;
    }

    return (
      <div className="text-sm">
        {familiarizations.join(', ')}
      </div>
    );
  };

  const GroupTable = ({ group }: { group: keyof typeof groupLabels }) => {
    const groupCandidates = getCandidatesForGroup(group);
    const isCTRGroup = group === 'CTR';

    if (groupCandidates.length === 0) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>{groupLabels[group]}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              Keine Kandidaten für {groupLabels[group]} gefunden
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span>{groupLabels[group]}</span>
            <Badge variant="outline">
              {groupCandidates.length} Kandidaten
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lotsen-Info</TableHead>
                <TableHead>Endorsements/Solos</TableHead>
                {isCTRGroup && <TableHead>Familiarizations</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupCandidates.map(candidate => (
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
                    <QualificationDisplay 
                      qualifications={candidate.groups[group].qualifications} 
                    />
                  </TableCell>

                  {isCTRGroup && (
                    <TableCell>
                      <FamiliarizationDisplay 
                        familiarizations={candidate.groups[group].familiarizations || []} 
                      />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Kandidaten für {event.name}</h1>
        <p className="text-muted-foreground">
          Potentielle Lotsen für den Event-Airport: {event.airports[0]}
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
            <GroupTable group={group as keyof typeof groupLabels} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}