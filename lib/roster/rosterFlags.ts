/**
 * Ampel-Markierung für die Roster-Planung.
 *
 * Die Markierung liegt am selben Datensatz wie die interne Notiz
 * (`EventRosterNote`) und ist bewusst ohne feste Bedeutung definiert – jedes
 * Team nutzt sie anders (z. B. grün = fest eingeplant, orange = Rückfrage
 * offen, rot = möglichst nicht einplanen). Sie ist rein intern und taucht in
 * keiner öffentlichen Ansicht auf.
 *
 * Diese Datei ist absichtlich frei von Server- und React-Abhängigkeiten,
 * damit Editor, Seitenleiste und Anmeldungsseite dieselbe Quelle nutzen.
 */

export const ROSTER_FLAGS = ["green", "amber", "red"] as const;

export type RosterFlag = (typeof ROSTER_FLAGS)[number];

export const ROSTER_FLAG_LABEL: Record<RosterFlag, string> = {
  green: "Grün",
  amber: "Orange",
  red: "Rot",
};

/** Vorschlagstexte – erklären die Ampel, ohne sie festzuschreiben */
export const ROSTER_FLAG_HINT: Record<RosterFlag, string> = {
  green: "passt",
  amber: "unschön",
  red: "passt noch nicht",
};

/** Farbfläche für Punkte und Chips */
export const ROSTER_FLAG_DOT: Record<RosterFlag, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-danger-600",
};

/** Farbiger Streifen am Zeilenanfang */
export const ROSTER_FLAG_BAR: Record<RosterFlag, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-danger-600",
};

/** Dezente Flächen-/Textkombination für Chips und Zeilenhintergründe */
export const ROSTER_FLAG_SOFT: Record<RosterFlag, string> = {
  green: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  amber: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  red: "bg-danger-600/10 text-danger-700 dark:text-danger-300 border-danger-600/30",
};

export function isRosterFlag(value: unknown): value is RosterFlag {
  return typeof value === "string" && (ROSTER_FLAGS as readonly string[]).includes(value);
}
