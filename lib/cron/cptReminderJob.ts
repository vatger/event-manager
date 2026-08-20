import prisma from "@/lib/prisma";
import { fetchTrainingCpts, syncCptSnapshot, type TrainingCpt } from "@/lib/cpt/cptService";
import { CPT_FIR_NAMES, resolveCptFir } from "@/config/cptFirMapping";
import { parseCptDate } from "@/lib/cpt/cptDate";

const VATGER_API_TOKEN = process.env.VATGER_API_TOKEN;

/** Wie viele Tage vor dem CPT die Vorab-Erinnerung rausgeht. */
const LEAD_DAYS = 3;

interface ReminderTarget {
  cid: number;
  name: string;
  emailNotificationsEnabled: boolean | null;
}

/** Kalendertage zwischen heute und dem CPT – Uhrzeit spielt keine Rolle. */
function daysUntil(date: Date, now: Date): number {
  const a = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const b = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.round((b - a) / 86_400_000);
}

function formatCptDate(date: Date): string {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatCptTime(date: Date): string {
  return `${date.toISOString().slice(11, 16)}z`;
}

/**
 * Empfänger einer FIR: die eingetragenen CPT-Verantwortlichen. Ist für eine
 * FIR niemand hinterlegt, geht die Erinnerung ersatzweise an die FIR-Leitung,
 * damit CPTs nicht unbemerkt liegenbleiben.
 */
async function resolveTargets(firCode: string): Promise<ReminderTarget[]> {
  const responsibles = await prisma.cptResponsible.findMany({
    where: { firCode },
    include: {
      user: { select: { cid: true, name: true, emailNotificationsEnabled: true } },
    },
  });

  const targets = responsibles
    .map((r) => r.user)
    .filter((u): u is ReminderTarget => !!u);

  if (targets.length > 0) return targets;

  const leadGroups = await prisma.group.findMany({
    where: { kind: "FIR_LEITUNG", fir: { code: firCode } },
    include: {
      members: {
        include: {
          user: { select: { cid: true, name: true, emailNotificationsEnabled: true } },
        },
      },
    },
  });

  const fallback = new Map<number, ReminderTarget>();
  for (const group of leadGroups) {
    for (const member of group.members) {
      if (member.user) fallback.set(member.user.cid, member.user);
    }
  }
  return [...fallback.values()];
}

/** In-App-Benachrichtigung plus Forums-Ping (bzw. E-Mail, je nach Einstellung). */
async function notify(
  target: ReminderTarget,
  title: string,
  message: string
): Promise<void> {
  await prisma.notification.create({
    data: {
      userCID: target.cid,
      type: "EVENT",
      title,
      message,
    },
  });

  if (!VATGER_API_TOKEN || !process.env.VATGER_API) return;

  const isEmailNotif = target.emailNotificationsEnabled ?? false;
  await fetch(`${process.env.VATGER_API}/${target.cid}/send_notification`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${VATGER_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title,
      message,
      source_name: "Eventsystem",
      link_text: "CPT Manager öffnen",
      link_url: `${process.env.NEXTAUTH_URL}/admin/cpts`,
      // Ohne ausdrücklich aktivierte E-Mail-Benachrichtigung landet der
      // Hinweis als Ping im Forum.
      ...(isEmailNotif ? {} : { via: "board.ping" }),
    }),
  });
}

async function remindLeadTime(
  cpt: TrainingCpt,
  firCode: string,
  cptDate: Date,
  daysLeft: number
) {
  const firName = CPT_FIR_NAMES[firCode] ?? firCode;
  const title = `CPT bewerben – ${cpt.position}`;
  // Ein CPT kann auch kurzfristig angesetzt werden – dann stimmt „in 3 Tagen"
  // nicht mehr, und die Erinnerung nennt den tatsächlichen Vorlauf.
  const when = daysLeft === 1 ? "Morgen" : `In ${daysLeft} Tagen`;
  const message =
    `${when} findet das CPT von ${cpt.trainee_name} auf ${cpt.position} statt ` +
    `(${formatCptDate(cptDate)}, ${formatCptTime(cptDate)}, ${firName}). ` +
    `Bitte bewirb das CPT im Forum und markiere es anschließend im CPT Manager als gepostet.`;

  const targets = await resolveTargets(firCode);
  for (const target of targets) {
    await notify(target, title, message);
  }
  return targets.length;
}

