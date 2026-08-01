/**
 * Einheitliche Darstellung des Event-Status.
 *
 * Bisher war diese Zuordnung mehrfach in einzelnen Seiten dupliziert. Sie
 * lebt jetzt an einer Stelle und nutzt ausschließlich Marken-Tokens:
 * Statusfarben folgen laut Brandbook ihrer semantischen Rolle
 * (success/warning/danger), alles Übrige bleibt neutral bzw. primary.
 */

export type EventStatus =
  | "DRAFT"
  | "PLANNING"
  | "SIGNUP_OPEN"
  | "SIGNUP_CLOSED"
  | "ROSTER_PUBLISHED"
  | "COMPLETED"
  | "CANCELLED";

export interface EventStatusStyle {
  label: string;
  /** Klassen für ein Badge mit weicher Fläche */
  color: string;
}

const STATUS: Record<EventStatus, EventStatusStyle> = {
  // Noch nicht öffentlich – bewusst neutral
  DRAFT: {
    label: "Entwurf",
    color: "bg-secondary text-secondary-foreground border-border",
  },
  // In Arbeit – ruhige Markenfarbe, keine Statusaussage
  PLANNING: {
    label: "Planung",
    color: "bg-primary-100 text-primary-800 border-primary-200 dark:bg-primary-900 dark:text-primary-100 dark:border-primary-800",
  },
  // Aktiv und offen – positiver Zustand
  SIGNUP_OPEN: {
    label: "Anmeldung offen",
    color: "bg-success-100 text-success-800 border-success-200 dark:bg-success-900 dark:text-success-100 dark:border-success-800",
  },
  // Übergangszustand, der Aufmerksamkeit verlangt
  SIGNUP_CLOSED: {
    label: "Anmeldung geschlossen",
    color: "bg-warning-100 text-warning-800 border-warning-200 dark:bg-warning-900 dark:text-warning-100 dark:border-warning-800",
  },
  // Ergebnis steht – gezielte Betonung über den Markenakzent
  ROSTER_PUBLISHED: {
    label: "Roster veröffentlicht",
    color: "bg-accent-100 text-accent-800 border-accent-200 dark:bg-accent-900 dark:text-accent-100 dark:border-accent-800",
  },
  COMPLETED: {
    label: "Abgeschlossen",
    color: "bg-secondary text-secondary-foreground border-border",
  },
  CANCELLED: {
    label: "Abgesagt",
    color: "bg-danger-100 text-danger-800 border-danger-200 dark:bg-danger-900 dark:text-danger-100 dark:border-danger-800",
  },
};

const FALLBACK: EventStatusStyle = {
  label: "Unbekannt",
  color: "bg-secondary text-secondary-foreground border-border",
};

/** Beschriftung und Badge-Klassen für einen Event-Status */
export function getEventStatusStyle(status?: string | null): EventStatusStyle {
  if (!status) return FALLBACK;
  return STATUS[status as EventStatus] ?? { ...FALLBACK, label: status };
}

/** Nur die Beschriftung (z. B. für Filter-Dropdowns) */
export function getEventStatusLabel(status?: string | null): string {
  return getEventStatusStyle(status).label;
}

/** Alle Status in sinnvoller Reihenfolge – für Auswahlfelder */
export const EVENT_STATUS_ORDER: EventStatus[] = [
  "DRAFT",
  "PLANNING",
  "SIGNUP_OPEN",
  "SIGNUP_CLOSED",
  "ROSTER_PUBLISHED",
  "COMPLETED",
  "CANCELLED",
];
