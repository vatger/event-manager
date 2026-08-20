import { prisma } from "@/lib/prisma";
import { getUserWithEffectiveData } from "@/lib/acl/policies";
import { isVatgerEventleitung } from "@/lib/acl/permissions";
import { resolveCptFir } from "@/config/cptFirMapping";
import { parseCptDate } from "./cptDate";

/** Rohdatensatz, wie ihn die Training-API liefert. */
export interface TrainingCpt {
  id: number;
  trainee_vatsim_id: number;
  trainee_name: string;
  examiner_vatsim_id: number;
  examiner_name: string;
  local_vatsim_id: number;
  local_name: string;
  course_name: string;
  position: string;
  date: string;
  confirmed: boolean;
}

/** Lokaler Arbeitsstand, angehängt an einen CPT der Training-API. */
export interface CptStatusPayload {
  posted: boolean;
  postedAt: string | null;
  postedByCID: number | null;
  postedByName: string | null;
  forumUrl: string | null;
  notes: string | null;
}

/** Ein CPT samt aufgelöster FIR und lokalem Arbeitsstand. */
export type CptWithStatus = TrainingCpt & {
  firCode: string | null;
  status: CptStatusPayload;
};

const EMPTY_STATUS: CptStatusPayload = {
  posted: false,
  postedAt: null,
  postedByCID: null,
  postedByName: null,
  forumUrl: null,
  notes: null,
};

/**
 * Holt die CPT-Liste aus der Training-API.
 * Wirft, wenn die Konfiguration fehlt oder die API nicht antwortet – die
 * Aufrufer entscheiden, ob sie das als Fehler melden oder still überspringen.
 */
export async function fetchTrainingCpts(revalidateSeconds = 60): Promise<TrainingCpt[]> {
  const bearerToken = process.env.TRAINING_API_TOKEN;
  const trainingCptUrl = process.env.TRAINING_API_CPTS_URL;

  if (!bearerToken || !trainingCptUrl) {
    throw new Error("TRAINING_API_TOKEN oder TRAINING_API_CPTS_URL ist nicht gesetzt");
  }

  const response = await fetch(trainingCptUrl, {
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      "Content-Type": "application/json",
    },
    next: { revalidate: revalidateSeconds },
  });

  if (!response.ok) {
    throw new Error(`Training-API antwortete mit ${response.status}`);
  }

  const payload = await response.json();
  // Die API liefert je nach Version { data: [...] } oder direkt ein Array.
  const list = Array.isArray(payload) ? payload : payload?.data;
  return Array.isArray(list) ? (list as TrainingCpt[]) : [];
}

/**
 * Reichert CPTs um FIR-Zuordnung und lokalen Arbeitsstand an und hält dabei
 * den Snapshot in der Datenbank aktuell (Termin/Position/Trainee). Verschiebt
 * sich ein Termin, werden die Erinnerungsmarker zurückgesetzt, damit für den
 * neuen Termin erneut erinnert wird.
 */
export async function attachCptStatus(cpts: TrainingCpt[]): Promise<CptWithStatus[]> {
  if (cpts.length === 0) return [];

  const ids = cpts.map((c) => c.id);
  const rows = await prisma.cptStatus.findMany({ where: { cptId: { in: ids } } });
  const byCptId = new Map(rows.map((r) => [r.cptId, r]));

  const postedByCids = [...new Set(rows.map((r) => r.postedByCID).filter((c): c is number => !!c))];
  const users = postedByCids.length
    ? await prisma.user.findMany({
        where: { cid: { in: postedByCids } },
        select: { cid: true, name: true },
      })
    : [];
  const nameByCid = new Map(users.map((u) => [u.cid, u.name]));

  return cpts.map((cpt) => {
    const row = byCptId.get(cpt.id);
    return {
      ...cpt,
      firCode: resolveCptFir(cpt.position),
      status: row
        ? {
            posted: row.posted,
            postedAt: row.postedAt?.toISOString() ?? null,
            postedByCID: row.postedByCID,
            postedByName: row.postedByCID ? nameByCid.get(row.postedByCID) ?? null : null,
            forumUrl: row.forumUrl,
            notes: row.notes,
          }
        : { ...EMPTY_STATUS },
    };
  });
}

/**
 * Schreibt Position/Trainee/Termin eines CPTs in den lokalen Snapshot.
 * Ändert sich der Termin, gelten bereits verschickte Erinnerungen nicht mehr.
 */
export async function syncCptSnapshot(cpt: TrainingCpt) {
  const cptDate = parseCptDate(cpt.date);
  const firCode = resolveCptFir(cpt.position);
  const existing = await prisma.cptStatus.findUnique({ where: { cptId: cpt.id } });

  const dateChanged =
    !!existing?.cptDate && existing.cptDate.getTime() !== cptDate.getTime();

  if (!existing) {
    return prisma.cptStatus.create({
      data: {
        cptId: cpt.id,
        firCode,
        position: cpt.position,
        traineeName: cpt.trainee_name,
        cptDate,
      },
    });
  }

  return prisma.cptStatus.update({
    where: { cptId: cpt.id },
    data: {
      firCode,
      position: cpt.position,
      traineeName: cpt.trainee_name,
      cptDate,
      ...(dateChanged ? { reminder3dSentAt: null, reminderDaySentAt: null } : {}),
    },
  });
}

/**
 * Darf der Nutzer den Arbeitsstand der CPTs einer FIR pflegen
 * (gepostet markieren, Notiz und Forumslink setzen)?
 *
 * Erlaubt für VATGER-Leitung, FIR-Team/-Leitung der jeweiligen FIR sowie für
 * alle, die dort ausdrücklich als CPT-Verantwortliche eingetragen sind.
 */
export async function canManageCptStatus(cid: number, firCode: string): Promise<boolean> {
  if (await isVatgerEventleitung(cid)) return true;

  const user = await getUserWithEffectiveData(cid);
  if (!user) return false;
  if (user.effectivePermissions.includes("*")) return true;
  if (user.firLevels?.[firCode]) return true;
  if (user.firScopedPermissions?.[firCode]?.includes("event.edit")) return true;

  const entry = await prisma.cptResponsible.findUnique({
    where: { firCode_userCID: { firCode, userCID: cid } },
  });
  return !!entry;
}

/**
 * Darf der Nutzer die Verantwortlichen einer FIR pflegen?
 * Enger gefasst als {@link canManageCptStatus}: nur Leitungsebene.
 */
export async function canManageCptResponsibles(cid: number, firCode: string): Promise<boolean> {
  if (await isVatgerEventleitung(cid)) return true;

  const user = await getUserWithEffectiveData(cid);
  if (!user) return false;
  if (user.effectivePermissions.includes("*")) return true;
  if (user.firLevels?.[firCode] === "FIR_EVENTLEITER") return true;
  return (
    user.firScopedPermissions?.[firCode]?.includes("fir.manage") ||
    user.firScopedPermissions?.[firCode]?.includes("event.edit") ||
    false
  );
}
