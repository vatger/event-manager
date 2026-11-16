/**
 * Rechtekatalog – die einzige Quelle für vergebbare Rechte.
 *
 * Gruppen einer FIR bekommen Rechte aus diesem Katalog; sie gelten immer für
 * die eigene FIR. Die Tabelle `Permission` wird aus dieser Liste synchronisiert
 * (siehe catalogSync.ts) – ein Recht, das hier nicht steht, lässt sich weder
 * vergeben noch prüfen: Die Prüffunktionen nehmen nur `PermissionKey` an.
 *
 * Die Datei ist frei von Server-Abhängigkeiten und wird auch im Client genutzt.
 */

export const PERMISSION_CATEGORIES = [
  { id: "events", label: "Events" },
  { id: "roster", label: "Besetzungsplan" },
  { id: "signups", label: "Anmeldungen" },
  { id: "communication", label: "Kommunikation" },
] as const;

export type PermissionCategoryId = (typeof PERMISSION_CATEGORIES)[number]["id"];

export const PERMISSION_KEYS = [
  "event.create",
  "event.edit",
  "event.delete",
  "event.banner",
  "roster.edit",
  "roster.publish",
  "signups.manage",
  "event.export",
  "user.notif",
  "roster.contact",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export interface PermissionDefinition {
  key: PermissionKey;
  label: string;
  description: string;
  category: PermissionCategoryId;
  /**
   * Nur ausdrücklich vergeben: Die Leitungsgruppe bekommt es nicht automatisch
   * mit. Für Rollen wie „Ansprechpartner“, die niemand ungefragt haben soll.
   */
  explicitOnly?: true;
  /**
   * Rechte, die dieses Recht in den Prüfungen bereits mit abdeckt. Rein
   * beschreibend für die Oberfläche – maßgeblich bleiben die Prüffunktionen.
   */
  includes?: PermissionKey[];
}

export const PERMISSION_CATALOG: PermissionDefinition[] = [
  {
    key: "event.create",
    label: "Events erstellen",
    description: "Neue Events und Weeklys in der FIR anlegen.",
    category: "events",
  },
  {
    key: "event.edit",
    label: "Events bearbeiten",
    description:
      "Events und Weeklys der FIR vollständig bearbeiten: Stammdaten, Status, Aufgaben, Verantwortliche und Bearbeiter des Besetzungsplans.",
    category: "events",
    includes: ["event.banner", "roster.edit", "roster.publish", "signups.manage"],
  },
  {
    key: "event.delete",
    label: "Events löschen",
    description: "Events, Weeklys und einzelne Weekly-Termine der FIR löschen.",
    category: "events",
  },
  {
    key: "event.banner",
    label: "Banner verwalten",
    description: "Den Banner eines Events setzen und öffentlich ein- oder ausblenden.",
    category: "events",
  },
  {
    key: "roster.edit",
    label: "Besetzungsplan bearbeiten",
    description:
      "Den Besetzungsplan aller Events der FIR bearbeiten und dabei Anmeldungen pflegen.",
    category: "roster",
    includes: ["signups.manage"],
  },
  {
    key: "roster.publish",
    label: "Besetzungsplan veröffentlichen",
    description:
      "Den Besetzungsplan erstmals veröffentlichen und die gebuchten Stationen freigeben.",
    category: "roster",
  },
  {
    key: "signups.manage",
    label: "Anmeldungen verwalten",
    description: "Anmeldungen anderer Controller anlegen, ändern und löschen.",
    category: "signups",
  },
  {
    key: "event.export",
    label: "Anmeldungen exportieren",
    description: "Anmeldungen eines Events exportieren und mit Google Sheets abgleichen.",
    category: "signups",
  },
  {
    key: "user.notif",
    label: "Controller benachrichtigen",
    description: "Angemeldete Controller und Kandidaten eines Events benachrichtigen.",
    category: "communication",
  },
  {
    key: "roster.contact",
    label: "Ansprechpartner für Abmeldungen",
    description:
      "Steht neben den Eventverantwortlichen in der vorbereiteten Forum-PN, mit der sich Lotsen nach dem Anmeldeschluss abmelden.",
    category: "communication",
    explicitOnly: true,
  },
];

/** Früher geprüfte Schlüssel, die es im Katalog nicht (mehr) gibt → ihr Ersatz. */
export const LEGACY_PERMISSION_ALIASES: Record<string, PermissionKey> = {
  "event.manage": "event.edit",
};

/** Rechte, die die Leitungsgruppe fest hat – alle außer den nur ausdrücklich vergebenen. */
export const LEITUNG_PERMISSION_KEYS: PermissionKey[] = PERMISSION_CATALOG.filter(
  (p) => !p.explicitOnly
).map((p) => p.key);

const BY_KEY = new Map(PERMISSION_CATALOG.map((p) => [p.key as string, p]));

export function isPermissionKey(key: string): key is PermissionKey {
  return BY_KEY.has(key);
}

export function getPermission(key: PermissionKey): PermissionDefinition {
  return BY_KEY.get(key)!;
}

/**
 * Was jedes Mitglied eines FIR-Eventdepartments darf – unabhängig von den
 * Rechten seiner Gruppen. Fest eingebaut, in der Oberfläche nur angezeigt.
 */
export const TEAM_BASE_RIGHTS = [
  "Den Admin-Bereich betreten",
  "Besetzungspläne der FIR intern ansehen",
  "Aufgaben an Events übernehmen und erledigen",
  "Den Bearbeitungsstand der CPTs pflegen",
] as const;

/** Was die Leitungsgruppe einer FIR zusätzlich zu allen Rechten des Katalogs darf. */
export const LEITUNG_FIXED_RIGHTS = [
  "Alle Rechte des Katalogs in der eigenen FIR – außer „Ansprechpartner für Abmeldungen“, das nur ausdrücklich über eine Untergruppe vergeben wird",
  "Untergruppen anlegen, Mitglieder und Rechte verteilen",
  "Kommentare zu Controllern moderieren",
  "CPT-Verantwortliche der FIR pflegen",
] as const;
