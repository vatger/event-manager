import type { PermissionKey } from "@/lib/acl/catalog";
import type { ExplainedPermission } from "@/lib/acl/access";

export type GroupKind = "FIR_LEITUNG" | "CUSTOM";

export interface FIR {
  id: number;
  code: string;
  name: string;
}

export interface TeamMember {
  cid: number;
  name: string;
  rating: string;
}

/** Eine Gruppe eines FIR-Eventdepartments mit Mitgliedern und Rechten */
export interface TeamGroup {
  id: number;
  name: string;
  description: string | null;
  kind: GroupKind;
  /** Vergebene Rechte. Bei der Leitungsgruppe leer – sie hat fest alle. */
  permissions: PermissionKey[];
  members: TeamMember[];
}

/** Was der angemeldete Nutzer in einem Department tun darf */
export interface DepartmentViewer {
  /** VATGER-Eventleitung oder Main-Admin: verwaltet auch die Leitungsgruppe */
  isGlobal: boolean;
}

export interface Department {
  code: string;
  name: string;
  groups: TeamGroup[];
  viewer: DepartmentViewer;
}

export interface DepartmentSummary {
  code: string;
  name: string;
  groupCount: number;
  memberCount: number;
  leads: TeamMember[];
}

/** Treffer der Personensuche beim Hinzufügen zu einer Gruppe */
export interface TeamUserSearchResult extends TeamMember {
  /** FIR, deren Department die Person bereits angehört (null = keinem) */
  firCode: string | null;
}

/** Zugriff einer Person in einem Department – jedes Recht mit Herkunft */
export interface PersonAccess extends TeamMember {
  isMainAdmin: boolean;
  isVatgerLeitung: boolean;
  groups: Array<{ id: number; name: string; kind: GroupKind }>;
  permissions: ExplainedPermission[];
  objectRoles: {
    responsibleEvents: Array<{ id: number; name: string; startTime: string }>;
    managedWeeklys: Array<{ id: number; name: string }>;
    rosterEditorEvents: Array<{ id: number; name: string; startTime: string }>;
    cptResponsible: boolean;
  };
}

export interface VatgerLeader extends TeamMember {
  /** Zusätzlich Main-Admin (Systemadministration) */
  isMainAdmin: boolean;
}

export interface MainAdmin {
  cid: number;
  name: string | null;
  rating: string | null;
}

export interface CurrentUser {
  cid: number;
  name: string;
  rating: string;
  fir: FIR | null;
  groups: Array<{ id: number; name: string; kind: GroupKind; fir: FIR | null }>;

  /** Enthält "*" für VATGER-Eventleitung und Main-Admins, sonst leer */
  effectivePermissions: string[];

  /** FIR-Code → Rechte des Nutzers in dieser FIR */
  firScopedPermissions: Record<string, PermissionKey[]>;

  /** Globales Level des Nutzers */
  effectiveLevel: "USER" | "FIR_EVENTLEITER" | "VATGER_LEITUNG" | "MAIN_ADMIN";

  /** FIR-Code → Rolle im Eventdepartment ("FIR_EVENTLEITER" = Leitungsgruppe) */
  firLevels: Record<string, "FIR_EVENTLEITER" | "FIR_TEAM">;

  /** IDs der Weekly Events, für die der Nutzer als Verantwortlicher eingetragen ist */
  managedWeeklyIds: number[];
}
