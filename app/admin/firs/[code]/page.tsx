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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Key, ArrowLeft, Plus, Settings, Trash2, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { GroupMembers } from '../_components/group-members';
import { GroupPermissions } from '../_components/group-permissions';
import { useUser } from '@/hooks/useUser';
import { CreateGroupDialog, EditGroupDialog, DeleteGroupDialog } from '../_components/GroupDialogs';
import { toast } from 'sonner';
import { DISCORD_NOTIFICATION_TYPES, DISCORD_NOTIFICATION_LABELS, DiscordNotificationType } from '@/lib/discord/notificationTypes';

interface DiscordNotificationRecord {
  id: number;
  notificationType: string;
  label: string | null;
  weeklyConfigId: number | null;
  weeklyConfig: { id: number; name: string } | null;
  channelId: string;
  roleId: string | null;
}

const NOTIFICATION_TYPE_OPTIONS = Object.values(DISCORD_NOTIFICATION_TYPES).map((t) => ({
  value: t,
  label: DISCORD_NOTIFICATION_LABELS[t as DiscordNotificationType],
}));

export default function FIRDetailPage() {
  const params = useParams();
  const firCode = params.code as string;
  const [fir, setFir] = useState<FIR | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('groups');

  // Discord notification state
  const [discordNotifications, setDiscordNotifications] = useState<DiscordNotificationRecord[]>([]);
  const [discordLoaded, setDiscordLoaded] = useState(false);
  const [savingDiscord, setSavingDiscord] = useState(false);
  // Form for new/edit notification config
  const [newType, setNewType] = useState<string>(DISCORD_NOTIFICATION_TYPES.WEEKLY_SIGNUP_DEADLINE);
  const [newChannelId, setNewChannelId] = useState('');
  const [newRoleId, setNewRoleId] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newWeeklyConfigId, setNewWeeklyConfigId] = useState('');

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

  const loadDiscordNotifications = async () => {
    if (discordLoaded) return;
    try {
      const res = await fetch(`/api/admin/firs/${firCode}/discord-config`);
      if (res.ok) {
        const data = await res.json();
        setDiscordNotifications(data.discordNotifications ?? []);
        setDiscordLoaded(true);
      }
    } catch (err) {
      console.error('Failed to load Discord notifications', err);
    }
  };

  const addDiscordNotification = async () => {
    if (!newChannelId.trim()) {
      toast.error('Channel ID darf nicht leer sein');
      return;
    }
    setSavingDiscord(true);
    try {
      const res = await fetch(`/api/admin/firs/${firCode}/discord-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationType: newType,
          channelId: newChannelId.trim(),
          roleId: newRoleId.trim() || null,
          label: newLabel.trim() || null,
          weeklyConfigId: newWeeklyConfigId ? Number(newWeeklyConfigId) : null,
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Fehler beim Speichern');
      }
      const data = await res.json();
      setDiscordNotifications((prev) => {
        // Update if already exists (upsert), otherwise append
        const exists = prev.findIndex((n) => n.id === data.discordNotification.id);
        if (exists !== -1) {
          const next = [...prev];
          next[exists] = data.discordNotification;
          return next;
        }
        return [...prev, data.discordNotification];
      });
      setNewChannelId('');
      setNewRoleId('');
      setNewLabel('');
      setNewWeeklyConfigId('');
      toast.success('Discord-Benachrichtigung gespeichert');
    } catch (err: any) {
      toast.error(err.message || 'Fehler beim Speichern');
    } finally {
      setSavingDiscord(false);
    }
  };

  const deleteDiscordNotification = async (id: number) => {
    setSavingDiscord(true);
    try {
      const res = await fetch(`/api/admin/firs/${firCode}/discord-config`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Fehler beim Löschen');
      }
      setDiscordNotifications((prev) => prev.filter((n) => n.id !== id));
      toast.success('Konfiguration entfernt');
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
        if (v === 'discord' && !discordLoaded && canManageFIR) loadDiscordNotifications();
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
            {/* Existing notification configs */}
            {discordNotifications.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" />
                    Aktive Discord-Benachrichtigungen
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {discordNotifications.map((n) => (
                    <div
                      key={n.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[11px]">
                            {DISCORD_NOTIFICATION_LABELS[n.notificationType as DiscordNotificationType] ?? n.notificationType}
                          </Badge>
                          {n.weeklyConfig && (
                            <Badge variant="secondary" className="text-[11px]">
                              {n.weeklyConfig.name}
                            </Badge>
                          )}
                          {!n.weeklyConfig && (
                            <span className="text-[11px] text-muted-foreground">FIR-weit</span>
                          )}
                          {n.label && <span className="text-xs text-muted-foreground italic">{n.label}</span>}
                        </div>
                        <p className="text-xs text-muted-foreground font-mono">
                          #{n.channelId}{n.roleId && <> · @{n.roleId}</>}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        onClick={() => deleteDiscordNotification(n.id)}
                        disabled={savingDiscord}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Add new notification config */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Neue Discord-Benachrichtigung konfigurieren
                </CardTitle>
                <CardDescription>
                  Für jeden Benachrichtigungstyp kann ein eigener Channel und eine eigene Rolle festgelegt werden.
                  Per-Weekly-Konfigurationen haben Vorrang vor FIR-weiten Konfigurationen desselben Typs.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Benachrichtigungstyp <span className="text-red-500">*</span></Label>
                    <Select value={newType} onValueChange={setNewType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {NOTIFICATION_TYPE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Welche Benachrichtigungsart verwendet diese Konfiguration</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-weekly">Weekly (optional)</Label>
                    <Input
                      id="new-weekly"
                      placeholder="Weekly Config ID (leer = FIR-weit)"
                      value={newWeeklyConfigId}
                      onChange={(e) => setNewWeeklyConfigId(e.target.value)}
                      type="number"
                    />
                    <p className="text-xs text-muted-foreground">Leer lassen für FIR-weite Konfiguration; Weekly-ID für spezifisches Weekly</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-channel">Channel ID <span className="text-red-500">*</span></Label>
                    <Input
                      id="new-channel"
                      placeholder="z. B. 1234567890123456789"
                      value={newChannelId}
                      onChange={(e) => setNewChannelId(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Entwicklermodus → Rechtsklick auf Kanal → ID kopieren</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-role">Role ID <span className="text-muted-foreground text-xs">(optional)</span></Label>
                    <Input
                      id="new-role"
                      placeholder="z. B. 9876543210987654321"
                      value={newRoleId}
                      onChange={(e) => setNewRoleId(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Rolle die bei dieser Benachrichtigung gepingt wird</p>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="new-label">Bezeichnung <span className="text-muted-foreground text-xs">(optional)</span></Label>
                    <Input
                      id="new-label"
                      placeholder="z. B. München Mittwoch Team"
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                    />
                  </div>
                </div>

                <Button
                  onClick={addDiscordNotification}
                  disabled={savingDiscord || !newChannelId.trim()}
                  className="mt-2"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Konfiguration hinzufügen / aktualisieren
                </Button>

                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-700 dark:text-blue-400 space-y-1">
                  <p className="font-medium">Lookup-Reihenfolge:</p>
                  <ul className="list-disc ml-4 space-y-0.5">
                    <li><strong>Weekly-spezifisch</strong>: Konfiguration mit passendem Weekly hat höchste Priorität</li>
                    <li><strong>FIR-weit</strong>: Konfiguration ohne Weekly als Fallback für den Typ</li>
                    <li><strong>Env Vars</strong>: <code>DISCORD_EDMM_CHANNEL_ID</code> / <code>DISCORD_EDMM_ROLE_ID</code> als letzter Fallback (nur EDMM)</li>
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