"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RefreshCw,
  Clock,
  CheckCircle2,
  Image,
  FileText,
  ShieldCheck,
  Globe,
  CircleDot,
  ExternalLink,
  CalendarDays,
  Hand,
  Loader2,
  AlertTriangle,
  X,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useUser } from "@/hooks/useUser";
import type { EventTask, TaskStatus } from "@/types/task";
import { BannerCompleteDialog } from "@/app/admin/events/[id]/tasks/_components/BannerCompleteDialog";

const TASK_TYPE_ICONS: Record<string, typeof Image> = {
  CREATE_BANNER: Image,
  CREATE_TEXT: FileText,
  SUBMIT_CLEARING: ShieldCheck,
  REGISTER_MYVATSIM: Globe,
  CUSTOM: CircleDot,
};

interface TasksResponse {
  myTasks: EventTask[];
  allTasks: EventTask[];
}

export default function MyTasksPage() {
  const [data, setData] = useState<TasksResponse>({ myTasks: [], allTasks: [] });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("mine");
  const [bannerTask, setBannerTask] = useState<EventTask | null>(null);
  // Filters for "all" tab
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "done">("all");
  const [assignFilter, setAssignFilter] = useState<"all" | "assigned" | "unassigned">("all");
  // FIR filter for "all" tab
  const [firFilter, setFirFilter] = useState<string | null>(null);
  const [availableFirs, setAvailableFirs] = useState<{ code: string; name: string }[]>([]);

  const { user } = useUser();
  const currentCID = user?.cid;

  // Determine the default FIR: use the user's own FIR if available.
  // VATGER leads without a FIR may pick from a selector.
  useEffect(() => {
    if (!user) return;
    if (user.fir?.code) {
      setFirFilter(user.fir.code);
    }
    if (user.effectiveLevel === "VATGER_LEITUNG" || user.effectiveLevel === "MAIN_ADMIN") {
      // Load available FIRs for the selector
      fetch("/api/firs")
        .then((r) => r.json())
        .then((firs: { code: string; name: string }[]) => setAvailableFirs(firs))
        .catch(() => {/* ignore */});
    }
  }, [user]);

  const loadTasks = useCallback(async () => {
    try {
      const params = new URLSearchParams({ view: tab });
      if (tab === "all" && firFilter) params.set("firCode", firFilter);
      const res = await fetch(`/api/tasks/my?${params.toString()}`);
      if (!res.ok) throw new Error("Fehler beim Laden");
      const result = await res.json();
      setData(result);
    } catch (error) {
      console.error("Fehler:", error);
      toast.error("Fehler beim Laden der Aufgaben");
    } finally {
      setLoading(false);
    }
  }, [tab, firFilter]);

  useEffect(() => {
    setLoading(true);
    loadTasks();
  }, [loadTasks]);

  const patchTask = async (eventId: number, taskId: number, patchData: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/events/${eventId}/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchData),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Fehler");
      }
      await loadTasks();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Fehler beim Aktualisieren");
    }
  };

  const handleClaim = async (task: EventTask) => {
    if (!currentCID || !task.event) return;
    const payload: Record<string, unknown> = { assigneeCID: currentCID };
    if (task.status === "OPEN") payload.status = "IN_PROGRESS";
    await patchTask(task.event.id, task.id, payload);
  };

  const handleRelease = async (task: EventTask) => {
    if (!task.event) return;
    await patchTask(task.event.id, task.id, { assigneeCID: null });
  };

  const handleToggleDone = async (task: EventTask) => {
    if (!task.event) return;
    if (task.status === "DONE") {
      await patchTask(task.event.id, task.id, { status: "OPEN" });
      return;
    }
    if (task.type === "REGISTER_MYVATSIM") {
      await patchTask(task.event.id, task.id, { status: "DONE" });
      return;
    }
    if (task.type === "CREATE_BANNER") {
      setBannerTask(task);
      return;
    }
    await patchTask(task.event.id, task.id, { status: "DONE" });
  };

  const handleBannerComplete = async (taskId: number, bannerUrl: string) => {
    if (!bannerTask?.event) return;
    const payload: Record<string, unknown> = { status: "DONE" };
    if (bannerUrl) payload.bannerUrl = bannerUrl;
    await patchTask(bannerTask.event.id, taskId, payload);
    setBannerTask(null);
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

  const isMyVatsimPending = (task: EventTask) => {
    return task.type === "REGISTER_MYVATSIM" && task.status === "DONE" && task.myVatsimRegistered !== true;
  };

  // Filter allTasks based on selected filters
  const filteredAllTasks = useMemo(() => {
    let tasks = data.allTasks;
    if (statusFilter === "open") {
      tasks = tasks.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS");
    } else if (statusFilter === "done") {
      tasks = tasks.filter((t) => t.status === "DONE" || t.status === "SKIPPED");
    }
    if (assignFilter === "assigned") {
      tasks = tasks.filter((t) => t.assigneeCID !== null);
    } else if (assignFilter === "unassigned") {
      tasks = tasks.filter((t) => t.assigneeCID === null);
    }
    return tasks;
  }, [data.allTasks, statusFilter, assignFilter]);

  // Group tasks by event
  const groupByEvent = (tasks: EventTask[]) => {
    const groups: Record<number, { event: EventTask["event"]; tasks: EventTask[] }> = {};
    for (const task of tasks) {
      if (!task.event) continue;
      if (!groups[task.event.id]) {
        groups[task.event.id] = { event: task.event, tasks: [] };
      }
      groups[task.event.id].tasks.push(task);
    }
    return Object.values(groups);
  };

  const TaskRow = ({ task }: { task: EventTask }) => {
    const Icon = TASK_TYPE_ICONS[task.type] || CircleDot;
    const deadlineState = getDeadlineState(task.dueDate, task.status);
    const isDone = task.status === "DONE";
    const isSkipped = task.status === "SKIPPED";
    const isCompleted = isDone || isSkipped;
    const isPending = isMyVatsimPending(task);
    const isAssignedToMe = task.assigneeCID === currentCID;

    return (
        <div
            className={`px-3 py-2.5 sm:px-4 group transition-colors ${
                isCompleted && !isPending ? "opacity-50" : ""
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
                      disabled={isSkipped || !isAssignedToMe}
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
                    <Badge variant="outline" className="text-xs shrink-0 self-start">
                      Übersprungen
                    </Badge>
                )}
              </div>

              {/* Description */}
              {task.description && !isCompleted && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 sm:line-clamp-1">
                    {task.description}
                  </p>
              )}

              {/* Meta line — deadline + assignee/claim stacked below on mobile */}
              {!isCompleted && (
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {/* Deadline */}
                    {task.dueDate && (
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
                    )}

                    {/* Assignee / Claim */}
                    {isAssignedToMe ? (
                        <Badge variant="secondary" className="text-xs flex items-center gap-1 pr-1">
                          {task.assignee?.name}
                          <button
                              onClick={() => handleRelease(task)}
                              className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
                              title="Zuweisung aufheben"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                    ) : !task.assigneeCID ? (
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleClaim(task)}
                        >
                          <Hand className="h-3 w-3" />
                          <span className="hidden md:block ml-1">Übernehmen</span>
                        </Button>
                    ) : (
                        <span className="text-xs text-muted-foreground">
                    {task.assignee?.name}
                  </span>
                    )}

                    {/* External link */}
                    {task.event && (
                        <Link
                            href={`/admin/events/${task.event.id}/tasks`}
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                    )}
                  </div>
              )}
            </div>
          </div>

          {/* myVATSIM pending note */}
          {task.type === "REGISTER_MYVATSIM" && isPending && (
              <div className="flex items-center gap-2 mt-1.5 ml-[46px]">
                <Badge variant="outline" className="text-xs border-amber-500 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Noch nicht in myVATSIM erkannt
                </Badge>
              </div>
          )}
        </div>
    );
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Aufgabenübersicht</h1>
        <p className="text-sm text-muted-foreground">
          Deine zugewiesenen Aufgaben und alle Event-Aufgaben
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="mine">
            Meine Aufgaben
            {data.myTasks.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {data.myTasks.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="all">
            Alle Aufgaben
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mine" className="space-y-4 mt-4">
          {data.myTasks.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                  <CheckCircle2 className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="font-medium mb-1">Keine offenen Aufgaben</h3>
                <p className="text-sm text-muted-foreground">
                  Dir sind aktuell keine offenen Aufgaben zugewiesen.
                </p>
              </CardContent>
            </Card>
          ) : (
            groupByEvent(data.myTasks).map((group) => (
              <Card key={group.event?.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <CalendarDays className="h-4 w-4" />
                      {group.event?.name}
                    </CardTitle>
                    {group.event && (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {formatDate(group.event.startTime)}
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {group.tasks.map((task) => (
                      <TaskRow key={task.id} task={task} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="all" className="space-y-4 mt-4">
          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* FIR selector: only shown for VATGER leads / MAIN_ADMINs without a fixed FIR */}
            {(user?.effectiveLevel === "VATGER_LEITUNG" || user?.effectiveLevel === "MAIN_ADMIN") && (
              <Select
                value={firFilter ?? "ALL"}
                onValueChange={(v) => setFirFilter(v === "ALL" ? null : v)}
              >
                <SelectTrigger className="w-[100px] h-8 text-xs">
                  <SelectValue placeholder="FIR auswählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Alle FIRs</SelectItem>
                  {availableFirs.map((f) => (
                    <SelectItem key={f.code} value={f.code}>{f.code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}  
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "all" | "open" | "done")}>
              <SelectTrigger className="w-[100px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="open">Offen</SelectItem>
                <SelectItem value="done">Erledigt</SelectItem>
              </SelectContent>
            </Select>
            <Select value={assignFilter} onValueChange={(v) => setAssignFilter(v as "all" | "assigned" | "unassigned")}>
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Zuweisungen</SelectItem>
                <SelectItem value="assigned">Zugewiesen</SelectItem>
                <SelectItem value="unassigned">Nicht zugewiesen</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredAllTasks.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                  <CheckCircle2 className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="font-medium mb-1">Keine Aufgaben</h3>
                <p className="text-sm text-muted-foreground">
                  Keine Aufgaben mit den gewählten Filtern gefunden.
                </p>
              </CardContent>
            </Card>
          ) : (
            groupByEvent(filteredAllTasks).map((group) => (
              <Card key={group.event?.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <CalendarDays className="h-4 w-4" />
                      {group.event?.name}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {group.event?.firCode && (
                        <Badge variant="outline" className="text-xs">{group.event.firCode}</Badge>
                      )}
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {group.event ? formatDate(group.event.startTime) : ""}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {group.tasks.map((task) => (
                      <TaskRow key={task.id} task={task} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Banner complete dialog */}
      {bannerTask && (
        <BannerCompleteDialog
          open={!!bannerTask}
          onOpenChange={(open) => { if (!open) setBannerTask(null); }}
          onComplete={(url) => handleBannerComplete(bannerTask.id, url)}
        />
      )}
    </div>
  );
}
