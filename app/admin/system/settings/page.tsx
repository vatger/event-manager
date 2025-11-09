'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, UserPlus, UserMinus, Shield, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import TrainingCacheCard from './RefreshEndorsements';

interface VATGERMember {
  id: string;
  userCID: number;
  user: {
    cid: number;
    name: string;
    rating: string;
  };
}

export default function SystemSettingsPage() {
  const [members, setMembers] = useState<VATGERMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [newCid, setNewCid] = useState('');

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/vatger-leaders');
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Fehler beim Laden' }));
        throw new Error(errorData.error || 'Mitglieder konnten nicht geladen werden');
      }
      
      const data = await response.json();
      setMembers(data);
    } catch (error) {
      console.error('Failed to load members:', error);
      toast.error(error instanceof Error ? error.message : 'Fehler beim Laden der Mitglieder');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!newCid.trim()) {
      toast.error('Bitte geben Sie eine CID ein');
      return;
    }

    setAdding(true);
    try {
      const response = await fetch(`/api/admin/vatger-leaders/${newCid}`, {
        method: 'POST',
      });

      const responseText = await response.text();
      let errorData;
      
      try {
        errorData = responseText ? JSON.parse(responseText) : {};
      } catch {
        throw new Error('Ungültige Antwort vom Server');
      }

      if (!response.ok) {
        throw new Error(errorData.error || `Fehler: ${response.status}`);
      }

      toast.success('Mitglied erfolgreich hinzugefügt');
      setNewCid('');
      loadMembers();
    } catch (error) {
      console.error('Failed to add member:', error);
      toast.error(error instanceof Error ? error.message : 'Fehler beim Hinzufügen');
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveMember = async (cid: number) => {
    setRemoving(true);
    try {
      const response = await fetch(`/api/admin/vatger-leaders/${cid}`, {
        method: 'DELETE',
      });

      const responseText = await response.text();
      let errorData;
      
      try {
        errorData = responseText ? JSON.parse(responseText) : {};
      } catch {
        throw new Error('Ungültige Antwort vom Server');
      }

      if (!response.ok) {
        throw new Error(errorData.error || `Fehler: ${response.status}`);
      }

      toast.success('Mitglied erfolgreich entfernt');
      loadMembers();
    } catch (error) {
      console.error('Failed to remove member:', error);
      toast.error(error instanceof Error ? error.message : 'Fehler beim Entfernen');
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">System Einstellungen</h1>
          <p className="text-muted-foreground">Verwaltung der VATGER Eventleiter</p>
        </div>
      </div>

      {/* Members List Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Aktive VATGER Eventleiter
            <Badge variant="secondary">{members.length}</Badge>
          </CardTitle>
          <CardDescription>
            Liste aller Benutzer mit VATGER Eventleitung Berechtigung
          </CardDescription>
        </CardHeader>
        <CardContent>
        <div className="flex gap-2 max-w-md pb-3">
            <Input
              placeholder="CID eingeben (z.B. 1234567)"
              value={newCid}
              onChange={(e) => setNewCid(e.target.value)}
              type="number"
              disabled={adding}
            />
            <Button 
              onClick={handleAddMember} 
              disabled={adding || !newCid.trim()}
            >
              {adding ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4 mr-2" />
              )}
              Hinzufügen
            </Button>
          </div>
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              <span>Lade Mitglieder...</span>
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Keine VATGER Eventleiter vorhanden</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>CID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead className="w-[100px]">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-mono">{member.user.cid}</TableCell>
                    <TableCell className="font-medium">{member.user.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{member.user.rating}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveMember(member.user.cid)}
                        disabled={removing}
                      >
                        <UserMinus className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <TrainingCacheCard />
    </div>
  );
}