import { PERMISSION_CATALOG, getPermission, isPermissionKey, type PermissionKey } from "./catalog";

/**
 * Erklärt, woher ein Nutzer seine Rechte in einer FIR hat – Grundlage der
 * Ansicht „Zugriff“ im Bereich „Team & Rechte“. Reine Berechnung.
 */

export interface AccessSource {
  /** leitung: über die Leitungsgruppe · group: direkt vergeben · included: in einem anderen Recht enthalten */
  type: "leitung" | "group" | "included";
  /** Name der Gruppe, die das Recht (oder das enthaltende Recht) vergibt */
  groupName: string;
  /** Bei "included": das Recht, das dieses mit abdeckt */
  via?: PermissionKey;
}

export interface ExplainedPermission {
  key: PermissionKey;
  granted: boolean;
  sources: AccessSource[];
}

export interface AccessGroup {
  name: string;
  kind: string;
  permissions: string[];
}

export function explainPermissions(groups: AccessGroup[]): ExplainedPermission[] {
  return PERMISSION_CATALOG.map(({ key, explicitOnly }) => {
    const sources: AccessSource[] = [];

    for (const group of groups) {
      if (group.kind === "FIR_LEITUNG") {
        if (explicitOnly) continue;
        sources.push({ type: "leitung", groupName: group.name });
        continue;
      }
      const keys = group.permissions.filter(isPermissionKey);
      if (keys.includes(key)) {
        sources.push({ type: "group", groupName: group.name });
        continue;
      }
      const via = keys.find((k) => getPermission(k).includes?.includes(key));
      if (via) sources.push({ type: "included", groupName: group.name, via });
    }

    return { key, granted: sources.length > 0, sources };
  });
}
