"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  Bell,
  ChevronDown,
  ClipboardList,
  History,
  ImageIcon,
  Loader2,
  Send,
  Settings2,
  UserCog,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getAvatarColor } from "@/utils/getAvatarColor";
import { useEventCapabilities } from "@/hooks/useEventCapabilities";
import { missingRightMessage } from "@/lib/events/eventCapabilities";
import {
  ACTIVITY_CATEGORIES,
  personLabel,
  type ActivityCategory,
  type FieldChange,
} from "@/lib/events/eventActivityFormat";

interface ActivityEntry {
  id: number;
  category: ActivityCategory;
  action: string;
  summary: string;
  details: { changes?: FieldChange[]; message?: string } | null;
  actorCID: number | null;
  actorName: string | null;
  createdAt: string;
}

interface ActivityResponse {
  entries: ActivityEntry[];
  actors: Array<{ cid: number; name: string | null }>;
  hasMore: boolean;
}

/** Symbol je Bereich – erspart das Lesen, wenn man nur sucht */
const CATEGORY_ICON: Record<ActivityCategory, typeof Settings2> = {
  details: Settings2,
  banner: ImageIcon,
  signups: Users,
  roster: Send,
  team: UserCog,
  tasks: ClipboardList,
  communication: Bell,
};

const CATEGORY_LABEL = Object.fromEntries(ACTIVITY_CATEGORIES.map((c) => [c.id, c.label])) as Record<
  ActivityCategory,
  string
>;

function dayLabel(date: Date): string {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(date, today)) return "Heute";
  if (same(date, yesterday)) return "Gestern";
  return date.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

function EntryDetails({ details }: { details: NonNullable<ActivityEntry["details"]> }) {
  return (
    <div className="mt-2 space-y-2 rounded-lg bg-muted/60 p-3 text-sm">
      {details.changes && details.changes.length > 0 && (
        <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[8rem_minmax(0,1fr)]">
          {details.changes.map((change) => (
            <div key={change.field} className="contents">
              <dt className="text-xs font-medium text-muted-foreground sm:pt-0.5">{change.label}</dt>
              <dd className="min-w-0 break-words">
                <span className="text-muted-foreground line-through decoration-muted-foreground/50">
                  {change.before}
                </span>
                <span className="mx-1.5 text-muted-foreground">→</span>
                <span className="font-medium">{change.after}</span>
              </dd>
            </div>
          ))}
        </dl>
      )}
      {details.message && (
        <p className="whitespace-pre-wrap break-words text-muted-foreground">{details.message}</p>
      )}
    </div>
  );
}

function Entry({ entry }: { entry: ActivityEntry }) {
  const [open, setOpen] = useState(false);
  const Icon = CATEGORY_ICON[entry.category] ?? History;
  const hasDetails =
    !!entry.details && ((entry.details.changes?.length ?? 0) > 0 || !!entry.details.message);
  const actor = personLabel(entry.actorName, entry.actorCID);

  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {/* Zeitleiste */}
      <span aria-hidden className="absolute left-[15px] top-8 bottom-0 w-px bg-border group-last:hidden" />
      <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-card">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </span>

      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-sm font-medium">{entry.summary}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded-full text-[0.5rem] font-semibold text-white",
                getAvatarColor(actor)
              )}
            >
              {initials(actor)}
            </span>
            {actor}
          </span>
          <span aria-hidden>·</span>
          <time dateTime={entry.createdAt}>{timeOf(entry.createdAt)}</time>
          <span aria-hidden>·</span>
          <span>{CATEGORY_LABEL[entry.category] ?? entry.category}</span>
          {hasDetails && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="inline-flex items-center gap-0.5 font-medium text-foreground hover:underline"
            >
              {open ? "Weniger" : "Details"}
              <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
            </button>
          )}
        </p>
        {open && entry.details && <EntryDetails details={entry.details} />}
      </div>
    </li>
  );
}

