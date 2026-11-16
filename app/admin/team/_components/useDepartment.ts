"use client";

import useSWR from "swr";
import { teamApi } from "@/lib/api/team";
import type { Department } from "@/types/fir";

/** Lädt das Eventdepartment einer FIR; `reload` holt den Stand nach Änderungen neu. */
export function useDepartment(code: string) {
  const { data, error, isLoading, mutate } = useSWR<Department, Error>(
    code ? ["department", code] : null,
    () => teamApi.getDepartment(code),
    { revalidateOnFocus: false }
  );

  return {
    department: data,
    error,
    loading: isLoading,
    reload: () => mutate(),
  };
}
