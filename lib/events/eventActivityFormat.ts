/**
 * Formulierungen des Event-Protokolls – reine Funktionen ohne Datenbank,
 * damit Server (beim Schreiben) und Tests dieselben Sätze bilden.
 *
 * Der Klartext entsteht beim Schreiben und wird später nicht neu gebildet:
 * Das Protokoll zeigt, was damals galt.
 */

export const ACTIVITY_CATEGORIES = [
  { id: "details", label: "Stammdaten & Status" },
  { id: "banner", label: "Banner" },
  { id: "signups", label: "Anmeldungen" },
  { id: "roster", label: "Veröffentlichung" },
  { id: "team", label: "Verantwortliche" },
  { id: "tasks", label: "Aufgaben" },
  { id: "communication", label: "Benachrichtigungen & Export" },
] as const;

export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number]["id"];

export interface FieldChange {
  field: string;
  label: string;
  before: string;
  after: string;
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Entwurf",
  PLANNING: "Planung",
  SIGNUP_OPEN: "Anmeldung offen",
  SIGNUP_CLOSED: "Anmeldung geschlossen",
  ROSTER_PUBLISHED: "Roster veröffentlicht",
  CANCELLED: "Abgesagt",
};

export const statusLabel = (status: string | null | undefined) =>
  status ? STATUS_LABEL[status] ?? status : "–";

const FIELD_LABEL: Record<string, string> = {
  name: "Name",
  description: "Beschreibung",
  startTime: "Beginn",
  endTime: "Ende",
  airports: "Flughäfen",
  signupSlotMinutes: "Slot-Länge",
  staffedStations: "Stationen",
  firCode: "FIR",
  bannerUrl: "Banner",
  bannerVisible: "Banner-Sichtbarkeit",
  signupDeadline: "Anmeldeschluss",
  rosterlink: "Roster-Link",
  status: "Status",
};

/** Bereich je Feld – eine Änderung erzeugt je Bereich einen Eintrag */
const FIELD_CATEGORY: Record<string, ActivityCategory> = {
  name: "details",
  description: "details",
  startTime: "details",
  endTime: "details",
  airports: "details",
  signupSlotMinutes: "details",
  staffedStations: "details",
  firCode: "details",
  status: "details",
  bannerUrl: "banner",
  bannerVisible: "banner",
  signupDeadline: "signups",
  rosterlink: "roster",
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Zeitpunkt wie in den Event-Karten: „01.12.2026 16:00z“ */
export function formatZulu(value: Date | string | null | undefined): string {
  if (!value) return "–";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "–";
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()} ${pad(
    d.getUTCHours()
  )}:${pad(d.getUTCMinutes())}z`;
}

function asList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      // kein JSON – als einzelner Wert
    }
    return value ? [value] : [];
  }
  return [];
}

const MAX_TEXT = 300;
const shorten = (text: string) => (text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)} …` : text);

/** Wert eines Felds lesbar machen */
export function formatFieldValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "–";
  switch (field) {
    case "startTime":
    case "endTime":
    case "signupDeadline":
      return formatZulu(value as string);
    case "airports":
    case "staffedStations": {
      const list = asList(value);
      return list.length ? list.join(", ") : "–";
    }
    case "status":
      return statusLabel(String(value));
    case "bannerVisible":
      return value ? "öffentlich" : "verborgen";
    case "signupSlotMinutes":
      return `${value} Minuten`;
    case "description":
      // Beschreibung kann HTML/Markdown enthalten – nur Text, gekürzt
      return shorten(String(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    default:
      return shorten(String(value));
  }
}

function normalized(field: string, value: unknown): string {
  if (field === "airports" || field === "staffedStations") return JSON.stringify(asList(value));
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) && !isNaN(Date.parse(value))) {
    return new Date(value).toISOString();
  }
  if (value === undefined || value === "") return "null";
  return JSON.stringify(value);
}