export default function EventActivityPage() {
  const params = useParams();
  const eventId = String(params.id);
  const { capabilities, loading: capabilitiesLoading } = useEventCapabilities(eventId);

  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [actors, setActors] = useState<ActivityResponse["actors"]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<ActivityCategory | "all">("all");
  const [actor, setActor] = useState<string>("all");

  const load = useCallback(
    async (before?: number) => {
      const query = new URLSearchParams();
      if (before) query.set("before", String(before));
      if (category !== "all") query.set("category", category);
      if (actor !== "all") query.set("actor", actor);
      const res = await fetch(`/api/events/${eventId}/activity?${query}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Der Verlauf konnte nicht geladen werden.");
      return data as ActivityResponse;
    },
    [eventId, category, actor]
  );

  useEffect(() => {
    if (capabilitiesLoading || !capabilities.viewLog) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    load()
      .then((data) => {
        if (cancelled) return;
        setEntries(data.entries);
        setActors(data.actors);
        setHasMore(data.hasMore);
      })
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [load, capabilitiesLoading, capabilities.viewLog]);

  const loadMore = async () => {
    const oldest = entries[entries.length - 1];
    if (!oldest) return;
    setLoadingMore(true);
    try {
      const data = await load(oldest.id);
      setEntries((current) => [...current, ...data.entries]);
      setHasMore(data.hasMore);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Der Verlauf konnte nicht geladen werden.");
    } finally {
      setLoadingMore(false);
    }
  };

  const days = useMemo(() => {
    const groups: Array<{ label: string; entries: ActivityEntry[] }> = [];
    for (const entry of entries) {
      const label = dayLabel(new Date(entry.createdAt));
      const last = groups[groups.length - 1];
      if (last?.label === label) last.entries.push(entry);
      else groups.push({ label, entries: [entry] });
    }
    return groups;
  }, [entries]);

  if (!capabilitiesLoading && !capabilities.viewLog) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <h1 className="text-xl font-semibold">Kein Zugriff</h1>
        <p className="mt-2 text-muted-foreground">{missingRightMessage("viewLog")}</p>
      </div>
    );
  }

  const filtered = category !== "all" || actor !== "all";

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Verlauf</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Wer hat wann was an diesem Event geändert. Änderungen am Besetzungsplan stehen im
            Protokoll des Roster-Editors.
          </p>
        </div>
        <Select value={actor} onValueChange={setActor}>
          <SelectTrigger className="w-full bg-card sm:w-56" aria-label="Nach Person filtern">
            <SelectValue placeholder="Alle Personen" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Personen</SelectItem>
            {actors.map((a) => (
              <SelectItem key={a.cid} value={String(a.cid)}>
                {personLabel(a.name, a.cid)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>

      {/* Bereichsfilter */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Nach Bereich filtern">
        {[{ id: "all" as const, label: "Alles" }, ...ACTIVITY_CATEGORIES].map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id)}
            aria-pressed={category === c.id}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-sm transition-colors",
              category === c.id
                ? "border-accent-500 bg-card font-medium text-foreground ring-1 ring-accent-500/40"
                : "bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-4 sm:p-6">
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : loading || capabilitiesLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="py-10 text-center">
              <History className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 font-medium">
                {filtered ? "Nichts passend zum Filter" : "Noch keine Einträge"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {filtered
                  ? "Wähle einen anderen Bereich oder eine andere Person."
                  : "Sobald jemand das Event ändert, steht es hier."}
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {days.map((day) => (
                <section key={day.label}>
                  <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {day.label}
                  </h2>
                  <ol className="[&>li:last-child>span:first-child]:hidden">
                    {day.entries.map((entry) => (
                      <Entry key={entry.id} entry={entry} />
                    ))}
                  </ol>
                </section>
              ))}
              {hasMore && (
                <div className="text-center">
                  <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                    {loadingMore && <Loader2 className="animate-spin" />}
                    Ältere Einträge laden
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
