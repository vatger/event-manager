"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { X, UserPlus, Wand2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  RefreshCw,
  Plus,
  Image,
  FileText,
  ShieldCheck,
  Globe,
  CheckCircle2,
  Clock,
  ExternalLink,
  CircleDot,
  MoreHorizontal,
  Pencil,
  Trash2,
  Hand,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useUser } from "@/hooks/useUser";
import { TaskCreateDialog } from "./_components/TaskCreateDialog";
import { TaskEditDialog } from "./_components/TaskEditDialog";
import { BannerCompleteDialog } from "./_components/BannerCompleteDialog";
import { TaskAssignDialog } from "./_components/TaskAssignDialog";
import type { EventTask, TaskStatus } from "@/types/task";

interface TeamMember {
  cid: number;
  name: string;
  rating: string;
  role: string;
}

interface EventPermissions {
  canEdit: boolean;
  canManageTasks: boolean;
  canBanner: boolean;
  isTeamMember: boolean;
}

const TASK_TYPE_ICONS: Record<string, typeof Image> = {
  CREATE_BANNER: Image,
  CREATE_TEXT: FileText,
  SUBMIT_CLEARING: ShieldCheck,
  REGISTER_MYVATSIM: Globe,
  CUSTOM: CircleDot,
};

export default function EventTasksPage() {
  const params = useParams();
  const eventId = params.id as string;

  const [tasks, setTasks] = useState<EventTask[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editTask, setEditTask] = useState<EventTask | null>(null);
  const [bannerTask, setBannerTask] = useState<EventTask | null>(null);
  const [generating, setGenerating] = useState(false);
  const [assignTask, setAssignTask] = useState<EventTask | null>(null);
  const [checkingMyVatsim, setCheckingMyVatsim] = useState(false);
  const [permissions, setPermissions] = useState<EventPermissions>({
    canEdit: false,
    canManageTasks: false,
    canBanner: false,
    isTeamMember: false,
  });

  const { user } = useUser();
  const currentCID = user?.cid;

  const loadTasks = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/tasks`);
      if (!res.ok) throw new Error("Fehler beim Laden");
      const data = await res.json();
      setTasks(data);
    } catch (error) {
      console.error("Fehler:", error);
      toast.error("Fehler beim Laden der Aufgaben");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  const loadTeamMembers = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/team`);
      if (res.ok) {
        const data = await res.json();
        setTeamMembers(data);
      }
    } catch (error) {
      console.error("Team members load error:", error);
    }
  }, [eventId]);

  const loadPermissions = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/permissions`);
      if (res.ok) {
        const data = await res.json();
        setPermissions(data);
      }
    } catch (error) {
      console.error("Permissions load error:", error);
    }
  }, [eventId]);

  useEffect(() => {
    loadTasks();
    loadTeamMembers();
    loadPermissions();
  }, [loadTasks, loadTeamMembers, loadPermissions]);

  const { canManageTasks, isTeamMember } = permissions;

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/events/${eventId}/tasks/generate`, { method: "POST" });
      if (!res.ok) throw new Error("Fehler beim Generieren");
      const data = await res.json();
      toast.success(`${data.created} Aufgaben erstellt`);
      await loadTasks();
    } catch (error) {
      console.error("Fehler:", error);
      toast.error("Fehler beim Generieren der Aufgaben");
    } finally {
      setGenerating(false);
    }
  };

  const handleToggleDone = async (task: EventTask) => {
    if (task.status === "DONE") {
      await patchTask(task.id, { status: "OPEN" });
      return;
    }
    // myVATSIM tasks: mark as DONE, but show as pending until confirmed
    if (task.type === "REGISTER_MYVATSIM") {
      await patchTask(task.id, { status: "DONE" });
      // Immediately trigger a check
      handleCheckMyVatsim();
      return;
    }
    if (task.type === "CREATE_BANNER") {
      setBannerTask(task);
      return;
    }
    await patchTask(task.id, { status: "DONE" });
  };

  const handleBannerComplete = async (taskId: number, bannerUrl: string) => {
    const payload: Record<string, unknown> = { status: "DONE" };
    if (bannerUrl) payload.bannerUrl = bannerUrl;
    await patchTask(taskId, payload);
    setBannerTask(null);
  };

  const handleReopen = async (task: EventTask) => {
    await patchTask(task.id, { status: "OPEN" });
  };

  const handleClaim = async (task: EventTask) => {
    if (!currentCID) return;
    const payload: Record<string, unknown> = { assigneeCID: currentCID };
    if (task.status === "OPEN") payload.status = "IN_PROGRESS";
    await patchTask(task.id, payload);
  };

  const handleAssign = async (task: EventTask, cid: number | null) => {
    const payload: Record<string, unknown> = { assigneeCID: cid };
    if (cid && task.status === "OPEN") payload.status = "IN_PROGRESS";
    await patchTask(task.id, payload);
  };

  const handleRelease = async (task: EventTask) => {
    await patchTask(task.id, { assigneeCID: null });
  };

  const handleDelete = async (task: EventTask) => {
    if (!confirm(`Aufgabe "${task.title}" wirklich löschen?`)) return;
    try {
      const res = await fetch(`/api/events/${eventId}/tasks/${task.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Fehler beim Löschen");
      }
      toast.success("Aufgabe gelöscht");
      await loadTasks();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Fehler beim Löschen");
    }
  };

  const handleCheckMyVatsim = async () => {
    setCheckingMyVatsim(true);
    try {
      const res = await fetch(`/api/events/${eventId}/tasks/check-myvatsim`, { method: "POST" });
      if (!res.ok) throw new Error("Fehler beim Prüfen");
      const data = await res.json();
      toast.success(data.registered ? "Event ist auf myVATSIM registriert ✓" : "Event noch nicht auf myVATSIM");
      await loadTasks();
    } catch {
      toast.error("Fehler beim Prüfen der myVATSIM-Registrierung");
    } finally {
      setCheckingMyVatsim(false);
    }
  };

  const patchTask = async (taskId: number, data: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/events/${eventId}/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Fehler beim Aktualisieren");
      }
      await loadTasks();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Fehler beim Aktualisieren der Aufgabe");
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const getDeadlineState = (dueDate: string | null, status: TaskStatus) => {
    if (!dueDate || status === "DONE" || status === "SKIPPED") return "normal";
    const due = new Date(dueDate);
    const now = new Date();
    if (due < now) return "overdue";
    const twoDays = 2 * 24 * 60 * 60 * 1000;
    if (due.getTime() - now.getTime() < twoDays) return "approaching";
    return "normal";
  };

  /**
   * myVATSIM tasks have a special "pending" state:
   * The task is marked DONE by the user, but shows as pending
   * until the system confirms via myVATSIM API.
   */
  const isMyVatsimPending = (task: EventTask) => {
    return task.type === "REGISTER_MYVATSIM" && task.status === "DONE" && task.myVatsimRegistered !== true;
  };

  const hasDefaultTasks = tasks.some((t) => t.type !== "CUSTOM");
  const completedCount = tasks.filter((t) => t.status === "DONE" || t.status === "SKIPPED").length;
  const progressPercent = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  // Whether the user can interact with tasks at all (claim, mark done)
  const canInteract = isTeamMember || canManageTasks;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Aufgaben</h2>
            <p className="text-sm text-muted-foreground">
              {completedCount} von {tasks.length} erledigt
            </p>
          </div>
          {canManageTasks && (
            <div className="flex gap-2">
              {!hasDefaultTasks && (
                <Button onClick={handleGenerate} disabled={generating} variant="outline" size="sm">
                  <Wand2 className="h-4 w-4 mr-1.5" />
                  {generating ? "Generiere..." : "Standard-Aufgaben"}
                </Button>
              )}
              <Button onClick={() => setCreateDialogOpen(true)} size="sm">
                <Plus className="h-4 w-4 mr-1.5" />
                Aufgabe
              </Button>
            </div>
          )}
        </div>

        {/* Progress bar */}
        {tasks.length > 0 && (
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-primary h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">{progressPercent}%</span>
          </div>
        )}

        {/* Empty state */}
        {tasks.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <CheckCircle2 className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="font-medium mb-1">Keine Aufgaben</h3>
              <p className="text-sm text-muted-foreground">
                Es wurden noch keine Aufgaben für dieses Event angelegt.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Task list */}
        {tasks.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {tasks.map((task) => {
                    const Icon = TASK_TYPE_ICONS[task.type] || CircleDot;
                    const deadlineState = getDeadlineState(task.dueDate, task.status);
                    const isDone = task.status === "DONE";
                    const isSkipped = task.status === "SKIPPED";
                    const isCompleted = isDone || isSkipped;
                    const isPending = isMyVatsimPending(task);

                    return (
                        <div
                            key={task.id}
                            className={`px-3 sm:px-4 py-2.5 group transition-colors ${
                                isCompleted && !isPending ? "opacity-60" : ""
                            } ${
                                deadlineState === "overdue" ? "bg-destructive/5" : ""
                            } ${
                                deadlineState === "approaching" ? "bg-yellow-50 dark:bg-yellow-950/10" : ""
                            } ${
                                isPending ? "bg-amber-50/50 dark:bg-amber-950/10" : ""
                            }`}
                        >
                          {/* Main row */}
                          <div className="flex items-start gap-2.5 sm:gap-3">
                            {/* Checkbox / Spinner */}
                            <div className="flex-shrink-0 mt-0.5">
                              {isPending ? (
                                  <Button variant="ghost" size="sm" className="h-4 w-4 p-0" onClick={() => handleToggleDone(task)}>
                                    <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
                                  </Button>
                              ) : (
                                  <Checkbox
                                      checked={isDone}
                                      disabled={isSkipped || !canInteract || (!canManageTasks && task.assigneeCID !== currentCID)}
                                      onCheckedChange={() => handleToggleDone(task)}
                                  />
                              )}
                            </div>

                            {/* Type icon */}
                            <div className={`flex-shrink-0 mt-0.5 ${isCompleted && !isPending ? "text-muted-foreground" : "text-primary"}`}>
                              <Icon className="h-4 w-4" />
                            </div>

                            {/* Title + description + meta */}
                            <div className="flex-1 min-w-0">
                              {/* Title line */}
                              <div className="flex items-start gap-2 flex-wrap">
                    <span className={`text-sm leading-5 break-words ${
                        isCompleted && !isPending
                            ? "line-through text-muted-foreground"
                            : "font-medium"
                    }`}>
                      {task.title}
                    </span>
                                {isSkipped && (
                                    <Badge variant="outline" className="text-xs shrink-0 self-start">Übersprungen</Badge>
                                )}
                                {deadlineState === "overdue" && !isCompleted && (
                                    <Badge variant="destructive" className="text-xs shrink-0 self-start">Überfällig</Badge>
                                )}
                              </div>

                              {/* Description */}
                              {task.description && (
                                  <p className={`text-xs text-muted-foreground mt-0.5 line-clamp-2 sm:line-clamp-1 ${
                                      isCompleted && !isPending ? "line-through" : ""
                                  }`}>
                                    {task.description}
                                  </p>
                              )}

                              {/* Meta line — deadline + assignee below title on mobile */}
                              {!isCompleted && (
                                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                    {/* Deadline */}
                                    {task.dueDate && (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                            <span className={`text-xs tabular-nums flex items-center gap-1 ${
                                deadlineState === "overdue"
                                    ? "text-destructive font-medium"
                                    : deadlineState === "approaching"
                                        ? "text-yellow-600 dark:text-yellow-400"
                                        : "text-muted-foreground"
                            }`}>
                              <Clock className="h-3 w-3" />
                              {formatDate(task.dueDate)}
                            </span>
                                          </TooltipTrigger>
                                          <TooltipContent>Deadline</TooltipContent>
                                        </Tooltip>
                                    )}

                                    {/* Assignee / Claim */}
                                    {task.assigneeCID ? (
                                        <Badge variant="secondary" className="text-xs flex items-center gap-1 pr-1">
                                          {task.assignee?.name}
                                          {(canManageTasks || task.assigneeCID === currentCID) && (
                                              <button
                                                  onClick={() => handleRelease(task)}
                                                  className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
                                                  title="Zuweisung aufheben"
                                              >
                                                <X className="h-3 w-3" />
                                              </button>
                                          )}
                                        </Badge>
                                    ) : canInteract && (
                                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleClaim(task)}>
                                          <Hand className="h-3 w-3" />
                                          <span className="hidden md:block ml-1">Übernehmen</span>
                                        </Button>
                                    )}
                                  </div>
                              )}
                            </div>

                            {/* Actions menu */}
                            {canManageTasks && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0 flex-shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity mt-0.5"
                                    >
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {!isCompleted && (
                                        <DropdownMenuItem onClick={() => setAssignTask(task)}>
                                          <UserPlus className="h-4 w-4 mr-2" />Zuweisen
                                        </DropdownMenuItem>
                                    )}
                                    {isCompleted && (
                                        <DropdownMenuItem onClick={() => handleReopen(task)}>
                                          <RefreshCw className="h-4 w-4 mr-2" />Wieder öffnen
                                        </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem onClick={() => setEditTask(task)}>
                                      <Pencil className="h-4 w-4 mr-2" />Bearbeiten
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => handleDelete(task)} className="text-destructive">
                                      <Trash2 className="h-4 w-4 mr-2" />Löschen
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                          </div>

                          {/* myVATSIM inline status */}
                          {task.type === "REGISTER_MYVATSIM" && (
                              <div className="flex items-center gap-2 mt-1.5 ml-[46px] flex-wrap">
                                {task.myVatsimRegistered === true && task.status === "DONE" && (
                                    <Badge variant="default" className="text-xs bg-green-600">
                                      <CheckCircle2 className="h-3 w-3 mr-1" />myVATSIM bestätigt
                                    </Badge>
                                )}
                                {task.myVatsimRegistered === false && task.status !== "DONE" && task.status !== "SKIPPED" && (
                                    <Badge variant="destructive" className="text-xs">
                                      <AlertTriangle className="h-3 w-3 mr-1" />Nicht in myVATSIM
                                    </Badge>
                                )}
                                {isPending && (
                                    <Badge variant="outline" className="text-xs border-amber-500 text-amber-700 dark:text-amber-400">
                                      <AlertTriangle className="h-3 w-3 mr-1" />Noch nicht in myVATSIM erkannt
                                    </Badge>
                                )}
                                {canInteract && (
                                    <Button variant="ghost" size="sm" className="h-5 text-xs px-1.5" onClick={handleCheckMyVatsim} disabled={checkingMyVatsim}>
                                      <RefreshCw className={`h-3 w-3 mr-1 ${checkingMyVatsim ? "animate-spin" : ""}`} />Status prüfen
                                    </Button>
                                )}
                                <a href="https://my.vatsim.net/events/admin" target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-0.5">
                                  <ExternalLink className="h-3 w-3" />Admin
                                </a>
                              </div>
                          )}
                        </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
        )}

        {/* Dialogs */}
        <TaskCreateDialog
          eventId={eventId}
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onCreated={loadTasks}
        />
        {editTask && (
          <TaskEditDialog
            eventId={eventId}
            task={editTask}
            open={!!editTask}
            onOpenChange={(open) => { if (!open) setEditTask(null); }}
            onUpdated={loadTasks}
          />
        )}
        {bannerTask && (
          <BannerCompleteDialog
            open={!!bannerTask}
            onOpenChange={(open) => { if (!open) setBannerTask(null); }}
            onComplete={(url) => handleBannerComplete(bannerTask.id, url)}
          />
        )}
        {assignTask && (
          <TaskAssignDialog
            open={!!assignTask}
            onOpenChange={(open) => { if (!open) setAssignTask(null); }}
            teamMembers={teamMembers}
            onAssign={(cid) => { handleAssign(assignTask, cid); setAssignTask(null); }}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
