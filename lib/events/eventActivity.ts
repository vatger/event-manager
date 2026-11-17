import { prisma } from "@/lib/prisma";
import {
  describeEventChanges,
  type ActivityCategory,
  type ActivityDraft,
} from "./eventActivityFormat";

/**
 * Änderungsprotokoll der Event-Verwaltung: wer hat wann was am Event getan.
 *
 * Protokollieren darf nie den eigentlichen Vorgang scheitern lassen – eine
 * gespeicherte Änderung ohne Eintrag ist ärgerlich, eine abgebrochene
 * Änderung wegen eines Protokollfehlers wäre schlimmer.
 */

export interface EventActivityInput {
  eventId: number;
  actorCID: number | null;
  category: ActivityCategory;
  action: string;
  summary: string;
  details?: Record<string, unknown> | null;
}

export async function logEventActivity(input: EventActivityInput): Promise<void> {
  await logEventActivities([input]);
}

export async function logEventActivities(entries: EventActivityInput[]): Promise<void> {
  if (entries.length === 0) return;
  try {
    await prisma.eventActivity.createMany({
      data: entries.map((e) => ({
        eventId: e.eventId,
        actorCID: e.actorCID,
        category: e.category,
        action: e.action,
        summary: e.summary,
        details: (e.details ?? undefined) as never,
      })),
    });
  } catch (err) {
    console.error("[EventActivity] Eintrag konnte nicht geschrieben werden:", err);
  }
}

/** Änderungen am Event (Formular oder Einzelaktion) als Einträge je Bereich */
export async function logEventChanges(
  eventId: number,
  actorCID: number | null,
  before: Record<string, unknown>,
  after: Record<string, unknown>
): Promise<void> {
  const drafts: ActivityDraft[] = describeEventChanges(before, after);
  await logEventActivities(drafts.map((d) => ({ eventId, actorCID, ...d })));
}

/** Namen mehrerer CIDs auf einmal, für Einträge über andere Personen */
export async function userName(cid: number): Promise<string | null> {
  try {
    const user = await prisma.user.findUnique({ where: { cid }, select: { name: true } });
    return user?.name ?? null;
  } catch {
    return null;
  }
}
