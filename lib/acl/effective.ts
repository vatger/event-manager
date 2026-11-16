import { LEITUNG_PERMISSION_KEYS, isPermissionKey, type PermissionKey } from "./catalog";
import { isMainAdminCid } from "./mainAdmins";

/**
 * Reine Berechnung der Rollen und Rechte eines Nutzers – ohne Datenbankzugriff,
 * damit sie sich testen lässt. Geladen wird in policies.ts.
 *
 * Das Modell:
 *  - MAIN_ADMIN      Systemadministration, ausschließlich über MAIN_ADMIN_CIDS.
 *  - VATGER_LEITUNG  führt alle Eventdepartments, darf inhaltlich alles.
 *  - FIR-Leitung     Mitglied der einen Leitungsgruppe einer FIR: alle Rechte
 *                    des Katalogs in dieser FIR (außer den nur ausdrücklich
 *                    vergebenen), verwaltet deren Untergruppen.
 *  - FIR-Team        Mitglied irgendeiner Gruppe der FIR: Grundrechte plus die
 *                    Rechte seiner Gruppen.
 */

export type EffectiveLevel = "USER" | "FIR_EVENTLEITER" | "VATGER_LEITUNG" | "MAIN_ADMIN";
export type FirLevel = "FIR_EVENTLEITER" | "FIR_TEAM";

export interface EffectiveData {
  /** Enthält "*" für MAIN_ADMIN und VATGER_LEITUNG, sonst leer. */
  effectivePermissions: string[];
  /** FIR-Code → Rechte, die der Nutzer in dieser FIR hat */
  firScopedPermissions: Record<string, PermissionKey[]>;
  effectiveLevel: EffectiveLevel;
  /** FIR-Code → Rolle im Eventdepartment dieser FIR */
  firLevels: Record<string, FirLevel>;
}

/** Die Ausschnitte eines Nutzers, die für die Berechnung nötig sind. */
export interface AclSubject {
  cid: number;
  vatgerLeitung: unknown | null;
  groups: Array<{
    group: {
      kind: string;
      fir: { code: string } | null;
      permissions: Array<{ permission: { key: string } }>;
    } | null;
  }>;
}

export function computeEffectiveData(user: AclSubject): EffectiveData {
  const firPermissions: Record<string, Set<PermissionKey>> = {};
  const firLevels: Record<string, FirLevel> = {};

  for (const ug of user.groups) {
    const group = ug.group;
    // Gruppen ohne FIR vergeben nichts: FIR-übergreifend arbeitet nur die
    // VATGER-Eventleitung.
    const firCode = group?.fir?.code;
    if (!group || !firCode) continue;

    const perms = (firPermissions[firCode] ??= new Set());

    if (group.kind === "FIR_LEITUNG") {
      firLevels[firCode] = "FIR_EVENTLEITER";
      LEITUNG_PERMISSION_KEYS.forEach((key) => perms.add(key));
      continue;
    }

    firLevels[firCode] ??= "FIR_TEAM";
    for (const gp of group.permissions) {
      if (isPermissionKey(gp.permission.key)) perms.add(gp.permission.key);
    }
  }

  // MAIN_ADMIN hat Vorrang – auch wenn die Person zusätzlich in der
  // VATGER-Eventleitung steht.
  let effectiveLevel: EffectiveLevel = "USER";
  if (isMainAdminCid(user.cid)) effectiveLevel = "MAIN_ADMIN";
  else if (user.vatgerLeitung) effectiveLevel = "VATGER_LEITUNG";
  else if (Object.values(firLevels).includes("FIR_EVENTLEITER")) effectiveLevel = "FIR_EVENTLEITER";

  const isGlobal = effectiveLevel === "MAIN_ADMIN" || effectiveLevel === "VATGER_LEITUNG";

  return {
    effectivePermissions: isGlobal ? ["*"] : [],
    firScopedPermissions: Object.fromEntries(
      Object.entries(firPermissions).map(([code, set]) => [code, Array.from(set)])
    ),
    effectiveLevel,
    firLevels,
  };
}

/** Darf inhaltlich alles in allen FIRs (VATGER-Eventleitung oder Main-Admin)? */
export function isGlobalLevel(level: EffectiveLevel): boolean {
  return level === "MAIN_ADMIN" || level === "VATGER_LEITUNG";
}
