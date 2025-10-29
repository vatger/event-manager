"use client";

import useSWR from "swr";
import axios from "axios";

export interface UserResponse {
  cid: number;
  name: string;
  rating: string;
  role: string;
  fir: { id: number; code: string; name: string } | null;
  groups: {
    id: number;
    name: string;
    kind: string;
    fir: { id: number; code: string; name: string } | null;
  }[];
  effectivePermissions: string[];
  effectiveLevel: string;
}

export function useUser() {
  const { data, error, isLoading, mutate } = useSWR<UserResponse>(
    "/api/user/me",
    async (url) => {
      const res = await axios.get(url);
      return res.data;
    },
    { refreshInterval: 5 * 60 * 1000 } // alle 5 Minuten aktualisieren
  );

  return {
    user: data,
    loading: isLoading,
    error,
    refreshUser: mutate,
  };
}
