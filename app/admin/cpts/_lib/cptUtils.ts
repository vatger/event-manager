import { parseCptDate } from "@/lib/cpt/cptDate";
import type { CptEntry } from "./cptTypes";

export { parseCptDate };

/** Ab wie vielen Tagen Vorlauf ein unbeworbenes CPT als dringend gilt. */
export const URGENT_DAYS = 3;

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

/** Kompakter Zulu-Termin im Stil der Eventkarten: „15 DEC 25 | 1800z" */
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export function formatZulu(dateString: string): string {
  const d = parseCptDate(dateString);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)} | ${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}z`;
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
 * Banner-Vorlage einer Position. Nur für die Positionen hinterlegt, für die
 * es im Generator auch eine Vorlage gibt – sonst gibt es keinen Banner.
 */
export function getBannerTemplate(position: string): string | null {
  if (position === "EDDM_TWR") return "EDDMTWR";
  if (position === "EDDM_APP") return "APP";
  if (position === "EDDN_TWR") return "EDDNTWR";
  if (position === "EDDP_TWR") return "EDDPTWR";
  if (/^EDMM_[A-Z]+_CTR$/.test(position)) return "CTR";
  return null;
}

/** Gibt es für diese Position überhaupt einen Banner? */
export function hasBanner(cpt: CptEntry): boolean {
  return getBannerTemplate(cpt.position) !== null;
}

/**
 * URL des vorbefüllten Banners, oder "" wenn es keine Vorlage gibt.
 *
 * Die CTR-Vorlage verlangt zusätzlich die Station: Sie steht als mittlerer
 * Teil im Callsign (EDMM_WLD_CTR → WLD). Ohne diesen Parameter lehnt der
 * Generator die Anfrage ab.
 */
export function bannerUrl(cpt: CptEntry): string {
  const template = getBannerTemplate(cpt.position);
  if (!template) return "";

  const params = new URLSearchParams({
    template,
    name: cpt.trainee_name,
    date: formatDateIso(cpt.date),
    time: formatTimeZulu(cpt.date).replace("z", ""),
  });

  if (template === "CTR") {
    const sector = cpt.position.split("_")[1];
    if (sector) params.set("station", sector);
  }

  return `/api/cpt-banner/generate/?${params.toString()}`;
}

/**
 * Absolute URL des Banners – als Text kopiert (fürs Forum) taugt nur eine
 * vollständige Adresse, der relative Pfad aus {@link bannerUrl} funktioniert
 * nur innerhalb der App selbst.
 */
export function absoluteBannerUrl(cpt: CptEntry): string {
  const path = bannerUrl(cpt);
  if (!path) return "";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}${path}`;
}

/** Legt den Link zum Banner (nicht das Bild selbst) in die Zwischenablage. */
export async function copyBannerUrlToClipboard(cpt: CptEntry): Promise<void> {
  const url = absoluteBannerUrl(cpt);
  if (!url) throw new Error("Für diese Position gibt es keine Bannervorlage");
  await navigator.clipboard.writeText(url);
}

/** Stationsgruppe einer Position – färbt die Positions-Plakette ein. */
export function stationGroupOf(
  position: string
): "TWR" | "APP" | "CTR" | "GND" | "DEL" | "NONE" {
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
  DEL: "bg-station-del-soft text-station-del-text",
  GND: "bg-station-gnd-soft text-station-gnd-text",
  TWR: "bg-station-twr-soft text-station-twr-text",
  APP: "bg-station-app-soft text-station-app-text",
  CTR: "bg-station-ctr-soft text-station-ctr-text",
  NONE: "bg-station-none-soft text-station-none-text",
};

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
