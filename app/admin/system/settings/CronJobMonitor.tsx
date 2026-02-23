'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Clock, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Loader2,
  Activity,
  Calendar,
  Play
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import cronstrue from 'cronstrue/i18n';

interface CronJobStatus {
  id: number;
  jobName: string;
  displayName: string;
  description: string;
  schedule: string;
  isActive: boolean;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  lastRunDuration: number | null;
  lastError: string | null;
  runCount: number;
  errorCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function CronJobMonitor() {
  const [jobs, setJobs] = useState<CronJobStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [triggeringJob, setTriggeringJob] = useState<string | null>(null);

  useEffect(() => {
    loadJobStatuses();
  }, []);

  const loadJobStatuses = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/system/cron-status');

      if (!response.ok) {
        throw new Error('Failed to load CRON job statuses');
      }

      const data = await response.json();
      setJobs(data);
    } catch (error) {
      console.error('Failed to load job statuses:', error);
      toast.error('Fehler beim Laden der CRON Job Status');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadJobStatuses();
    setRefreshing(false);
    toast.success('Status aktualisiert');
  };

  const handleTriggerJob = async (jobName: string, displayName: string) => {
    setTriggeringJob(jobName);
    
    try {
      const response = await fetch('/api/admin/system/cron-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobName }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to trigger job');
      }

      toast.success(`${displayName} wurde erfolgreich ausgeführt (${result.duration}ms)`);
      
      // Reload statuses after trigger
      await loadJobStatuses();
    } catch (error) {
      console.error('Failed to trigger job:', error);
      toast.error(`Fehler beim Ausführen von ${displayName}: ${(error as Error).message}`);
    } finally {
      setTriggeringJob(null);
    }
  };

  const translateCronSchedule = (schedule: string): string => {
    try {
      return cronstrue.toString(schedule, { 
        locale: 'de',
        use24HourTimeFormat: true
      });
    } catch (error) {
      return schedule; // Return original if translation fails
    }
  };

  const getStatusBadge = (job: CronJobStatus) => {
    if (!job.lastRunStatus) {
      return (
        <Badge variant="secondary" className="gap-1">
          <Clock className="w-3 h-3" />
          Wartet
        </Badge>
      );
    }

    if (job.lastRunStatus === 'success') {
      return (
        <Badge variant="default" className="gap-1 bg-green-600 hover:bg-green-700">
          <CheckCircle2 className="w-3 h-3" />
          Erfolg
        </Badge>
      );
    }

    return (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="w-3 h-3" />
        Fehler
      </Badge>
    );
  };

  const getActivityBadge = (job: CronJobStatus) => {
    if (!job.isActive) {
      return (
        <Badge variant="secondary" className="gap-1">
          Inaktiv
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="gap-1 bg-green-50 border-green-200 text-green-700">
        <Activity className="w-3 h-3" />
        Aktiv
      </Badge>
    );
  };

  const formatLastRun = (lastRunAt: string | null) => {
    if (!lastRunAt) {
      return <span className="text-gray-400 text-sm">Noch nicht ausgeführt</span>;
    }

    try {
      const date = new Date(lastRunAt);
      return (
        <div className="text-sm">
          <div>{format(date, 'dd.MM.yyyy', { locale: de })}</div>
          <div className="text-gray-500">{format(date, 'HH:mm:ss', { locale: de })} Uhr</div>
        </div>
      );
    } catch (error) {
      return <span className="text-gray-400 text-sm">Ungültiges Datum</span>;
    }
  };

  const formatDuration = (duration: number | null) => {
    if (duration === null) return '-';
    if (duration < 1000) return `${duration}ms`;
    return `${(duration / 1000).toFixed(2)}s`;
  };

  const getErrorRate = (job: CronJobStatus) => {
    if (job.runCount === 0) return 0;
    return ((job.errorCount / job.runCount) * 100).toFixed(1);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              CRON Job Monitoring
            </CardTitle>
            <CardDescription>
              Übersicht über alle geplanten Hintergrundaufgaben und deren Status
            </CardDescription>
          </div>
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            variant="outline"
            size="sm"
          >
            {refreshing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Aktualisieren
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span>Lade CRON Job Status...</span>
          </div>
        ) : jobs.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Keine CRON Jobs konfiguriert. Die Jobs werden beim Serverstart initialisiert.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[100px]">Aktivität</TableHead>
                  <TableHead className="w-[200px]">Zeitplan</TableHead>
                  <TableHead className="w-[150px]">Letzte Ausführung</TableHead>
                  <TableHead className="w-[80px]">Dauer</TableHead>
                  <TableHead className="w-[100px]">Statistik</TableHead>
                  <TableHead className="w-[100px]">Aktion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{job.displayName}</div>
                        <div className="text-xs text-gray-500 mt-1">{job.description}</div>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(job)}</TableCell>
                    <TableCell>{getActivityBadge(job)}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-xs font-mono text-gray-500">
                          <Calendar className="w-3 h-3" />
                          {job.schedule}
                        </div>
                        <div className="text-xs text-gray-700">
                          {translateCronSchedule(job.schedule)}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{formatLastRun(job.lastRunAt)}</TableCell>
                    <TableCell>
                      <span className="text-sm font-mono">{formatDuration(job.lastRunDuration)}</span>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs space-y-1">
                        <div>Ausführungen: {job.runCount}</div>
                        <div className={job.errorCount > 0 ? 'text-red-600 font-medium' : 'text-gray-500'}>
                          Fehler: {job.errorCount} ({getErrorRate(job)}%)
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTriggerJob(job.jobName, job.displayName)}
                        disabled={triggeringJob === job.jobName || !job.isActive}
                        className="w-full"
                      >
                        {triggeringJob === job.jobName ? (
                          <>
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            <span className="text-xs">Läuft...</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3 mr-1" />
                            <span className="text-xs">Jetzt ausführen</span>
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Error Details */}
            {jobs.some(j => j.lastError) && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  Aktuelle Fehler
                </h3>
                {jobs.filter(j => j.lastError).map((job) => (
                  <Alert key={job.id} variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="font-semibold">{job.displayName}</div>
                      <pre className="text-xs mt-2 overflow-x-auto whitespace-pre-wrap">
                        {job.lastError}
                      </pre>
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
