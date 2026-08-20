"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Circle,
  ExternalLink,
  ImageIcon,
  Loader2,
  StickyNote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CptEntry } from "../_lib/cptTypes";
import {
  bannerUrl,
  formatDateShort,
  formatTimeZulu,
  isUrgent,
  relativeDay,
  STATION_GROUP_CLASS,
  stationGroupOf,
} from "../_lib/cptUtils";

interface CptRowProps {
  cpt: CptEntry;
  selected: boolean;
  canEdit: boolean;
  busy: boolean;
  onSelect: () => void;
  onTogglePosted: () => void;
}

/**
 * Eine CPT-Zeile der Liste.
 *
 * Der farbige Streifen links trägt den Status: rot solange ein CPT in den
 * nächsten Tagen ansteht und nicht beworben ist, grün sobald es gepostet
 * wurde. So sieht das Eventteam beim Überfliegen, wo es hakt.
 */
export function CptRow({
  cpt,
  selected,
  canEdit,
  busy,
  onSelect,
  onTogglePosted,
}: CptRowProps) {
  const urgent = isUrgent(cpt);
  const banner = bannerUrl(cpt);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "group grid cursor-pointer grid-cols-[4px_minmax(0,1fr)_auto] items-center gap-x-3 border-b px-0 py-2.5 transition-colors last:border-b-0 hover:bg-muted/50 sm:grid-cols-[4px_7.5rem_minmax(0,1fr)_auto]",
        selected && "bg-accent/60"
      )}
    >
      {/* Statusstreifen */}
      <span
        aria-hidden
        className={cn(
          "h-9 w-1 rounded-full",
          cpt.status.posted
            ? "bg-success-500"
            : urgent
              ? "bg-danger-500"
              : "bg-warning-400"
        )}
      />

      {/* Termin */}
      <div className="min-w-0 pl-1 sm:pl-0">
        <p className="text-sm font-semibold tabular-nums">
          {formatDateShort(cpt.date)}
          <span className="ml-1.5 font-mono text-xs font-normal text-muted-foreground">
            {formatTimeZulu(cpt.date)}
          </span>
        </p>
        <p
          className={cn(
            "text-xs",
            urgent ? "font-medium text-danger-600" : "text-muted-foreground"
          )}
        >
          {relativeDay(cpt.date)}
        </p>
      </div>

      {/* Trainee und Position */}
      <div className="col-span-2 min-w-0 pl-1 sm:col-span-1 sm:pl-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "rounded border px-1.5 py-0.5 font-mono text-[11px] font-semibold",
              STATION_GROUP_CLASS[stationGroupOf(cpt.position)]
            )}
          >
            {cpt.position}
          </span>
          <span className="truncate text-sm font-medium">{cpt.trainee_name}</span>
          {!cpt.confirmed && (
            <Badge
              variant="outline"
              className="border-warning-300 text-[10px] text-warning-700 dark:text-warning-400"
            >
              unbestätigt
            </Badge>
          )}
          {cpt.status.notes && (
            <StickyNote
              className="h-3.5 w-3.5 text-muted-foreground"
              aria-label="Notiz hinterlegt"
            />
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {cpt.course_name} · ATD {cpt.examiner_name} · Mentor {cpt.local_name}
        </p>
      </div>

      {/* Aktionen */}
      <div
        className="col-span-3 flex items-center justify-end gap-1 pr-1 sm:col-span-1"
        onClick={(e) => e.stopPropagation()}
      >
        {cpt.status.forumUrl && (
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
            <a
              href={cpt.status.forumUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Forumsbeitrag öffnen"
              title="Forumsbeitrag öffnen"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        )}
        {banner && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            asChild
          >
            <a
              href={banner}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Banner erzeugen"
              title="Banner erzeugen"
            >
              <ImageIcon className="h-4 w-4" />
            </a>
          </Button>
        )}
        <Button
          variant={cpt.status.posted ? "outline" : "secondary"}
          size="sm"
          className={cn(
            "h-8 gap-1.5",
            cpt.status.posted &&
              "border-success-400 text-success-700 dark:text-success-400"
          )}
          onClick={onTogglePosted}
          disabled={!canEdit || busy}
          title={
            canEdit
              ? cpt.status.posted
                ? "Markierung zurücknehmen"
                : "Als im Forum gepostet markieren"
              : "Keine Berechtigung für diese FIR"
          }
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : cpt.status.posted ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <Circle className="h-3.5 w-3.5" />
          )}
          <span className="hidden sm:inline">
            {cpt.status.posted ? "Gepostet" : "Posten"}
          </span>
        </Button>
      </div>
    </div>
  );
}
