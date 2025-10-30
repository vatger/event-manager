"use client";

import useSWR from "swr";
import axios from "axios";
import { CurrentUser } from "@/types/fir";

const fetcher = async (url: string): Promise<CurrentUser> => {
  const res = await axios.get<CurrentUser>(url);
  return res.data;
};

export function useUser() {
  const { data, error, mutate, isLoading } = useSWR<CurrentUser>(
    "/api/users/me",
    fetcher
  );

  return {
    user: data,
    loading: isLoading,
    error,
    mutate,

    // 🔹 Permission-Checks konsistent mit deinem Modell:
    can: (perm: string) => data?.effectivePermissions.includes(perm) ?? false,

    canInFIR: (firCode: string, perm: string) =>
      data?.firScopedPermissions[firCode]?.includes(perm) ?? false,

    isFIRLead: (firCode: string) =>
      data?.firLevels[firCode] === "FIR_EVENTLEITER",

    isVATGERLead: () => data?.effectiveLevel === "VATGER_LEITUNG",
  };
}
