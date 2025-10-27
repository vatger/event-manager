import prisma from "@/lib/prisma"
import { GroupKind, PermissionScope, Role } from "@prisma/client"
import { RESTRICTED_GROUP_KINDS, RESTRICTED_PERMISSION_KEYS, ALLOWED_SCOPES } from "./constants"

export type EffectiveLevel = "MAIN_ADMIN" | "VATGER_LEITUNG" | "FIR_LEITUNG" | "EVENTLER" | "USER"

export async function getEffectiveLevel(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      firId: true,
      groups: {
        select: {
          group: { select: { kind: true, firId: true } }
        }
      }
    }
  })
  if (!user) return { level: "USER" as EffectiveLevel, firId: null }

  if (user.role === Role.MAIN_ADMIN) return { level: "MAIN_ADMIN" as EffectiveLevel, firId: null }

  const isVatgerLead = user.groups.some(g => g.group.kind === GroupKind.GLOBAL_VATGER_LEITUNG)
  if (isVatgerLead) return { level: "VATGER_LEITUNG" as EffectiveLevel, firId: null }

  const firLeadGroup = user.groups.find(g => g.group.kind === GroupKind.FIR_LEITUNG && g.group.firId === user.firId)
  if (firLeadGroup) return { level: "FIR_LEITUNG" as EffectiveLevel, firId: user.firId ?? null }

  const isEventler = user.groups.some(g => g.group.kind === GroupKind.FIR_TEAM && g.group.firId === user.firId)
  if (isEventler) return { level: "EVENTLER" as EffectiveLevel, firId: user.firId ?? null }

  return { level: "USER" as EffectiveLevel, firId: user.firId ?? null }
}

// --- Policy Guards ---

export function canAssignAllScope(level: EffectiveLevel) {
  return level === "MAIN_ADMIN" || level === "VATGER_LEITUNG"
}

export function canManageGroupMembership(level: EffectiveLevel, targetGroupKind: GroupKind, actorFirId: number | null, targetGroupFirId: number | null) {
  if (level === "MAIN_ADMIN" || level === "VATGER_LEITUNG") return true

  if (level === "FIR_LEITUNG") {
    // nur innerhalb eigener FIR und niemals an FIR_LEITUNG schrauben
    const sameFir = actorFirId && actorFirId === (targetGroupFirId ?? null)
    if (!sameFir) return false
    if (targetGroupKind === GroupKind.FIR_LEITUNG || targetGroupKind === GroupKind.GLOBAL_VATGER_LEITUNG) return false
    // d.h. FIR-Leitung darf nur FIR_TEAM verwalten
    return targetGroupKind === GroupKind.FIR_TEAM
  }

  return false
}

export function canEditGroupPermissions(level: EffectiveLevel, targetGroupKind: GroupKind, actorFirId: number | null, targetGroupFirId: number | null, scope: PermissionScope, permissionKey: string) {
  if (level === "MAIN_ADMIN" || level === "VATGER_LEITUNG") {
    // Globale dürfen alles, inkl. ALL-Scopes
    return true
  }

  if (level === "FIR_LEITUNG") {
    const sameFir = actorFirId && actorFirId === (targetGroupFirId ?? null)
    if (!sameFir) return false
    // FIR-Leitung darf nur OWN_FIR vergeben
    if (scope === PermissionScope.ALL) return false
    // Und niemals mächtige Schlüssel an FIR_LEITUNG verteilen
    if (targetGroupKind === GroupKind.FIR_LEITUNG) {
      if (permissionKey === RESTRICTED_PERMISSION_KEYS.GROUP_MANAGE) return false
    }
    // Für FIR_TEAM ok (auch group.manage mit OWN_FIR, wenn gewünscht)
    return true
  }

  return false
}
