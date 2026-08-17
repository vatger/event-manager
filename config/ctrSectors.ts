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
  EDGG_GN_CTR: { requires: ["NH"], label: "Gedern" },
  EDGG_GNH_CTR: { requires: ["NH"], label: "Gedern" },
  EDGG_GC_CTR: { requires: ["CH"], label: "Gedern" },
  EDGG_GCH_CTR: { requires: ["CH"], label: "Gedern" },
  EDGG_GCA_CTR: { requires: ["CH"], label: "Gedern" },
  EDGG_GS_CTR: { requires: ["SH"], label: "Gedern" },
  EDGG_GSH_CTR: { requires: ["SH"], label: "Gedern" },
  EDGG_GSA_CTR: { requires: ["SH"], label: "Gedern" },
  EDGG_GA_CTR: { requires: ["NH", "CH"], label: "Gedern" },
  EDGG_GAH_CTR: { requires: ["NH", "CH"], label: "Gedern" },
  EDGG_GCS_CTR: { requires: ["SH", "CH"], label: "Gedern" },
  EDGG_GCSH_CTR: { requires: ["SH", "CH"], label: "Gedern" },
  EDGG_BAD_CTR: { requires: ["SH"], label: "Gedern" },
  EDGG_BADH_CTR: { requires: ["SH"], label: "Gedern" },
  EDGG_DKB_CTR: { requires: ["SH"], label: "Gedern" },
  EDGG_DKBH_CTR: { requires: ["SH"], label: "Gedern" },
  EDGG_GED_CTR: { requires: ["CH"], label: "Gedern" },
  EDGG_GIN_CTR: { requires: ["CH"], label: "Gedern" },
  EDGG_GINH_CTR: { requires: ["CH"], label: "Gedern" },
  EDGG_HAB_CTR: { requires: ["SH"], label: "Gedern" },
  EDGG_HEF_CTR: { requires: ["CH"], label: "Gedern" },
  EDGG_KIR_CTR: { requires: ["CH"], label: "Gedern" },
  EDGG_KNG_CTR: { requires: ["SH"], label: "Gedern" },
  EDGG_KTG_CTR: { requires: ["SH"], label: "Gedern" },
  EDGG_LBU_CTR: { requires: ["SH"], label: "Gedern" },
  EDGG_MAN_CTR: { requires: ["CH"], label: "Gedern" },
  EDGG_NKRH_CTR: { requires: ["SH"], label: "Gedern" },
  EDGG_PAD_CTR: { requires: ["NH"], label: "Gedern" },
  EDGG_PADH_CTR: { requires: ["NH"], label: "Gedern" },
  EDGG_PSA_CTR: { requires: ["SH"], label: "Gedern" },
  EDGG_RUD_CTR: { requires: ["CH"], label: "Gedern" },
  EDGG_RUDH_CTR: { requires: ["CH"], label: "Gedern" },
  EDGG_SIG_CTR: { requires: ["CH"], label: "Gedern" },
  EDGG_TAU_CTR: { requires: ["CH"], label: "Gedern" },
  EDGG_DKLA_CTR: { requires: ["NH"], label: "Gedern" },

  // ---- München (EDMM) ----
  EDMM_ALB_CTR: { requires: ["WLD"], label: "Allersberg" },
  EDMM_BBG_CTR: { requires: ["HOF"], label: "Bamberg" },
  EDMM_EGG_CTR: { requires: ["WLD"], label: "Eggenfelden" },
  EDMM_FUE_CTR: { requires: ["STA"], label: "Füssen" },
  EDMM_GER_CTR: { requires: ["HOF"], label: "Gera" },
  EDMM_HAL_CTR: { requires: ["HOF"], label: "Thüringen" },
  EDMM_MEI_CTR: { requires: ["HOF"], label: "Meisach" },
  EDMM_NDG_CTR: { requires: ["WLD"], label: "Nördlingen" },
  EDMM_HOF_CTR: { requires: ["HOF"], label: "Hof" },
  EDMM_RDG_CTR: { requires: ["WLD"], label: "Roding" },
  EDMM_STA_CTR: { requires: ["STA"], label: "Starnberg" },
  EDMM_TEG_CTR: { requires: ["STA"], label: "Tegernsee" },
  EDMM_TRU_CTR: { requires: ["STA"], label: "Traun" },
  EDMM_WLD_CTR: { requires: ["WLD"], label: "Walda" },
  EDMM_ZUG_CTR: { requires: ["STA"], label: "Zugspitze" },
  EDMM_SWA_CTR: { requires: ["WLD"], label: "Schwaben" },

  // ---- Bremen (EDWW) ----
  EDWW_WWC_CTR: { requires: ["ALR", "EMS", "MAR"], label: "Bremen Radar" },
  EDWW_ALR_CTR: { requires: ["ALR"], label: "Aller" },
  EDWW_BOR_CTR: { requires: ["MAR"], label: "Börde" },
  EDWW_EID_CTR: { requires: ["ALR"], label: "Eider" },
  EDWW_WWW_CTR: { requires: ["ALR", "EMS"], label: "Bremen West" },
  EDWW_EMS_CTR: { requires: ["EMS"], label: "Ems" },
  EDWW_FLG_CTR: { requires: ["MAR"], label: "Flämig" },
  EDWW_HEI_CTR: { requires: ["ALR"], label: "Heide" },
  EDWW_HRZ_CTR: { requires: ["EMS"], label: "Harz" },
  EDWW_MAR_CTR: { requires: ["MAR"], label: "Mark" },
  EDWW_MRZ_CTR: { requires: ["MAR"], label: "Müritz" },

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
