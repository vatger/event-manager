import { parseCptDate } from "@/lib/cpt/cptDate";
import type { CptEntry } from "./cptTypes";

export { parseCptDate };

/** Ab wie vielen Tagen Vorlauf ein unbeworbenes CPT als dringend gilt. */
export const URGENT_DAYS = 3;

/** Alle Zeiten werden in Zulu angezeigt – so stehen sie auch im Forum. */
const UTC = "UTC";

/** Kalendertage bis zum CPT; negativ, wenn es vorbei ist. */
export function daysUntil(dateString: string, now: Date = new Date()): number {
  const date = parseCptDate(dateString);
  const a = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const b = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.round((b - a) / 86_400_000);
}

export function isUpcoming(cpt: CptEntry, now: Date = new Date()): boolean {
  return parseCptDate(cpt.date).getTime() > now.getTime();
}

/**
 * Dringend sind anstehende CPTs innerhalb des Vorlaufs, die noch nicht
 * beworben wurden – genau die, an die der Cron-Job erinnert.
 */
export function isUrgent(cpt: CptEntry, now: Date = new Date()): boolean {
  if (cpt.status.posted) return false;
  if (!isUpcoming(cpt, now)) return false;
  return daysUntil(cpt.date, now) <= URGENT_DAYS;
}

/** „Heute" / „Morgen" / „In 5 Tagen" / „Vor 2 Tagen" */
export function relativeDay(dateString: string, now: Date = new Date()): string {
  const diff = daysUntil(dateString, now);
  if (diff === 0) return "Heute";
  if (diff === 1) return "Morgen";
  if (diff === -1) return "Gestern";
  if (diff < 0) return `Vor ${Math.abs(diff)} Tagen`;
  return `In ${diff} Tagen`;
}

export function formatDateLong(dateString: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: UTC,
  }).format(parseCptDate(dateString));
}

export function formatDateShort(dateString: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    timeZone: UTC,
  }).format(parseCptDate(dateString));
}

/** Zulu-Uhrzeit, wie sie im Forum steht (z. B. „1800z"). */
export function formatTimeZulu(dateString: string): string {
  return `${parseCptDate(dateString).toISOString().slice(11, 16)}z`;
}

/** ISO-Datum (YYYY-MM-DD) für den Banner-Generator. */
export function formatDateIso(dateString: string): string {
  return parseCptDate(dateString).toISOString().slice(0, 10);
}

/**
 * Zeitliche Schublade eines CPTs. Gibt der Liste dieselbe Gliederung, die
 * das Eventteam ohnehin im Kopf hat: Was ist sofort dran, was diese Woche?
 */
export type CptBucket = "today" | "tomorrow" | "week" | "later" | "past";

export const BUCKET_LABELS: Record<CptBucket, string> = {
  today: "Heute",
  tomorrow: "Morgen",
  week: "Diese Woche",
  later: "Später",
  past: "Vergangen",
};

export function bucketOf(cpt: CptEntry, now: Date = new Date()): CptBucket {
  const diff = daysUntil(cpt.date, now);
  if (diff < 0) return "past";
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff <= 7) return "week";
  return "later";
}

/** Reihenfolge, in der die Gruppen erscheinen. */
export const BUCKET_ORDER: CptBucket[] = ["today", "tomorrow", "week", "later"];

/**
 * Banner-Vorlage einer Position. Nur für die Positionen hinterlegt, für die
 * es im Generator auch eine Vorlage gibt – sonst gibt es keinen Banner-Link.
 */
export function getBannerTemplate(position: string): string | null {
  if (position === "EDDM_TWR") return "EDDMTWR";
  if (position === "EDDM_APP") return "APP";
  if (position === "EDDN_TWR") return "EDDNTWR";
  if (/^EDMM_[A-Z]+_CTR$/.test(position)) return "CTR";
  return null;
}

/** URL des vorbefüllten Banners, oder "" wenn es keine Vorlage gibt. */
export function bannerUrl(cpt: CptEntry): string {
  const template = getBannerTemplate(cpt.position);
  if (!template) return "";
  const params = new URLSearchParams({
    template,
    name: cpt.trainee_name,
    date: formatDateIso(cpt.date),
    time: formatTimeZulu(cpt.date).replace("z", ""),
  });
  return `/api/cpt-banner/generate/?${params.toString()}`;
}

/** Stationsgruppe einer Position – färbt die Positions-Plakette ein. */
export function stationGroupOf(position: string): "TWR" | "APP" | "CTR" | "GND" | "DEL" | "NONE" {
  const upper = position.toUpperCase();
  if (upper.endsWith("_CTR")) return "CTR";
  if (upper.endsWith("_APP") || upper.endsWith("_DEP")) return "APP";
  if (upper.endsWith("_TWR")) return "TWR";
  if (upper.endsWith("_GND")) return "GND";
  if (upper.endsWith("_DEL")) return "DEL";
  return "NONE";
}

export const STATION_GROUP_CLASS: Record<
  ReturnType<typeof stationGroupOf>,
  string
> = {
  DEL: "bg-station-del-soft text-station-del-text border-station-del/40",
  GND: "bg-station-gnd-soft text-station-gnd-text border-station-gnd/40",
  TWR: "bg-station-twr-soft text-station-twr-text border-station-twr/40",
  APP: "bg-station-app-soft text-station-app-text border-station-app/40",
  CTR: "bg-station-ctr-soft text-station-ctr-text border-station-ctr/40",
  NONE: "bg-station-none-soft text-station-none-text border-station-none/40",
};

/**
 * Vorschlag für den Forumsbeitrag. Spart dem Eventteam das Zusammensuchen
 * von Datum, Uhrzeit und Position aus drei verschiedenen Feldern.
 */
export function forumSnippet(cpt: CptEntry): string {
  return [
    `${cpt.course_name} – CPT ${cpt.position}`,
    "",
    `Am ${formatDateLong(cpt.date)} um ${formatTimeZulu(cpt.date)} stellt sich ${cpt.trainee_name} auf ${cpt.position} der Prüfung.`,
    "Kommt vorbei und unterstützt mit ein paar Bewegungen!",
    "",
    `Prüfer: ${cpt.examiner_name}`,
    `Mentor: ${cpt.local_name}`,
  ].join("\n");
}

/** Freitextsuche über Trainee, Position, Kurs, Prüfer, Mentor und CIDs. */
export function matchesQuery(cpt: CptEntry, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [
    cpt.trainee_name,
    cpt.position,
    cpt.course_name,
    cpt.examiner_name,
    cpt.local_name,
    String(cpt.trainee_vatsim_id),
    String(cpt.examiner_vatsim_id),
    String(cpt.local_vatsim_id),
  ]
    .filter(Boolean)
    .some((field) => field.toLowerCase().includes(q));
}
