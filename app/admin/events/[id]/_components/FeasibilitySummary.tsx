"use client";

import { AlertTriangle, CheckCircle2, CircleAlert, UserX } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDuration, minuteToHM } from "@/lib/roster/rosterTime";
import type { FeasibilityGroup, FeasibilityReport } from "@/lib/roster/autoRoster";

/**
 * Ergebnis der Machbarkeitsprüfung: Geht der Plan mit den Anmeldungen auf,
 * und wenn nicht – wo genau und warum?
 *
 * Wird im Auto-Roster-Dialog und auf der Anmeldungsseite gezeigt, damit
 * Engpässe schon während der Anmeldephase auffallen.
 */

const VERDICT_STYLE = {
  ok: {
    icon: CheckCircle2,
    box: "border-success-300 bg-success-50/60 dark:bg-success-900/10",
    text: "text-success-800 dark:text-success-300",
  },
  tight: {
    icon: AlertTriangle,
    box: "border-amber-500/40 bg-amber-500/5",
    text: "text-amber-700 dark:text-amber-300",
  },
  insufficient: {
    icon: CircleAlert,
    box: "border-danger-600/40 bg-danger-600/5",
    text: "text-danger-700 dark:text-danger-300",
  },
} as const;

const GROUP_STATUS = {
  short: { dot: "bg-danger-600", label: "fehlt", text: "text-danger-700 dark:text-danger-300" },
  tight: { dot: "bg-amber-500", label: "knapp", text: "text-amber-700 dark:text-amber-300" },
  ok: { dot: "bg-success-600", label: "ok", text: "text-success-800 dark:text-success-300" },
} as const;

/** Was an einer engen Gruppe das Problem ist – kurz, für eine Zeile */
function groupDetail(group: FeasibilityGroup, eventStart: Date): string {
  const parts: string[] = [];
  if (group.gapMinutes > 0) parts.push(`${formatDuration(group.gapMinutes)} unbesetzbar`);
  if (group.ratio !== null && (group.ratio < 1.2 || group.status === "short")) {
    parts.push(`Lotsenzeit ${Math.round(group.ratio * 100)} % des Bedarfs`);
  }
  if (group.noReserveRanges.length > 0) {
    const ranges = group.noReserveRanges
      .slice(0, 2)
      .map((r) => `${minuteToHM(eventStart, r.start)}–${minuteToHM(eventStart, r.end)}z`)
      .join(", ");
    const more = group.noReserveRanges.length > 2 ? " …" : "";
    parts.push(`keine Reserve ${ranges}${more}`);
  }
  return parts.join(" · ");
}

/**
 * Besetzungsgruppen, in denen es eng ist oder werden kann. Gruppen ohne
 * Engpass stehen nur als kurze Liste darunter.
 */
function GroupList({ groups, eventStart }: { groups: FeasibilityGroup[]; eventStart: Date }) {
  const critical = groups.filter((g) => g.status !== "ok");
  const fine = groups.filter((g) => g.status === "ok");
  if (critical.length === 0) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium">Besetzungsgruppen mit Engpass</p>
      <ul className="space-y-1 text-xs">
        {critical.map((g) => {
          const st = GROUP_STATUS[g.status];
          return (
            <li
              key={g.key}
              className="flex flex-wrap items-baseline gap-x-2 rounded border bg-background/60 px-2 py-1"
              title={g.callsigns.join(", ")}
            >
              <span className={cn("inline-block h-2 w-2 shrink-0 rounded-full self-center", st.dot)} />
              <span className="font-medium">{g.label}</span>
              <span className={cn("font-medium", st.text)}>{st.label}</span>
              <span className="text-muted-foreground">{groupDetail(g, eventStart)}</span>
            </li>
          );
        })}
      </ul>
      {fine.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Ohne Engpass: {fine.map((g) => g.label).join(", ")}
        </p>
      )}
    </div>
  );
}

