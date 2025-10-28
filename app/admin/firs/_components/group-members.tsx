'use client';

import { useState } from 'react';
import { Group } from '@/types/fir';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Trash2, UserPlus, UserMinus } from 'lucide-react';
import { firApi } from '@/lib/api/fir';

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

  const handleAddMember = async () => {
    if (!newMemberCID.trim()) return;
    
    setLoading(true);
    try {
      await firApi.addGroupMember(firCode, group.id, Number(newMemberCID));
      setNewMemberCID('');
      onUpdate();
    } catch (error) {
      console.error('Failed to add member:', error);
    } finally {
      setLoading(false);
    }
  };
  const handleRemoveMember = async (cid: string) => {
    setLoading(true);
    try {
      await firApi.removeGroupMember(firCode, group.id, cid);
      onUpdate();
    } catch (error) {
      console.error('Failed to remove member:', error);
    } finally {
      setLoading(false);
    }
  };

  const canModifyLeaders = canManage && group.kind !== 'FIR_LEITUNG';

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex gap-2">
          <Input
            placeholder="CID eingeben (z.B. 1234567)"
            value={newMemberCID}
            onChange={(e) => setNewMemberCID(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddMember()}
            disabled={loading}
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

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>CID</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Rating</TableHead>
            <TableHead>Rolle</TableHead>
            {canManage && <TableHead>Aktionen</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {group.members.map((member) => (
            <TableRow key={member.id}>
              <TableCell className="font-mono">{member.cid}</TableCell>
              <TableCell>{member.name}</TableCell>
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
                    onClick={() => handleRemoveMember(member.cid)}
                    disabled={loading || (!canModifyLeaders && group.kind === 'FIR_LEITUNG' && !VATGERStaff)}
                  >
                    <UserMinus className="w-4 h-4" />
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
          {group.members.length === 0 && (
            <TableRow>
              <TableCell colSpan={canManage ? 5 : 4} className="text-center text-muted-foreground">
                Keine Mitglieder in dieser Gruppe
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}