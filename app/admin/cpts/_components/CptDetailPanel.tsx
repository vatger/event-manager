"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardCopy,
  Clock,
  ExternalLink,
  GraduationCap,
  ImageIcon,
  Link2,
  Loader2,
  MapPin,
  Megaphone,
  StickyNote,
  User,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CPT_FIR_NAMES } from "@/config/cptFirMapping";
import type { CptEntry, CptStatus } from "../_lib/cptTypes";
import {
  bannerUrl,
  formatDateLong,
  formatTimeZulu,
  forumSnippet,
  isUrgent,
  relativeDay,
  STATION_GROUP_CLASS,
  stationGroupOf,
} from "../_lib/cptUtils";

interface CptDetailPanelProps {
  cpt: CptEntry;
  canEdit: boolean;
  onClose: () => void;
  onPatch: (cptId: number, patch: Partial<Pick<CptStatus, "posted" | "forumUrl" | "notes">>) => Promise<void>;
}

/** Eine Zeile „Beschriftung – Wert" mit Symbol. */
function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof User;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="font-medium break-words">{children}</div>
      </div>
    </div>
  );
}

/**
 * Seitenleiste mit allen Angaben zu einem CPT und den Feldern, die das
 * Eventteam pflegt: Forumslink, Notiz und die gepostet-Markierung.
 */
