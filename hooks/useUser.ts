"use client";

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
    fetcher
  );

  // ---------- PERMISSION HELPERS ----------
  const can = (perm: string): boolean =>
    (data?.effectivePermissions.includes(perm) ?? false) ||
    data?.effectiveLevel == "MAIN_ADMIN"

  const canInFIR = (firCode: string, perm: string): boolean => {
    if(data?.effectiveLevel == "MAIN_ADMIN") return true; 
    return data?.firScopedPermissions[firCode]?.includes(perm) ?? false;
  }

  const canInOwnFIR = (perm: string): boolean => {
    if(data?.effectiveLevel == "MAIN_ADMIN") return true
    const code = data?.fir?.code;
    if (!code) return false;
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

  const hasAdminAcess = (): boolean => 
    (data?.effectivePermissions.includes("admin.access") ?? false) ||
    data?.effectiveLevel == "MAIN_ADMIN";

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