export function verdictHeadline(report: FeasibilityReport): string {
  if (report.demandMinutes === 0) return "Keine offenen Stationszeiten";
  const pct = Math.round((report.coverableMinutes / report.demandMinutes) * 100);
  if (report.verdict === "ok") return "Geht auf – alle offenen Stationszeiten lassen sich besetzen";
  if (report.verdict === "tight") {
    return "Knapp – rechnerisch reicht es, aber mit wenig Reserve";
  }
  if (report.gaps.length === 0) {
    return "Geht nicht auf – mit Pausen reicht die Lotsenzeit nicht";
  }
  return `Geht nicht auf – höchstens ${pct} % der offenen Stationszeit besetzbar`;
}

export function FeasibilitySummary({
  report,
  eventStart,
  maxGaps = 8,
  className,
}: {
  report: FeasibilityReport;
  eventStart: Date;
  /** So viele Engpässe stehen in der Liste, der Rest wird gezählt */
  maxGaps?: number;
  className?: string;
}) {
  const style = VERDICT_STYLE[report.verdict];
  const Icon = style.icon;
  const shownGaps = report.gaps.slice(0, maxGaps);
  const hiddenGaps = report.gaps.length - shownGaps.length;

  return (
    <div className={cn("rounded-lg border p-3 space-y-2", style.box, className)}>
      <p className={cn("flex items-start gap-2 text-sm font-medium", style.text)}>
        <Icon className="h-4 w-4 mt-0.5 shrink-0" />
        <span>{verdictHeadline(report)}</span>
      </p>

      {report.demandMinutes > 0 && (
        <p className="text-xs text-muted-foreground">
          Offen: {formatDuration(report.demandMinutes)} Stationszeit · besetzbar höchstens{" "}
          {formatDuration(report.coverableMinutes)}
          {report.capacityRatio !== null && (
            <> · Lotsenzeit mit Pausen: {Math.round(report.capacityRatio * 100)} % des Bedarfs</>
          )}
        </p>
      )}

      <GroupList groups={report.groups} eventStart={eventStart} />

      {shownGaps.length > 0 && (
        <ul className="space-y-1 text-xs">
          {shownGaps.map((g) => (
            <li
              key={`${g.stationId}-${g.start}`}
              className="flex flex-wrap items-baseline gap-x-2 rounded border bg-background/60 px-2 py-1"
            >
              <span className="font-mono font-medium">{g.callsign}</span>
              <span className="tabular-nums">
                {minuteToHM(eventStart, g.start)}–{minuteToHM(eventStart, g.end)}z
              </span>
              <span className="text-muted-foreground">
                {g.reason === "no_candidate"
                  ? "niemand mit Freigabe verfügbar"
                  : `${g.candidates} geeignet, aber auf höher priorisierten Stationen gebraucht`}
              </span>
            </li>
          ))}
          {hiddenGaps > 0 && (
            <li className="text-muted-foreground px-2">+ {hiddenGaps} weitere Engpässe</li>
          )}
        </ul>
      )}

      {report.shortfalls.length > 0 && (
        <ul className="space-y-1 text-xs">
          {report.shortfalls.map((s) => (
            <li key={s.levels.join("+")} className="rounded border bg-background/60 px-2 py-1">
              <span className="font-medium">{s.levels.join(" + ")}:</span> Bedarf{" "}
              {formatDuration(s.demandMinutes)}, mit Pausenregel höchstens{" "}
              {formatDuration(s.supplyMinutes)} – es fehlen rund{" "}
              {formatDuration(s.missingMinutes)}
            </li>
          ))}
        </ul>
      )}

      {report.unusableCids.length > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <UserX className="h-3.5 w-3.5" />
          {report.unusableCids.length === 1
            ? "1 Anmeldung kann keine der Stationen besetzen"
            : `${report.unusableCids.length} Anmeldungen können keine der Stationen besetzen`}
        </p>
      )}
    </div>
  );
}
