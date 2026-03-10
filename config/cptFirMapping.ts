/**
 * Minimal mapping of training airports (where CPTs can take place) to their FIR.
 *
 * Only the 4-character ICAO prefix of the airport is stored here.
 * CTR positions carry the FIR code as their own prefix (e.g. EDMM_WLD_CTR),
 * so they are matched directly without an entry in this map.
 */
export const CPT_AIRPORT_TO_FIR: Record<string, string> = {
  // FIR München (EDMM)
  EDDM: 'EDMM',
  EDDN: 'EDMM',
  EDDP: 'EDMM',

  // FIR Langen (EDGG)
  EDDF: 'EDGG',
  EDDK: 'EDGG',
  EDDS: 'EDGG',
  EDDL: 'EDGG',

  // FIR Bremen (EDWW)
  EDDH: 'EDWW',
  EDDB: 'EDWW',
  EDDV: 'EDWW',
};

/** Human-readable FIR display names. */
export const CPT_FIR_NAMES: Record<string, string> = {
  EDMM: 'FIR München',
  EDGG: 'FIR Langen',
  EDWW: 'FIR Bremen',
};

/**
 * Returns true if a CPT position belongs to the given FIR.
 *
 * Logic:
 *  - CTR positions (prefix = FIR code, e.g. EDMM_WLD_CTR) → prefix === firCode
 *  - All other positions (TWR/APP/…) → look up the 4-char airport prefix in CPT_AIRPORT_TO_FIR
 */
export function cptBelongsToFir(position: string, firCode: string): boolean {
  const prefix = position.slice(0, 4).toUpperCase();
  if (prefix === firCode) return true;
  return CPT_AIRPORT_TO_FIR[prefix] === firCode;
}
