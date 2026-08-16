/**
 * Welche Familiarisierung braucht welche CTR-Position?
 *
 * Eine Center-Position deckt je nach Sektorplan einen oder mehrere Sektoren ab.
 * Ob jemand sie besetzen darf, hängt daran, ob die passenden Familiarisierungen
 * vorliegen – der Kennung selbst ist das nicht anzusehen.
 *
 * Die Zuordnung ist betrieblich und ändert sich mit den Sektorplänen, sie
 * gehört deshalb hierher und nicht in den Code. Der Schlüssel ist das Callsign
 * der Position, der Wert sind die dafür nötigen Familiarisierungen.
 *
 *   "EDGG_GED_CTR": ["GED"]           – eine Familiarisierung genügt
 *   "EDMM_NDG_CTR": ["NDG", "ALB"]    – Sammelposition, beide nötig
 *
 * Nicht eingetragene Positionen werden nicht geprüft: lieber keine Aussage als
 * eine falsche. Wer eine Position also bewusst ohne FAM-Pflicht führen will,
 * lässt sie einfach weg oder trägt eine leere Liste ein.
 *
 * ACHTUNG: Die folgenden Einträge sind Beispiele und müssen an die
 * tatsächlichen Sektorpläne angepasst werden.
 */

export interface SectorFamiliarizationConfig {
  /** Benötigte Familiarisierungen (leere Liste = keine Anforderung) */
  requires: string[];
  /**
   * Reicht eine der genannten Familiarisierungen?
   * Standard ist false – wer eine Sammelposition besetzt, kontrolliert alle
   * darin enthaltenen Sektoren und braucht sie deshalb vollständig.
   */
  anyOf?: boolean;
  /** Klartextname für Tooltips und Meldungen */
  label?: string;
}

export const SECTOR_FAMILIARIZATIONS: Record<string, SectorFamiliarizationConfig> = {
  // ---- Langen (EDGG) ----
  EDGG_GED_CTR: { requires: ["GED"], label: "Gedern" },
  EDGG_WLD_CTR: { requires: ["WLD"], label: "Westerwald" },
  EDGG_KTG_CTR: { requires: ["KTG"], label: "Kitzingen" },
  EDGG_DKB_CTR: { requires: ["DKB"], label: "Dinkelsbühl" },
  EDGG_PFA_CTR: { requires: ["PFA"], label: "Pfalz" },
  EDGG_RUD_CTR: { requires: ["RUD"], label: "Rüdesheim" },
  EDGG_HAN_CTR: { requires: ["HAN"], label: "Hanau" },

  // ---- München (EDMM) ----
  EDMM_ALB_CTR: { requires: ["ALB"], label: "Alb" },
  EDMM_TEG_CTR: { requires: ["TEG"], label: "Tegernsee" },
  EDMM_ZUG_CTR: { requires: ["ZUG"], label: "Zugspitze" },
  EDMM_SLN_CTR: { requires: ["SLN"], label: "Sulingen" },
  EDMM_TRU_CTR: { requires: ["TRU"], label: "Traunstein" },

  // ---- Bremen (EDWW) ----
  EDWW_ALR_CTR: { requires: ["ALR"], label: "Alster" },
  EDWW_BOR_CTR: { requires: ["BOR"], label: "Borkum" },
  EDWW_HEI_CTR: { requires: ["HEI"], label: "Heide" },
  EDWW_MAG_CTR: { requires: ["MAG"], label: "Magdeburg" },

  // ---- Beispiel für eine Sammelposition ----
  // Deckt mehrere Sektoren ab, deshalb sind alle Familiarisierungen nötig:
  // EDMM_NDG_CTR: { requires: ["NDG", "ALB"], label: "Nördlingen (Sammel)" },
};

export function getSectorConfig(callsign: string): SectorFamiliarizationConfig | null {
  return SECTOR_FAMILIARIZATIONS[callsign.toUpperCase()] ?? null;
}

/**
 * Welche Familiarisierungen fehlen dieser Person für die Position?
 *
 * `null` heißt „keine Aussage möglich" – die Position ist nicht konfiguriert.
 * Ein leeres Array heißt „alles vorhanden".
 */
export function missingFamiliarizations(
  callsign: string,
  familiarizations: string[]
): string[] | null {
  const config = getSectorConfig(callsign);
  if (!config || config.requires.length === 0) return null;

  const have = new Set(familiarizations.map((f) => f.toUpperCase()));
  const missing = config.requires.filter((s) => !have.has(s.toUpperCase()));

  // Bei anyOf genügt eine – erst wenn keine einzige vorliegt, fehlt etwas
  if (config.anyOf) {
    return missing.length === config.requires.length ? config.requires : [];
  }
  return missing;
}