async function remindSameDay(cpt: TrainingCpt, firCode: string, cptDate: Date) {
  const firName = CPT_FIR_NAMES[firCode] ?? firCode;
  const title = `CPT heute noch nicht beworben – ${cpt.position}`;
  const message =
    `Das CPT von ${cpt.trainee_name} auf ${cpt.position} findet heute um ${formatCptTime(cptDate)} statt ` +
    `(${firName}), ist im CPT Manager aber noch nicht als gepostet markiert. ` +
    `Bitte prüfe, ob die Bewerbung im Forum rausgegangen ist.`;

  const targets = await resolveTargets(firCode);
  for (const target of targets) {
    await notify(target, title, message);
  }
  return targets.length;
}

/**
 * Cron-Job für die CPT-Bewerbung.
 *
 * Zwei Stufen, jede geht pro CPT genau einmal raus:
 *  1. {@link LEAD_DAYS} Tage vorher: Erinnerung an die Verantwortlichen der FIR.
 *  2. Am Tag des CPTs: Nachfassen, solange es nicht als gepostet markiert ist.
 *
 * Nebenbei hält der Job den lokalen Snapshot (Termin, Position, Trainee)
 * aktuell; verschiebt sich ein Termin, wird erneut erinnert.
 */
export async function checkCptReminders() {
  if (!prisma) {
    console.log("[CPT Reminder] Prisma not available, skipping");
    return { checked: 0, leadTime: 0, sameDay: 0 };
  }

  let cpts: TrainingCpt[];
  try {
    cpts = await fetchTrainingCpts(0);
  } catch (error) {
    console.error("[CPT Reminder] Training-API nicht erreichbar:", error);
    throw error;
  }

  const now = new Date();
  let leadTimeSent = 0;
  let sameDaySent = 0;
  let checked = 0;

  for (const cpt of cpts) {
    const cptDate = parseCptDate(cpt.date);
    if (isNaN(cptDate.getTime())) continue;

    const diff = daysUntil(cptDate, now);
    // Vergangene CPTs und alles jenseits des Vorlaufs interessieren nicht.
    if (diff < 0 || diff > LEAD_DAYS) continue;

    const firCode = resolveCptFir(cpt.position);
    if (!firCode) {
      console.warn(`[CPT Reminder] Keine FIR für Position ${cpt.position} (CPT ${cpt.id})`);
      continue;
    }

    checked++;

    // Snapshot pflegen – setzt die Marker zurück, wenn der Termin verschoben wurde
    const status = await syncCptSnapshot(cpt);

    try {
      // Ist schon gepostet, braucht es keine Erinnerung mehr – der Marker
      // wird trotzdem gesetzt, damit die Stufe später nicht nachfeuert.
      if (diff > 0 && !status.reminder3dSentAt && !status.posted) {
        const count = await remindLeadTime(cpt, firCode, cptDate, diff);
        await prisma.cptStatus.update({
          where: { cptId: cpt.id },
          data: { reminder3dSentAt: new Date() },
        });
        leadTimeSent += count;
        console.log(
          `[CPT Reminder] Vorab-Erinnerung für CPT ${cpt.id} (${cpt.position}) an ${count} Verantwortliche`
        );
      }

      if (diff === 0 && !status.posted && !status.reminderDaySentAt) {
        const count = await remindSameDay(cpt, firCode, cptDate);
        await prisma.cptStatus.update({
          where: { cptId: cpt.id },
          data: { reminderDaySentAt: new Date() },
        });
        sameDaySent += count;
        console.log(
          `[CPT Reminder] Tages-Erinnerung für CPT ${cpt.id} (${cpt.position}) an ${count} Verantwortliche`
        );
      }
    } catch (error) {
      console.error(`[CPT Reminder] Fehler bei CPT ${cpt.id}:`, error);
    }
  }

  console.log(
    `[CPT Reminder] ${checked} anstehende CPTs geprüft – ${leadTimeSent} Vorab-, ${sameDaySent} Tages-Erinnerungen`
  );
  return { checked, leadTime: leadTimeSent, sameDay: sameDaySent };
}
