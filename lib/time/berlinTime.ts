/**
 * Umrechnung zwischen Ortszeit (Europe/Berlin) und UTC.
 *
 * Bewusst frei von Server-Abhängigkeiten, damit alle Aufrufer (CPT-Termine,
 * Weekly-Buchungen, Cron-Jobs) dieselbe DST-Behandlung benutzen.
 */

/** Rechnet eine Ortszeit (Europe/Berlin) in einen UTC-Zeitpunkt um. */
export function berlinWallClockToUtc(
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number
): Date {
  const naiveUtc = Date.UTC(year, month, day, hours, minutes);
  // Zwei Durchläufe, damit auch die Zeitumstellung sauber getroffen wird.
  let result = naiveUtc - berlinOffsetMinutes(new Date(naiveUtc)) * 60_000;
  result = naiveUtc - berlinOffsetMinutes(new Date(result)) * 60_000;
  return new Date(result);
}

/** Kalender- und Uhrzeit-Anteile eines Zeitpunkts in Europe/Berlin. */
export interface BerlinDateParts {
  year: number;
  /** 0-basiert, wie bei {@link Date.getUTCMonth}. */
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** Zerlegt einen Zeitpunkt in seine Europe/Berlin-Kalenderanteile. */
export function berlinDateParts(instant: Date): BerlinDateParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Berlin",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const value = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  return {
    year: value("year"),
    month: value("month") - 1,
    day: value("day"),
    hour: value("hour") % 24, // Intl liefert je nach Umgebung "24" für Mitternacht
    minute: value("minute"),
    second: value("second"),
  };
}

/** UTC-Versatz von Europe/Berlin (in Minuten) zum gegebenen Zeitpunkt. */
export function berlinOffsetMinutes(instant: Date): number {
  const { year, month, day, hour, minute, second } = berlinDateParts(instant);
  const asUtc = Date.UTC(year, month, day, hour, minute, second);
  return Math.round((asUtc - instant.getTime()) / 60_000);
}
