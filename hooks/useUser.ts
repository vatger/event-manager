"use client";

import { useCallback } from "react";
import useSWR from "swr";
import axios from "axios";
import { CurrentUser } from "@/types/fir";

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
  const can = useCallback((perm: string): boolean => {
    if(!data) return false
    if(data.effectiveLevel == "MAIN_ADMIN") return true
    if(perm == "MAIN_ADMIN") return false
    if(data.effectivePermissions.includes("*")) return true
    if(data.effectivePermissions.includes(perm)) return true
    return false
  }, [data]);

  const canInFIR = useCallback((firCode: string, perm: string): boolean => {
    if(data?.effectiveLevel == "MAIN_ADMIN") return true;
    if(data?.effectivePermissions.includes("*")) return true;
    return data?.firScopedPermissions[firCode]?.includes(perm) ?? false;
  }, [data]);

  const canInOwnFIR = useCallback((perm: string): boolean => {
    if(data?.effectiveLevel == "MAIN_ADMIN") return true
    const code = data?.fir?.code;
    if (!code) return false;
    if(data?.effectivePermissions.includes("*")) return true;
    return data?.firScopedPermissions[code]?.includes(perm) ?? false;
  }, [data]);

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
    if (data.groups && data.groups.length > 0) return false;
    return (data.managedWeeklyIds?.length ?? 0) > 0;
  }, [data]);

  const hasAdminAcess = useCallback((): boolean => {
    if(data?.effectiveLevel == "MAIN_ADMIN") return true;
    if(data?.effectiveLevel == "VATGER_LEITUNG") return true;
    if(data?.groups && data?.groups.length > 0) return true;
    // Weekly managers also need admin access to reach the roster editor
    if(data?.managedWeeklyIds && data.managedWeeklyIds.length > 0) return true;
    
    return false

  }, [data]);

  //Returns true if the user is assigned to the FIR-Team of the given FIR code or is main admin. Used to determine if FIR team features should be shown.
  const isEventFirTeamMember = useCallback((firCode: string): boolean => {
    if(data?.effectiveLevel == "MAIN_ADMIN") return true;
    if (data?.effectiveLevel === "VATGER_LEITUNG") return true;
    if(!data?.fir) return false;
    return data.firLevels[firCode] !== undefined;
  }, [data]);
  
  // ---------- RETURN ----------
  return {
    user: data,
    loading: isLoading,
    error,
    mutate,

    can,
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
