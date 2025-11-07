'use client';

import { useState } from 'react';
import { Group } from '@/types/fir';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Trash2, UserPlus, UserMinus, Search } from 'lucide-react';
import { firApi } from '@/lib/api/fir';
import { toast } from 'sonner';
import { getErrorMessage } from '@/utils/errorUtils';

interface GroupMembersProps {
  group: Group;
  firCode: string;
  canManage: boolean;
  VATGERStaff: boolean;
  onUpdate: () => void;
}

export function GroupMembers({ group, firCode, canManage, VATGERStaff, onUpdate }: GroupMembersProps) {
  const [newMemberCID, setNewMemberCID] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const handleAddMember = async () => {
    if (!newMemberCID.trim()) {
      toast.error('Bitte geben Sie eine CID ein');
      return;
    }

    const cid = Number(newMemberCID.trim());
    if (isNaN(cid)) {
      toast.error('CID muss eine Zahl sein');
      return;
    }

    setLoading(true);
    try {
      await firApi.addGroupMember(firCode, group.id, cid);
      setNewMemberCID("");
      toast.success("Mitglied erfolgreich hinzugefügt");
      onUpdate();
    } catch (error: unknown) {
      console.error("Failed to add member:", error);
      toast.error(getErrorMessage(error) || "Fehler beim Hinzufügen des Mitglieds");
    } finally {
      setLoading(false);
    }
  };
  
  const handleRemoveMember = async (cid: string, memberName: string): Promise<void> => {
    setLoading(true);
    try {
      await firApi.removeGroupMember(firCode, group.id, cid);
      toast.success(`${memberName} wurde entfernt`);
      onUpdate();
    } catch (error: unknown) {
      console.error("Failed to remove member:", error);
      toast.error(getErrorMessage(error) || "Fehler beim Entfernen des Mitglieds");
    } finally {
      setLoading(false);
    }
  };

  const canModifyLeaders = canManage && group.kind !== 'FIR_LEITUNG';

  // Filter members based on search
  const filteredMembers = group.members?.filter(member => 
    member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.cid.includes(searchTerm) ||
    member.rating.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="space-y-4">
      {/* Add Member Section */}
      {canManage && (
        <div className="flex gap-2 p-4 bg-muted/50 rounded-lg">
          <Input
            placeholder="CID eingeben (z.B. 1234567)"
            value={newMemberCID}
            onChange={(e) => setNewMemberCID(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddMember()}
            disabled={loading}
            className="flex-1"
          />
          <Button 
            onClick={handleAddMember} 
            disabled={loading || !newMemberCID.trim()}
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Hinzufügen
          </Button>
        </div>
      )}

      {/* Search Section */}
      {group.members && group.members.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Mitglieder suchen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {/* Members Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>CID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Rolle</TableHead>
              {canManage && <TableHead className="w-[100px]">Aktionen</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMembers.map((member) => (
              <TableRow key={member.id} className="group">
                <TableCell className="font-mono">{member.cid}</TableCell>
                <TableCell className="font-medium">{member.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">{member.rating}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{member.role}</Badge>
                </TableCell>
                {canManage && (
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveMember(member.cid, member.name)}
                      disabled={loading || (!canModifyLeaders && group.kind === 'FIR_LEITUNG' && !VATGERStaff)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <UserMinus className="w-4 h-4 text-destructive" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {filteredMembers.length === 0 && (
              <TableRow>
                <TableCell 
                  colSpan={canManage ? 5 : 4} 
                  className="text-center text-muted-foreground py-8"
                >
                  {searchTerm ? 'Keine passenden Mitglieder gefunden' : 'Keine Mitglieder in dieser Gruppe'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Summary */}
      {group.members && group.members.length > 0 && (
        <div className="text-sm text-muted-foreground text-center">
          {filteredMembers.length} von {group.members.length} Mitgliedern angezeigt
        </div>
      )}
    </div>
  );
}