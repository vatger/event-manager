import { prisma } from "@/lib/prisma";

/**
 * Änderungsprotokoll des Besetzungsplans.
 *
 * Der Rückgängig-Stapel liegt im Browser und endet mit der Sitzung. Für die
 * Frage „wer hat das wann geändert?" braucht es eine Spur, die bleibt – gerade
 * weil an einem Plan mehrere Leute gleichzeitig arbeiten und man hinterher
 * wissen will, wessen Änderung die eigene überschrieben hat.
 *
 * Der Klartext entsteht beim Schreiben und wird später nicht neu gebildet:
 * Stationen lassen sich entfernen, Anmeldungen zurückziehen, Namen ändern
 * sich. Das Protokoll soll zeigen, was damals galt, nicht was heute gilt.
 *
 * Protokollieren darf nie den eigentlichen Vorgang scheitern lassen – eine
 * gespeicherte Änderung ohne Protokolleintrag ist ärgerlich, eine abgebrochene
 * Änderung wegen eines Protokollfehlers wäre schlimmer.
 */

export type RosterActivityAction =
  | "assignment_created"
  | "assignment_moved"
  | "assignment_resized"
  | "assignment_reassigned"
  | "assignment_recolored"
  | "assignment_deleted"
  | "assignment_swapped"
  | "stations_changed"
  | "slot_changed"
  | "roster_published"
  | "roster_reset"
  | "snapshot_restored"
  | "editor_added"
  | "editor_removed"
  | "note_changed"
  | "flag_changed"
  | "briefing_changed";

interface LogInput {
  rosterId: number;
  actorCID: number | null;
  action: RosterActivityAction;
  summary: string;
  stationCallsign?: string | null;
  targetCID?: number | null;
  details?: Record<string, unknown> | null;
}

export async function logRosterActivity(input: LogInput): Promise<void> {
  try {
    await prisma.eventRosterActivity.create({
      data: {
        rosterId: input.rosterId,
        actorCID: input.actorCID,
        action: input.action,
        summary: input.summary,
        stationCallsign: input.stationCallsign ?? null,
        targetCID: input.targetCID ?? null,
        details: (input.details ?? undefined) as never,
      },
    });
  } catch (err) {
    console.error("[RosterActivity] Eintrag konnte nicht geschrieben werden:", err);
  }
}

/** Mehrere Einträge auf einmal – etwa beim Ändern der Stationsliste */
export async function logRosterActivities(entries: LogInput[]): Promise<void> {
  if (entries.length === 0) return;
  try {
    await prisma.eventRosterActivity.createMany({
      data: entries.map((e) => ({
        rosterId: e.rosterId,
        actorCID: e.actorCID,
        action: e.action,
        summary: e.summary,
        stationCallsign: e.stationCallsign ?? null,
        targetCID: e.targetCID ?? null,
        details: (e.details ?? undefined) as never,
      })),
    });
  } catch (err) {
    console.error("[RosterActivity] Einträge konnten nicht geschrieben werden:", err);
  }
}

// ---------------------------------------------------------------------------
// Formulierungen
// ---------------------------------------------------------------------------

/** Uhrzeit einer Schicht, wie sie im Plan steht */
export function hhmm(date: Date): string {
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(
    date.getUTCMinutes()
  ).padStart(2, "0")}`;
}

export function timeRange(start: Date, end: Date): string {
  return `${hhmm(start)}–${hhmm(end)}z`;
}

/**
 * Wie heißt die Person im Protokoll?
 *
 * Der Name wird mitgeschrieben, damit ein Eintrag auch dann lesbar bleibt,
 * wenn die Anmeldung später verschwindet. Ohne Namen bleibt die CID – besser
 * eine Nummer als „unbekannt".
 */
export function personLabel(name: string | null | undefined, cid: number | null): string {
  if (name && name.trim()) return name;
  return cid ? `CID ${cid}` : "jemand";
}

/** Bezeichnung eines Blocks: Person oder Custom-Beschriftung */
export function blockLabel(
  type: string,
  name: string | null | undefined,
  cid: number | null,
  label: string | null
): string {
  return type === "custom" ? label ?? "Sonstiges" : personLabel(name, cid);
}

/** Namen mehrerer CIDs auf einmal – für Einträge mit zwei Beteiligten */
export async function userNames(cids: number[]): Promise<Map<number, string>> {
  const unique = [...new Set(cids.filter((c): c is number => typeof c === "number"))];
  if (unique.length === 0) return new Map();
  try {
    const users = await prisma.user.findMany({
      where: { cid: { in: unique } },
      select: { cid: true, name: true },
    });
    return new Map(users.map((u) => [u.cid, u.name]));
  } catch {
    return new Map();
  }
}

/** Name einer einzelnen CID */
export async function userName(cid: number | null | undefined): Promise<string | null> {
  if (!cid) return null;
  return (await userNames([cid])).get(cid) ?? null;
}
