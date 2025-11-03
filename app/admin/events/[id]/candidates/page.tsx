// app/admin/events/[id]/candidates/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { RefreshCw, Search, Mail, UserCheck } from "lucide-react";
import { useParams } from "next/navigation";

interface Candidate {
  id: string;
  cid: number;
  name: string;
  rating: string;
  endorsements: string[];
  fir?: string;
  lastActive?: string;
}

export default function EventCandidatesPage() {
  const params = useParams();
  const eventId = params.id as string;

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [filteredCandidates, setFilteredCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadCandidates();
  }, [eventId]);

  useEffect(() => {
    filterCandidates();
  }, [searchTerm, candidates]);

  const loadCandidates = async () => {
    setLoading(true);
    try {
      // Hier würdest du die echte API für qualifizierte Controller aufrufen
      const mockCandidates: Candidate[] = [
        {
          id: "1",
          cid: 123456,
          name: "Max Mustermann",
          rating: "S3",
          endorsements: ["EDDM_TWR", "EDDM_APP"],
          fir: "EDMM",
          lastActive: "2024-01-15"
        },
        // Weitere Mock-Daten...
      ];
      
      setCandidates(mockCandidates);
    } catch (error) {
      console.error("Fehler:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterCandidates = () => {
    if (!searchTerm) {
      setFilteredCandidates(candidates);
      return;
    }

    const filtered = candidates.filter(candidate =>
      candidate.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      candidate.cid.toString().includes(searchTerm) ||
      candidate.endorsements.some(e => e.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    setFilteredCandidates(filtered);
  };

  const toggleCandidateSelection = (candidateId: string) => {
    const newSelected = new Set(selectedCandidates);
    if (newSelected.has(candidateId)) {
      newSelected.delete(candidateId);
    } else {
      newSelected.add(candidateId);
    }
    setSelectedCandidates(newSelected);
  };

  const inviteSelectedCandidates = () => {
    // Implementiere Einladungslogik
    console.log("Einladen:", Array.from(selectedCandidates));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p>Suche potenzielle Lotsen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Potenzielle Lotsen</h1>
          <p className="text-muted-foreground">
            Controller die für dieses Event qualifiziert sind
          </p>
        </div>
        
        <div className="flex gap-2">
          {selectedCandidates.size > 0 && (
            <Button>
              <Mail className="h-4 w-4 mr-2" />
              Ausgewählte einladen ({selectedCandidates.size})
            </Button>
          )}
          <Button variant="outline" onClick={loadCandidates}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Aktualisieren
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Suche nach Name, CID oder Endorsement..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Candidates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCandidates.map((candidate) => (
          <Card 
            key={candidate.id}
            className={`cursor-pointer transition-all ${
              selectedCandidates.has(candidate.id) 
                ? "ring-2 ring-primary border-primary" 
                : "hover:border-primary/50"
            }`}
            onClick={() => toggleCandidateSelection(candidate.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-medium">{candidate.name}</div>
                  <div className="text-sm text-muted-foreground">
                    CID: {candidate.cid}
                  </div>
                </div>
                <Badge variant="secondary">{candidate.rating}</Badge>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Endorsements:</div>
                <div className="flex flex-wrap gap-1">
                  {candidate.endorsements.map((endorsement) => (
                    <Badge key={endorsement} variant="outline" className="text-xs">
                      {endorsement}
                    </Badge>
                  ))}
                </div>
              </div>

              {candidate.fir && (
                <div className="mt-3 text-sm text-muted-foreground">
                  FIR: {candidate.fir}
                </div>
              )}

              <div className="mt-4 flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  {candidate.lastActive && `Aktiv: ${candidate.lastActive}`}
                </div>
                <UserCheck className={`h-4 w-4 ${
                  selectedCandidates.has(candidate.id) 
                    ? "text-primary" 
                    : "text-muted-foreground"
                }`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredCandidates.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <UserCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <div className="text-lg font-medium text-muted-foreground">
              Keine potenziellen Lotsen gefunden
            </div>
            <div className="text-sm text-muted-foreground mt-2">
              {searchTerm 
                ? "Versuche deine Suchkriterien zu ändern" 
                : "Es wurden keine qualifizierten Controller für dieses Event gefunden"
              }
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}