import { UserResponse } from "@/hooks/useUser";

/**
 * Prüft, ob ein User eine bestimmte Berechtigung hat.
 * Wird rein clientseitig genutzt.
 */
export function hasPermission(user: UserResponse | undefined, key: string): boolean {
  if (!user) return false;
  if (user.role === "MAIN_ADMIN") return true;
  return user.effectivePermissions.includes(key);
}

/**
 * Prüft, ob der Nutzer zu einem bestimmten "Level" gehört.
 * z.B. "VATGER_LEITUNG", "FIR_EVENTLEITER"
 */
export function hasLevel(user: UserResponse | undefined, level: string): boolean {
  return user?.effectiveLevel === level;
}
