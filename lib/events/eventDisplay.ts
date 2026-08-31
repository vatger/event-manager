/**
 * Gemeinsame Darstellung von Events auf den öffentlichen Seiten.
 *
 * Eventkarte und Detailseite zeigen dieselben Angaben – Status, Termin,
 * Flughäfen. Sie liegen hier einmal, damit die Seiten nicht auseinanderlaufen,
 * wenn eine von beiden angefasst wird.
 */

export interface EventStatusDisplay {
  label: string;
  /** Plakettenfarben aus den Markenskalen, je mit eigener Fassung für Dark Mode. */
  className: string;
}

export const EVENT_STATUS: Record<string, EventStatusDisplay> = {
  SIGNUP_OPEN: {
    label: "Anmeldung offen",
    className: "bg-success-100 text-success-800 dark:bg-success-900/40 dark:text-success-300",
  },
  SIGNUP_CLOSED: {
    label: "Anmeldung geschlossen",
    className: "bg-secondary-100 text-secondary-700 dark:bg-secondary-800 dark:text-secondary-300",
  },
  PLANNING: {
    label: "Geplant",
    className: "bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-200",
  },
  DRAFT: {
    label: "Entwurf",
    className: "bg-secondary-100 text-secondary-700 dark:bg-secondary-800 dark:text-secondary-300",
  },
  ROSTER_PUBLISHED: {
    label: "Besetzungsplan online",
    className: "bg-primary-900 text-secondary-50 dark:bg-secondary-50 dark:text-secondary-900",
  },
  CANCELLED: {
    label: "Abgesagt",
    className: "bg-danger-100 text-danger-900 dark:bg-danger-900/50 dark:text-danger-200",
  },
};

const FALLBACK_STATUS: EventStatusDisplay = {
  label: "Unbekannt",
  className: "bg-secondary-100 text-secondary-700 dark:bg-secondary-800 dark:text-secondary-300",
};

export function eventStatusDisplay(status: string): EventStatusDisplay {
  return EVENT_STATUS[status] ?? { ...FALLBACK_STATUS, label: status };
}

/** "18 Okt 2026" – ohne die Abkürzungspunkte, die de-DE sonst setzt. */
export function formatEventDate(d: Date): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
    .format(d)
    .replace(/\./g, "");
}

/** Zulu-Uhrzeit im Stil der übrigen Ansichten: "1800z" */
export function formatZulu(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}z`;
}

/** Ortsdatum des Betrachters: "20 Sep 2026" – für Angaben wie den Anmeldeschluss. */
export function formatLocalDate(d: Date): string {
  return d
    .toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" })
    .replace(/\./g, "");
}

/** Ortszeit des Betrachters: "20:00" */
export function formatLocalTime(d: Date): string {
  return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

export function formatEventMonth(d: Date): string {
  return new Intl.DateTimeFormat("de-DE", { month: "short", timeZone: "UTC" })
    .format(d)
    .replace(/\./g, "");
}

export function formatEventWeekday(d: Date): string {
  return new Intl.DateTimeFormat("de-DE", { weekday: "long", timeZone: "UTC" }).format(d);
}

/** Flughäfen eines Events immer als Liste – das Feld ist mal Array, mal String. */
export function eventAirportList(airports: unknown): string[] {
  if (Array.isArray(airports)) return airports.filter(Boolean).map(String);
  if (typeof airports === "string" && airports.trim()) return [airports];
  return [];
}
