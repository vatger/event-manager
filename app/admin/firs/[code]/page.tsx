'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { firApi } from '@/lib/api/fir';
import { FIR, Group } from '@/types/fir';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Users, Key, ArrowLeft, Plus, Settings, Trash2, MessageSquare, Check, X } from 'lucide-react';
import Link from 'next/link';
import { GroupMembers } from '../_components/group-members';
import { GroupPermissions } from '../_components/group-permissions';
import { useUser } from '@/hooks/useUser';
import { CreateGroupDialog, EditGroupDialog, DeleteGroupDialog } from '../_components/GroupDialogs';
import { toast } from 'sonner';

interface DiscordConfig {
  id: number;
  channelId: string;
  roleId: string | null;
}

export default function FIRDetailPage() {
  const params = useParams();
  const firCode = params.code as string;
  const [fir, setFir] = useState<FIR | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('groups');
  
  // Discord config state
  const [discordConfig, setDiscordConfig] = useState<DiscordConfig | null>(null);
  const [discordChannelId, setDiscordChannelId] = useState('');
  const [discordRoleId, setDiscordRoleId] = useState('');
  const [savingDiscord, setSavingDiscord] = useState(false);
  
  // Dialog States
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);

  const { isVATGERLead, isFIRLead } = useUser();

  useEffect(() => {
    loadData();
  }, [firCode]);

  const loadData = async () => {
    try {
      setLoading(true);
      const firsData = await firApi.getFIRs();
      const currentFIR = firsData.find(f => f.code === firCode);
      setFir(currentFIR || null);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load Discord config when Discord tab is activated
  const loadDiscordConfig = async () => {
    try {
      const res = await fetch(`/api/admin/firs/${firCode}/discord-config`);
      if (res.ok) {
        const data = await res.json();
        setDiscordConfig(data.discordConfig);
        if (data.discordConfig) {
          setDiscordChannelId(data.discordConfig.channelId);
          setDiscordRoleId(data.discordConfig.roleId ?? '');
        }
      }
    } catch (err) {
      console.error('Failed to load Discord config', err);
    }
  };

  const saveDiscordConfig = async () => {
    if (!discordChannelId.trim()) {
      toast.error('Channel ID darf nicht leer sein');
      return;
    }
    setSavingDiscord(true);
    try {
      const res = await fetch(`/api/admin/firs/${firCode}/discord-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: discordChannelId.trim(), roleId: discordRoleId.trim() || null }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Fehler beim Speichern');
      }
      const data = await res.json();
      setDiscordConfig(data.discordConfig);
      toast.success('Discord-Konfiguration gespeichert');
    } catch (err: any) {
      toast.error(err.message || 'Fehler beim Speichern');
    } finally {
      setSavingDiscord(false);
    }
  };

  const deleteDiscordConfig = async () => {
    setSavingDiscord(true);
    try {
      const res = await fetch(`/api/admin/firs/${firCode}/discord-config`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Fehler beim Löschen');
      }
      setDiscordConfig(null);
      setDiscordChannelId('');
      setDiscordRoleId('');
      toast.success('Discord-Konfiguration entfernt');
    } catch (err: any) {
      toast.error(err.message || 'Fehler beim Löschen');
    } finally {
      setSavingDiscord(false);
    }
  };

  const canManageFIR = isVATGERLead() || isFIRLead();

  const handleCreateGroup = (newGroupId: number) => {
    setCreateDialogOpen(false);
    loadData();
  };

  const handleEditGroup = (group: Group) => {
    setSelectedGroup(group);
    setEditDialogOpen(true);
  };

  const handleDeleteGroup = (group: Group) => {
    setSelectedGroup(group);
    setDeleteDialogOpen(true);
  };

  const handleGroupUpdated = () => {
    setEditDialogOpen(false);
    setSelectedGroup(null);
    loadData();
  };

  const handleGroupDeleted = () => {
    setDeleteDialogOpen(false);
    setSelectedGroup(null);
    loadData();
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </div>
    );
  }

  if (!fir) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">FIR nicht gefunden</h1>
          <div className="flex gap-2 justify-center mt-4">
            <Link href="/admin/firs">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Zurück zur Übersicht
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/firs">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Zurück
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{fir.code}</h1>
            <p className="text-muted-foreground">{fir.name}</p>
          </div>
        </div>
        
        {canManageFIR && (
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Neue Gruppe
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => {
        setActiveTab(v);
        if (v === 'discord' && !discordConfig && canManageFIR) loadDiscordConfig();
      }} className="space-y-6">
        <TabsList>
          <TabsTrigger value="groups">
            <Users className="w-4 h-4 mr-2" />
            Gruppen & Mitglieder
          </TabsTrigger>
          <TabsTrigger value="permissions">
            <Key className="w-4 h-4 mr-2" />
            Berechtigungen
          </TabsTrigger>
          {canManageFIR && (
            <TabsTrigger value="discord">
              <MessageSquare className="w-4 h-4 mr-2" />
              Discord
            </TabsTrigger>
          )}
        </TabsList>

        {/* Groups Tab */}
        <TabsContent value="groups" className="space-y-6">
          {fir.groups?.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Keine Gruppen vorhanden</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Erstellen Sie Ihre erste Gruppe für diese FIR
                </p>
                {canManageFIR && (
                  <Button onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Gruppe erstellen
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            fir.groups?.map((group) => (
              <Card key={group.id} className="group">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle className="flex items-center gap-3">
                        {group.name}
                        <Badge variant={
                          group.kind === 'FIR_LEITUNG' ? 'default' : 'secondary'
                        }>
                          {group.kind}
                        </Badge>
                      </CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="hidden lg:flex items-center gap-2 text-sm text-muted-foreground mr-4">
                        <Users className="w-4 h-4" />
                        {group.members?.length || 0} Mitglieder
                      </div>
                      
                      {canManageFIR && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditGroup(group)}
                            disabled={group.kind === 'FIR_LEITUNG' && !isVATGERLead()}
                          >
                            <Settings className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteGroup(group)}
                            disabled={group.kind === 'FIR_LEITUNG' && !isVATGERLead()}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                  <CardDescription>{group.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <GroupMembers
                    group={group}
                    firCode={fir.code}
                    canManage={canManageFIR}
                    VATGERStaff={isVATGERLead()}
                    onUpdate={loadData}
                  />
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Permissions Tab */}
        <TabsContent value="permissions" className="space-y-6">
          {fir.groups?.map((group) => (
            <Card key={group.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  {group.name}
                  <Badge variant="outline">
                    {group.members?.length || 0} Mitglieder
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Berechtigungen für {group.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <GroupPermissions
                  group={group}
                  firCode={fir.code}
                  canManage={canManageFIR && (
                    group.kind !== "FIR_LEITUNG" || isVATGERLead()
                  )}
                  onUpdate={loadData}
                />
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Discord Tab */}
        {canManageFIR && (
          <TabsContent value="discord" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Discord-Konfiguration
                </CardTitle>
                <CardDescription>
                  Konfiguriere den Discord-Kanal und die Rolle, die für {fir.code}-Benachrichtigungen (z. B. Anmeldeschluss, Roster-Veröffentlichung) verwendet werden.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {discordConfig && (
                  <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2">
                    <Check className="w-4 h-4 flex-shrink-0" />
                    <span>Aktive Konfiguration: Kanal <code className="font-mono">{discordConfig.channelId}</code>
                      {discordConfig.roleId && <>, Rolle <code className="font-mono">{discordConfig.roleId}</code></>}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="discord-channel">Channel ID <span className="text-red-500">*</span></Label>
                    <Input
                      id="discord-channel"
                      placeholder="z. B. 1234567890123456789"
                      value={discordChannelId}
                      onChange={(e) => setDiscordChannelId(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Discord Channel ID (Entwicklermodus → Rechtsklick auf Kanal → ID kopieren)</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="discord-role">Role ID <span className="text-muted-foreground text-xs">(optional)</span></Label>
                    <Input
                      id="discord-role"
                      placeholder="z. B. 9876543210987654321"
                      value={discordRoleId}
                      onChange={(e) => setDiscordRoleId(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Rolle die bei Benachrichtigungen gepingt wird</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Button onClick={saveDiscordConfig} disabled={savingDiscord || !discordChannelId.trim()}>
                    Konfiguration speichern
                  </Button>
                  {discordConfig && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={deleteDiscordConfig}
                      disabled={savingDiscord}
                    >
                      <X className="w-4 h-4 mr-1" />
                      Entfernen
                    </Button>
                  )}
                </div>

                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-700 dark:text-blue-400 space-y-1">
                  <p className="font-medium">Verwendung:</p>
                  <ul className="list-disc ml-4 space-y-0.5">
                    <li>Anmeldeschluss-Benachrichtigung: wird automatisch gesendet wenn die Deadline abläuft</li>
                    <li>Roster-Veröffentlichung: wird gesendet wenn ein Roster veröffentlicht wird</li>
                    <li>Die Bot-URL und der Token werden global über Umgebungsvariablen konfiguriert</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Dialogs */}
      <CreateGroupDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        firCode={fir.code}
        onCreated={handleCreateGroup}
      />

      <EditGroupDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        firCode={fir.code}
        group={selectedGroup}
        onUpdated={handleGroupUpdated}
      />

      <DeleteGroupDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        firCode={fir.code}
        groupId={selectedGroup?.id || 0}
        onDeleted={handleGroupDeleted}
      />
    </div>
  );
}