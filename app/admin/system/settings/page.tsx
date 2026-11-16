'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Shield } from 'lucide-react';
import { toast } from 'sonner';
import CronJobMonitor from './CronJobMonitor';
import EndorsementDebugCard from './EndorsementDebugCard';
import ApiTokensCard from './ApiTokensCard';
import { useUser } from '@/hooks/useUser';

export default function SystemSettingsPage() {
  const { isMainAdmin } = useUser();
  const [userStats, setUserStats] = useState<{ totalUsers: number; recentUsers: number } | null>(null);

  useEffect(() => {
    loadUserStats();
  }, []);

  const loadUserStats = async () => {
    try {
      const response = await fetch('/api/admin/users');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Fehler beim Laden' }));
        throw new Error(errorData.error || 'Nutzer konnten nicht geladen werden');
      }
      const data = await response.json();
      setUserStats(data);
    } catch (error) {
      console.error('Failed to load users:', error);
      toast.error(error instanceof Error ? error.message : 'Fehler beim Laden der Nutzer');
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">System Einstellungen</h1>
          <p className="text-muted-foreground">Systemstatus, Cronjobs und Diagnose</p>
        </div>
      </div>

      {/* Statscard mit aktuellen Zahlen zu Nutzern, Events, etc. könnte hier auch noch rein */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Systemübersicht
          </CardTitle>
          <CardDescription>
            Aktuelle Statistiken zum System (z.B. Anzahl Nutzer, Events, etc.)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-muted rounded-lg text-center">
              <p className="text-sm text-muted-foreground">Gesamt Nutzer</p>
              <p className="text-2xl font-bold">{userStats?.totalUsers}</p>
            </div>
            <div className="p-4 bg-muted rounded-lg text-center">
              <p className="text-sm text-muted-foreground">Neue Nutzer (in den letzten 7 Tagen angemeldet)</p>
              <p className="text-2xl font-bold">{userStats?.recentUsers}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* VATGER-Eventleitung und Main-Admins stehen unter „Team & Rechte“ */}
      <Card>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Users className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div>
              <p className="font-medium">VATGER-Eventleitung und Main-Admins</p>
              <p className="text-sm text-muted-foreground">
                Rollen und Rechte werden gesammelt unter „Team &amp; Rechte“ gepflegt.
              </p>
            </div>
          </div>
          <Button asChild variant="outline">
            <Link href="/admin/team">Zu Team &amp; Rechte</Link>
          </Button>
        </CardContent>
      </Card>
      {isMainAdmin() && <ApiTokensCard />}
      <CronJobMonitor />
      <EndorsementDebugCard />
    </div>
  );
}