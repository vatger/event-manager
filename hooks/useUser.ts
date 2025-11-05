"use client";

import useSWR from "swr";
import axios from "axios";
import { CurrentUser } from "@/types/fir";
import { da } from "date-fns/locale";

const fetcher = async (url: string): Promise<CurrentUser> => {
  const res = await axios.get<CurrentUser>(url);
  return res.data;
};

export function useUser() {
  const { data, error, isLoading, mutate } = useSWR<CurrentUser>(
    "/api/user/me",
    fetcher
  );

  // ---------- PERMISSION HELPERS ----------
  const can = (perm: string): boolean => {
    if(!data) return false
    if(data.role == "MAIN_ADMIN") return true
    if(perm == "MAIN_ADMIN") return false
    if(data.effectivePermissions.includes("*")) return true
    if(data.effectivePermissions.includes(perm)) return true
    return false
  };

  const canInFIR = (firCode: string, perm: string): boolean => {
    if(data?.effectiveLevel == "MAIN_ADMIN") return true;
    if(data?.effectivePermissions.includes("*")) return true;
    return data?.firScopedPermissions[firCode]?.includes(perm) ?? false;
  }

  const canInOwnFIR = (perm: string): boolean => {
    if(data?.effectiveLevel == "MAIN_ADMIN") return true
    const code = data?.fir?.code;
    if (!code) return false;
    if(data?.effectivePermissions.includes("*")) return true;
    return data?.firScopedPermissions[code]?.includes(perm) ?? false;
  };

  const isFIRLead = (firCode?: string): boolean => {
    const code = firCode ?? data?.fir?.code;
    if (!code) return false;
    return data?.firLevels[code] === "FIR_EVENTLEITER";
  };

  const isVATGERLead = (): boolean =>
    data?.effectiveLevel === "VATGER_LEITUNG" || data?.effectiveLevel === "MAIN_ADMIN";

  const isMainAdmin = (): boolean => data?.role === "MAIN_ADMIN";

  const hasAdminAcess = (): boolean => {
    if(data?.role == "MAIN_ADMIN") return true;
    if(data?.effectiveLevel == "VATGER_LEITUNG") return true;
    if(data?.groups && data?.groups.length > 0) return true;
    
    return false

  }
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
  };
}
