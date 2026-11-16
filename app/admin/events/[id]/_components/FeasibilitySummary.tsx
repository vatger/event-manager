"use client";

import { cn } from "@/lib/utils";
import { formatDuration, minuteToHM } from "@/lib/roster/rosterTime";
import type { FeasibilityGroup, FeasibilityReport } from "@/lib/roster/autoRoster";

/**
 * Geht der Plan mit den Anmeldungen auf – und wo wird es eng?
 *
 * Kurz gehalten: ein Urteil, darunter nur die Besetzungsgruppen und
 * Zeiträume, um die man sich kümmern muss. Gezeigt auf der Anmeldungsseite
 * und im Auto-Roster-Dialog.
 */

const TONE = {
  ok: "border-success-700",
  tight: "border-warning-700",
  insufficient: "border-danger-700",
} as const;

const GROUP_STATUS: Record<FeasibilityGroup["status"], { label: string; className: string }> = {
  short: { label: "fehlt", className: "text-danger-700 dark:text-danger-300" },
  tight: { label: "knapp", className: "text-warning-900 dark:text-warning-300" },
  ok: { label: "ok", className: "text-success-800 dark:text-success-300" },
};

function headline(report: FeasibilityReport): string {
  if (report.demandMinutes === 0) return "Keine offenen Stationszeiten";
  if (report.verdict === "ok") return "Geht auf";
  if (report.verdict === "tight") return "Knapp – wenig Reserve";
  const pct = Math.round((report.coverableMinutes / report.demandMinutes) * 100);
  return pct < 100 ? `Reicht nicht – ${pct} % besetzbar` : "Reicht nicht – zu wenig Zeit für Pausen";
}

function groupReason(group: FeasibilityGroup, eventStart: Date): string {
  if (group.gapMinutes > 0) return `${formatDuration(group.gapMinutes)} unbesetzbar`;
  const first = group.noReserveRanges[0];
  if (group.status === "tight" && first) {
    const more = group.noReserveRanges.length > 1 ? " …" : "";
    return `ohne Reserve ${minuteToHM(eventStart, first.start)}–${minuteToHM(eventStart, first.end)}z${more}`;
  }
  return group.ratio !== null ? `Lotsenzeit ${Math.round(group.ratio * 100)} % des Bedarfs` : "";
}

export function FeasibilitySummary({
  report,
  eventStart,
  maxGaps = 4,
  className,
}: {
  report: FeasibilityReport;
  eventStart: Date;
  /** So viele unbesetzbare Zeiträume stehen in der Liste, der Rest wird gezählt */
  maxGaps?: number;
  className?: string;
}) {
  const problems = report.groups.filter((g) => g.status !== "ok");
  const shownGaps = report.gaps.slice(0, maxGaps);
  const hiddenGaps = report.gaps.length - shownGaps.length;
  // Fehlt es nur über alle Ebenen zusammen, nennt keine Gruppe den Grund
  const onlyCumulative = report.verdict === "insufficient" && !problems.some((g) => g.status === "short");

  return (
    <div className={cn("space-y-3 border-l-4 pl-3", TONE[report.verdict], className)}>
      <p className="text-sm font-medium">{headline(report)}</p>

      {problems.length > 0 && (
        <ul className="space-y-1 text-sm">
          {problems.map((g) => (
            <li key={g.key} className="flex flex-wrap gap-x-2" title={g.callsigns.join(", ")}>
              <span className="w-24 shrink-0 font-medium">{g.label}</span>
              <span className={GROUP_STATUS[g.status].className}>{GROUP_STATUS[g.status].label}</span>
              <span className="text-muted-foreground">{groupReason(g, eventStart)}</span>
            </li>
          ))}
        </ul>
      )}

      {onlyCumulative &&
        report.shortfalls.map((s) => (
          <p key={s.levels.join("+")} className="text-sm text-muted-foreground">
            {s.levels.join(" + ")}: mit Pausen fehlen rund {formatDuration(s.missingMinutes)}
          </p>
        ))}

      {shownGaps.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm font-medium">Unbesetzbar</p>
          <ul className="space-y-1 text-sm">
            {shownGaps.map((g) => (
              <li key={`${g.stationId}-${g.start}`} className="flex flex-wrap gap-x-2">
                <span className="font-mono">{g.callsign}</span>
                <span className="tabular-nums">
                  {minuteToHM(eventStart, g.start)}–{minuteToHM(eventStart, g.end)}z
                </span>
                <span className="text-muted-foreground">
                  {g.reason === "no_candidate" ? "niemand frei" : "Lotsen woanders gebraucht"}
                </span>
              </li>
            ))}
          </ul>
          {hiddenGaps > 0 && <p className="text-sm text-muted-foreground">+ {hiddenGaps} weitere</p>}
        </div>
      )}

      {report.unusableCids.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {report.unusableCids.length === 1
            ? "1 Anmeldung passt auf keine Station"
            : `${report.unusableCids.length} Anmeldungen passen auf keine Station`}
        </p>
      )}
    </div>
  );
}
