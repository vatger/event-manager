/**
 * Returns the list of main admin CIDs from the MAIN_ADMIN_CIDS env variable.
 * CIDs are stored as a comma-separated list (e.g. "1234567,7654321").
 */
export function getMainAdminCids(): number[] {
  const raw = process.env.MAIN_ADMIN_CIDS || '';
  return raw
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}

/**
 * Returns true if the given CID belongs to a main admin (as configured via env).
 */
export function isMainAdminCid(cid: number): boolean {
  return getMainAdminCids().includes(cid);
}