export function CptDetailPanel({ cpt, canEdit, onClose, onPatch }: CptDetailPanelProps) {
  const [forumUrl, setForumUrl] = useState(cpt.status.forumUrl ?? "");
  const [notes, setNotes] = useState(cpt.status.notes ?? "");
  const [saving, setSaving] = useState(false);
  const banner = bannerUrl(cpt);
  const urgent = isUrgent(cpt);

  // Beim Wechsel auf ein anderes CPT die Felder neu füllen, damit keine
  // Eingaben aus dem vorherigen Datensatz stehenbleiben.
  useEffect(() => {
    setForumUrl(cpt.status.forumUrl ?? "");
    setNotes(cpt.status.notes ?? "");
  }, [cpt.id, cpt.status.forumUrl, cpt.status.notes]);

  const dirty =
    forumUrl !== (cpt.status.forumUrl ?? "") || notes !== (cpt.status.notes ?? "");

  // Fehler meldet bereits der Aufrufer per Toast – hier wird nur verhindert,
  // dass die abgelehnte Zusage als unbehandelt in der Konsole landet.
  const save = async () => {
    setSaving(true);
    try {
      await onPatch(cpt.id, { forumUrl, notes });
      toast.success("Gespeichert");
    } catch {
      /* bereits gemeldet */
    } finally {
      setSaving(false);
    }
  };

  const togglePosted = async () => {
    setSaving(true);
    try {
      await onPatch(cpt.id, { posted: !cpt.status.posted });
    } catch {
      /* bereits gemeldet */
    } finally {
      setSaving(false);
    }
  };

  const copySnippet = async () => {
    try {
      await navigator.clipboard.writeText(forumSnippet(cpt));
      toast.success("Textvorschlag kopiert");
    } catch {
      toast.error("Kopieren nicht möglich");
    }
  };

  return (
    <aside className="flex h-full w-full flex-col overflow-hidden rounded-xl border bg-card">
      <header className="flex items-start justify-between gap-2 border-b px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{cpt.course_name}</p>
          <h3 className="truncate text-lg font-semibold">{cpt.trainee_name}</h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onClose}
          aria-label="Seitenleiste schließen"
        >
          <X className="h-4 w-4" />
        </Button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "rounded-md border px-2 py-0.5 font-mono text-xs font-semibold",
              STATION_GROUP_CLASS[stationGroupOf(cpt.position)]
            )}
          >
            {cpt.position}
          </span>
          <Badge variant="outline">{relativeDay(cpt.date)}</Badge>
          {cpt.firCode && (
            <Badge variant="outline">{CPT_FIR_NAMES[cpt.firCode] ?? cpt.firCode}</Badge>
          )}
          <Badge
            variant="outline"
            className={
              cpt.confirmed
                ? "border-success-300 text-success-700 dark:text-success-400"
                : "border-warning-300 text-warning-700 dark:text-warning-400"
            }
          >
            {cpt.confirmed ? "Bestätigt" : "Ausstehend"}
          </Badge>
          {urgent && (
            <Badge className="bg-danger-600 text-white hover:bg-danger-700">
              Dringend
            </Badge>
          )}
        </div>

        <div className="grid gap-3">
          <DetailRow icon={CalendarDays} label="Termin">
            {formatDateLong(cpt.date)}
          </DetailRow>
          <DetailRow icon={Clock} label="Uhrzeit">
            {formatTimeZulu(cpt.date)}
          </DetailRow>
          <DetailRow icon={MapPin} label="Position">
            {cpt.position}
          </DetailRow>
          <DetailRow icon={GraduationCap} label="Trainee">
            {cpt.trainee_name}{" "}
            <span className="font-normal text-muted-foreground">
              ({cpt.trainee_vatsim_id})
            </span>
          </DetailRow>
          <DetailRow icon={User} label="Prüfer (ATD)">
            {cpt.examiner_name}{" "}
            <span className="font-normal text-muted-foreground">
              ({cpt.examiner_vatsim_id})
            </span>
          </DetailRow>
          <DetailRow icon={User} label="Mentor">
            {cpt.local_name}{" "}
            <span className="font-normal text-muted-foreground">
              ({cpt.local_vatsim_id})
            </span>
          </DetailRow>
        </div>

        <Separator />

        {/* Bewerbung: der eigentliche Zweck des Managers */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-accent-500" />
            <h4 className="text-sm font-semibold">Bewerbung im Forum</h4>
          </div>

          <Button
            variant={cpt.status.posted ? "outline" : "default"}
            className={cn(
              "w-full justify-center",
              cpt.status.posted &&
                "border-success-400 text-success-700 dark:text-success-400"
            )}
            onClick={togglePosted}
            disabled={!canEdit || saving}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-2" />
            )}
            {cpt.status.posted ? "Als gepostet markiert" : "Als gepostet markieren"}
          </Button>

          {cpt.status.posted && cpt.status.postedAt && (
            <p className="text-xs text-muted-foreground">
              Markiert am{" "}
              {new Intl.DateTimeFormat("de-DE", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(cpt.status.postedAt))}
              {cpt.status.postedByName ? ` von ${cpt.status.postedByName}` : ""}
            </p>
          )}

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground" htmlFor="cpt-forum-url">
              Link zum Forumsbeitrag
            </label>
            <div className="flex gap-2">
              <Input
                id="cpt-forum-url"
                placeholder="https://vatsim-germany.org/…"
                value={forumUrl}
                onChange={(e) => setForumUrl(e.target.value)}
                disabled={!canEdit}
              />
              {cpt.status.forumUrl && (
                <Button variant="outline" size="icon" asChild className="shrink-0">
                  <a
                    href={cpt.status.forumUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Forumsbeitrag öffnen"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground" htmlFor="cpt-notes">
              <StickyNote className="mr-1 inline h-3 w-3" />
              Interne Notiz
            </label>
            <Textarea
              id="cpt-notes"
              rows={3}
              placeholder="z. B. Banner fehlt noch, Rückfrage an ATD …"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={!canEdit}
            />
          </div>

          {canEdit && (
            <Button onClick={save} disabled={!dirty || saving} className="w-full">
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4 mr-2" />
              )}
              Link &amp; Notiz speichern
            </Button>
          )}
        </div>

        <Separator />

        <div className="grid gap-2">
          <Button variant="outline" onClick={copySnippet} className="justify-start">
            <ClipboardCopy className="h-4 w-4 mr-2" />
            Textvorschlag kopieren
          </Button>
          {banner && (
            <Button variant="outline" asChild className="justify-start">
              <a href={banner} target="_blank" rel="noopener noreferrer">
                <ImageIcon className="h-4 w-4 mr-2" />
                Banner erzeugen
              </a>
            </Button>
          )}
        </div>
      </div>
    </aside>
  );
}
