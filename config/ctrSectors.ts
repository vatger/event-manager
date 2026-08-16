/**
 * Sektorgruppen der CTR-Positionen.
 *
 * Eine CTR-Position wie `EDGG_WLD_CTR` ist keine einzelne Sektorgrenze,
 * sondern eine Gruppe: Wer sie besetzt, kontrolliert mehrere Einzelsektoren
 * gleichzeitig. Für die Planung heißt das, dass die Familiarisierungen einer
 * Person zu genau diesen Einzelsektoren passen müssen – die Gruppenkennung
 * allein sagt darüber nichts aus.
 *
 * Diese Zuordnung ist betrieblich und ändert sich mit den Sektorplänen, sie
 * gehört deshalb in eine Konfiguration und nicht in den Code. Nicht
 * eingetragene Gruppen werden nicht geprüft – lieber keine Aussage als eine
 * falsche.
 *
 * Aufbau des Schlüssels: `<FIR>_<GRUPPE>` (die Kennung aus dem Callsign,
 * also `EDGG_WLD_CTR` → `EDGG_WLD`).
 */

export interface CtrSectorGroup {
  /** Einzelsektoren, die diese Gruppe abdeckt */
  sectors: string[];
  /**
   * Wie viele davon familiarisiert sein müssen:
   *  - "all" (Standard): Wer die Gruppe besetzt, kontrolliert alle Sektoren
   *  - "any": Eine Familiarisierung genügt (z. B. bei Gruppen, die im Event
   *    ohnehin nur teilweise geöffnet werden)
   */
  requires?: "all" | "any";
  /** Erklärender Name für die Anzeige */
  label?: string;
}

/**
 * BEISPIELDATEN – bitte an die tatsächlichen Sektorpläne anpassen.
 * Solange ein Eintrag fehlt, meldet die Planung zu dieser Position keine
 * Familiarisierungs-Lücke.
 */
export const CTR_SECTOR_GROUPS: Record<string, CtrSectorGroup> = {
  // Beispiel Langen (EDGG)
  EDGG_WLD: { sectors: ["WLD"], label: "Westerwald" },
  EDGG_GED: { sectors: ["GED"], label: "Gedern" },
  EDGG_KTG: { sectors: ["KTG"], label: "Kitzingen" },
  EDGG_DKB: { sectors: ["DKB"], label: "Dinkelsbühl" },
  EDGG_PFA: { sectors: ["PFA"], label: "Pfalz" },
  EDGG_RUD: { sectors: ["RUD"], label: "Rüdesheim" },
  EDGG_HAN: { sectors: ["HAN"], label: "Hanau" },

  // Beispiel München (EDMM)
  EDMM_ALB: { sectors: ["ALB"], label: "Alb" },
  EDMM_TEG: { sectors: ["TEG"], label: "Tegernsee" },
  EDMM_ZUG: { sectors: ["ZUG"], label: "Zugspitze" },
  EDMM_SLN: { sectors: ["SLN"], label: "Sulingen" },
  EDMM_TRU: { sectors: ["TRU"], label: "Traunstein" },

  // Beispiel Bremen (EDWW)
  EDWW_ALR: { sectors: ["ALR"], label: "Alster" },
  EDWW_BOR: { sectors: ["BOR"], label: "Borkum" },
  EDWW_HEI: { sectors: ["HEI"], label: "Heide" },
  EDWW_MAG: { sectors: ["MAG"], label: "Magdeburg" },
};

/**
 * Sektorgruppen-Schlüssel aus einem Callsign lesen.
 * `EDGG_WLD_CTR` → `EDGG_WLD`; `EDGG_CTR` (FIR-weit) → null.
 */
export function ctrGroupKeyFromCallsign(callsign: string): string | null {
  const parts = callsign.toUpperCase().split("_");
  if (parts.length !== 3 || parts[2] !== "CTR") return null;
  return `${parts[0]}_${parts[1]}`;
}

export function getCtrSectorGroup(callsign: string): CtrSectorGroup | null {
  const key = ctrGroupKeyFromCallsign(callsign);
  if (!key) return null;
  return CTR_SECTOR_GROUPS[key] ?? null;
}

/**
 * Welche Sektoren der Gruppe fehlen dieser Person?
 *
 * Rückgabe `null` heißt „keine Aussage möglich" – die Position ist nicht
 * konfiguriert oder gar keine Sektorgruppe. Ein leeres Array heißt „alles
 * vorhanden".
 */
export function missingFamiliarizations(
  callsign: string,
  familiarizations: string[]
): string[] | null {
  const group = getCtrSectorGroup(callsign);
  if (!group || group.sectors.length === 0) return null;

  const have = new Set(familiarizations.map((f) => f.toUpperCase()));
  const missing = group.sectors.filter((s) => !have.has(s.toUpperCase()));

  if ((group.requires ?? "all") === "any") {
    // Eine Familiarisierung genügt – fehlt sie für alle, ist die Gruppe offen
    return missing.length === group.sectors.length ? group.sectors : [];
  }
  return missing;
}
