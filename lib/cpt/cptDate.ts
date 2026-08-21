import { berlinWallClockToUtc } from "@/lib/time/berlinTime";

/**
 * Termin der Training-API einlesen.
 *
 * Die Training-API liefert die Uhrzeit als Ortszeit (Europe/Berlin) – auch
 * wenn manchmal ein „Z" oder ein Offset drangehängt ist, ist das nicht die
 * tatsächliche Zeitzone der Zahl. Die Ziffern selbst gelten immer als Berliner
 * Ortszeit; ein eventueller Zonen-Suffix wird deshalb ignoriert und über die
 * IANA-Zeitzone DST-sicher in UTC umgerechnet.
 *
 * Bewusst frei von Server-Abhängigkeiten, damit Oberfläche und Cron-Job
 * denselben Zeitpunkt errechnen.
 */
export function parseCptDate(dateString: string): Date {
  const trimmed = (dateString ?? "").trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(trimmed);
  if (!match) return new Date(trimmed);

  const [, year, month, day, hours, minutes] = match;
  return berlinWallClockToUtc(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hours),
    Number(minutes)
  );
}
