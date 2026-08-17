/**
 * Angaben der Infospalte neben den Controllern.
 *
 * Liegt getrennt von den Komponenten, weil Editor, Filterleiste und
 * Kontextmenü dieselbe Liste brauchen.
 */

export const INFO_FIELDS = ["airports", "preferred", "remarks", "note"] as const;
export type InfoField = (typeof INFO_FIELDS)[number];

export const INFO_FIELD_LABEL: Record<InfoField, string> = {
  airports: "Freigaben",
  preferred: "Wunschstationen",
  remarks: "Remarks",
  note: "Interne Notiz",
};

/**
 * Standardauswahl.
 *
 * Die Freigaben sind absichtlich aus: Sie sind die längste Angabe und bei den
 * meisten Personen unauffällig – wer sie braucht, schaltet sie zu. Auffällige
 * Fälle (fehlende Freigabe, Abwahl) melden sich ohnehin über die Warnungen und
 * die Marker am Block.
 */
export const DEFAULT_INFO_FIELDS: InfoField[] = ["preferred", "remarks", "note"];
