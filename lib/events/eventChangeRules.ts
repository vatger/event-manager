import type { CapabilityKey } from "./eventCapabilities";

/**
 * Welches Recht braucht eine Änderung an einem Event?
 *
 * Das Bearbeiten-Formular schickt immer alle Felder mit, auch Status, Banner
 * und Anmeldeschluss. Entscheidend ist deshalb nicht, was im Request steht,
 * sondern was sich tatsächlich ändert – sonst ließen sich über das Formular
 * die Einzelrechte umgehen.
 */

export type EventStatus =
  | "PLANNING"
  | "SIGNUP_OPEN"
  | "SIGNUP_CLOSED"
  | "ROSTER_PUBLISHED"
  | "DRAFT"
  | "CANCELLED";

/** Felder, die zu den Stammdaten gehören */
const DETAIL_FIELDS = [
  "name",
  "description",
  "startTime",
  "endTime",
  "airports",
  "signupSlotMinutes",
  "staffedStations",
  "firCode",
] as const;

/** Das Recht, das ein Wechsel in diesen Status verlangt */
export function capabilityForStatus(next: EventStatus): CapabilityKey {
  switch (next) {
    case "SIGNUP_OPEN":
    case "SIGNUP_CLOSED":
      return "signupPhase";
    case "ROSTER_PUBLISHED":
      return "publishRoster";
    default:
      // Entwurf, Planung und Absage sind Statusänderungen der Stammdaten
      return "editDetails";
  }
}

export type ComparableEvent = Record<string, unknown>;

function normalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (value === undefined || value === "") return null;
  if (typeof value === "string" && !isNaN(Date.parse(value)) && /\d{4}-\d{2}-\d{2}T/.test(value)) {
    return new Date(value).toISOString();
  }
  return value;
}

export function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}

/** Die Felder, die sich zwischen gespeichertem Stand und Anfrage unterscheiden */
export function changedFields(current: ComparableEvent, incoming: ComparableEvent): string[] {
  return Object.keys(incoming).filter(
    (key) => incoming[key] !== undefined && !sameValue(current[key], incoming[key])
  );
}

/** Alle Rechte, die die Änderung dieser Felder verlangt */
export function requiredCapabilities(
  fields: string[],
  nextStatus: EventStatus | undefined
): CapabilityKey[] {
  const required = new Set<CapabilityKey>();
  for (const field of fields) {
    if ((DETAIL_FIELDS as readonly string[]).includes(field)) required.add("editDetails");
    else if (field === "bannerUrl" || field === "bannerVisible") required.add("banner");
    else if (field === "signupDeadline") required.add("signupPhase");
    else if (field === "rosterlink") required.add("publishRoster");
    else if (field === "status" && nextStatus) required.add(capabilityForStatus(nextStatus));
  }
  return [...required];
}
