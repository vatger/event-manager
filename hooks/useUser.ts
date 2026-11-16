"use client";

import { useCallback } from "react";
import useSWR from "swr";
import axios from "axios";
import { CurrentUser } from "@/types/fir";
import type { PermissionKey } from "@/lib/acl/catalog";

const fetcher = async (url: string): Promise<CurrentUser> => {
  const res = await axios.get<CurrentUser>(url);
  return res.data;
};

export function useUser() {
  const { data, error, isLoading, mutate } = useSWR<CurrentUser>(
    "/api/user/me",
    fetcher,
  );

  // ---------- PERMISSION HELPERS ----------
  // Rechte gelten immer je FIR. VATGER-Eventleitung und Main-Admins haben
  // "*" und damit jedes Recht in jeder FIR.
  const hasAll = data?.effectivePermissions.includes("*") ?? false;

  const canInFIR = useCallback((firCode: string, perm: PermissionKey): boolean => {
    if (!data) return false;
    if (hasAll) return true;
    return data.firScopedPermissions[firCode]?.includes(perm) ?? false;
  }, [data, hasAll]);

  const canInOwnFIR = useCallback((perm: PermissionKey): boolean => {
    if (!data) return false;
    if (hasAll) return true;
    const code = data.fir?.code;
    if (!code) return false;
    return data.firScopedPermissions[code]?.includes(perm) ?? false;
  }, [data, hasAll]);

  const isFIRLead = useCallback((firCode?: string): boolean => {
    const code = firCode ?? data?.fir?.code;
    if (!code) return false;
    return data?.firLevels[code] === "FIR_EVENTLEITER";
  }, [data]);

  const isVATGERLead = useCallback((): boolean =>
    data?.effectiveLevel === "VATGER_LEITUNG" || data?.effectiveLevel === "MAIN_ADMIN", [data]);

  const isMainAdmin = useCallback((): boolean => data?.effectiveLevel === "MAIN_ADMIN", [data]);

  const isWeeklyManager = useCallback((configId?: number): boolean => {
    if (!data?.managedWeeklyIds || data.managedWeeklyIds.length === 0) return false;
    if (configId === undefined) return data.managedWeeklyIds.length > 0;
    return data.managedWeeklyIds.includes(configId);
  }, [data]);

  /**
   * Returns true when the user's only admin access is via managedWeeklyIds.
   * These users have no FIR-level group memberships and are not VATGER leads.
   */
  const isPureWeeklyManager = useCallback((): boolean => {
    if (!data) return false;
    if (data.effectiveLevel === "MAIN_ADMIN" || data.effectiveLevel === "VATGER_LEITUNG") return false;
    if (Object.keys(data.firLevels).length > 0) return false;
    return (data.managedWeeklyIds?.length ?? 0) > 0;
  }, [data]);

  const hasAdminAcess = useCallback((): boolean => {
    if(data?.effectiveLevel == "MAIN_ADMIN") return true;
    if(data?.effectiveLevel == "VATGER_LEITUNG") return true;
    if(data && Object.keys(data.firLevels).length > 0) return true;
    // Weekly managers also need admin access to reach the roster editor
    if(data?.managedWeeklyIds && data.managedWeeklyIds.length > 0) return true;
    
    return false

  }, [data]);

  // Gehört der Nutzer zum Eventdepartment der FIR (Mitglied irgendeiner ihrer
  // Gruppen)? VATGER-Eventleitung und Main-Admins zählen überall dazu.
  const isEventFirTeamMember = useCallback((firCode: string): boolean => {
    if(data?.effectiveLevel == "MAIN_ADMIN") return true;
    if (data?.effectiveLevel === "VATGER_LEITUNG") return true;
    return data?.firLevels[firCode] !== undefined;
  }, [data]);
  
  // ---------- RETURN ----------
  return {
    user: data,
    loading: isLoading,
    error,
    mutate,

    canInFIR,
    canInOwnFIR,
    isFIRLead,
    isVATGERLead,
    isMainAdmin,
    hasAdminAcess,
    isWeeklyManager,
    isPureWeeklyManager,
    isEventFirTeamMember
  };
}