/** Unterschiede zwischen zwei Ständen, nur für bekannte Felder */
export function diffEvent(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): FieldChange[] {
  return Object.keys(FIELD_LABEL)
    .filter((field) => field in after)
    .filter((field) => normalized(field, before[field]) !== normalized(field, after[field]))
    .map((field) => ({
      field,
      label: FIELD_LABEL[field],
      before: formatFieldValue(field, before[field]),
      after: formatFieldValue(field, after[field]),
    }));
}

function joinLabels(labels: string[]): string {
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} und ${labels[labels.length - 1]}`;
}

export interface ActivityDraft {
  category: ActivityCategory;
  action: string;
  summary: string;
  details?: Record<string, unknown>;
}

/**
 * Aus einer Änderung am Event die Protokolleinträge bilden: je Bereich einer,
 * damit sich „wer hat den Anmeldeschluss verschoben?“ filtern lässt.
 */
export function describeEventChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): ActivityDraft[] {
  const changes = diffEvent(before, after);
  const byCategory = new Map<ActivityCategory, FieldChange[]>();
  for (const change of changes) {
    const category = FIELD_CATEGORY[change.field];
    byCategory.set(category, [...(byCategory.get(category) ?? []), change]);
  }

  const drafts: ActivityDraft[] = [];
  for (const [category, list] of byCategory) {
    const status = list.find((c) => c.field === "status");
    const others = list.filter((c) => c.field !== "status");

    if (category === "details") {
      if (status) {
        const cancelled = after.status === "CANCELLED";
        drafts.push({
          category,
          action: cancelled ? "event_cancelled" : "status_changed",
          summary: cancelled
            ? "Event abgesagt"
            : `Status von „${status.before}“ auf „${status.after}“ gesetzt`,
          details: { changes: [status] },
        });
      }
      if (others.length > 0) {
        drafts.push({
          category,
          action: "details_changed",
          summary: `${joinLabels(others.map((c) => c.label))} geändert`,
          details: { changes: others },
        });
      }
      continue;
    }

    if (category === "banner") {
      const url = list.find((c) => c.field === "bannerUrl");
      const visible = list.find((c) => c.field === "bannerVisible");
      if (url) {
        drafts.push({
          category,
          action: "banner_changed",
          summary: url.after === "–" ? "Banner entfernt" : url.before === "–" ? "Banner hinzugefügt" : "Banner geändert",
          details: { changes: [url] },
        });
      }
      if (visible) {
        drafts.push({
          category,
          action: "banner_visibility",
          summary: after.bannerVisible ? "Banner öffentlich geschaltet" : "Banner ausgeblendet",
          details: { changes: [visible] },
        });
      }
      continue;
    }

    if (category === "signups") {
      const deadline = list[0];
      drafts.push({
        category,
        action: "deadline_changed",
        summary:
          deadline.after === "–"
            ? "Anmeldeschluss entfernt"
            : deadline.before === "–"
              ? `Anmeldeschluss auf ${deadline.after} gesetzt`
              : `Anmeldeschluss von ${deadline.before} auf ${deadline.after} verschoben`,
        details: { changes: list },
      });
      continue;
    }

    if (category === "roster") {
      const link = list[0];
      drafts.push({
        category,
        action: "rosterlink_changed",
        summary: link.after === "–" ? "Roster-Link entfernt" : "Roster-Link gesetzt",
        details: { changes: list },
      });
    }
  }

  // Feste Reihenfolge: Status und Stammdaten zuerst, dann Anmeldeschluss,
  // Roster-Link und Banner – unabhängig davon, in welcher Folge die Felder kamen
  const order: ActivityCategory[] = ["details", "signups", "roster", "banner"];
  return drafts.sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));
}

/** Name im Protokoll – ohne Namen bleibt die CID, besser als „unbekannt“ */
export function personLabel(name: string | null | undefined, cid: number | null | undefined): string {
  if (name && name.trim()) return name;
  return cid ? `CID ${cid}` : "jemand";
}
