"use client";

import * as React from "react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw } from "lucide-react";

// ---------- API Response Types ----------
type PermissionScope = "OWN_FIR" | "ALL";

type ApiPermission = {
  key: string;
  description?: string | null;
  scope: PermissionScope;
};

type ApiMember = {
  id: number;
  cid: string;
  name: string;
  rating: string;
  role: "USER" | "MAINADMIN";
};

type GroupKind = "FIR_LEITUNG" | "FIR_TEAM" | "GLOBAL_VATGER_LEITUNG" | "CUSTOM";

type ApiGroup = {
  id: number;
  name: string;
  kind: GroupKind;
  description?: string | null;
  members: ApiMember[];
  permissions: ApiPermission[];
};

type ApiFIR = {
  id: number;
  code: string;
  name: string;
  groups: ApiGroup[];
};

// ---------- Page Component ----------
export default function FIRListPage() {
  const [data, setData] = useState<ApiFIR[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState<string>("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/firs", { cache: "no-store" });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `HTTP ${res.status}`);
      }
      const json: ApiFIR[] = await res.json();
      setData(json);
    } catch (e) {
      console.error(e);
      setError("Konnte FIRs nicht laden.");
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // initial load
    void load();
  }, []);

  const filtered = useMemo<ApiFIR[]>(() => {
    if (!data) return [];
    const term = q.trim().toLowerCase();
    if (!term) return data;
    return data.filter(
      (f) =>
        f.code.toLowerCase().includes(term) ||
        f.name.toLowerCase().includes(term)
    );
  }, [data, q]);

  const totalMembersOf = (fir: ApiFIR) =>
    (fir.groups ?? []).reduce((acc, g) => acc + (g.members?.length ?? 0), 0);

  if (loading && !data) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Laden…
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">FIRs</h1>
        <div className="ml-auto flex gap-2">
          <Input
            placeholder="FIR suchen (Code oder Name)…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-64"
          />
          <Button variant="outline" onClick={load}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Aktualisieren
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="text-sm text-red-600">{error}</div>
      )}

      {/* Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((fir) => {
          const groups = fir.groups ?? [];
          const leitung = groups.find((g) => g.kind === "FIR_LEITUNG");
          const team = groups.find((g) => g.kind === "FIR_TEAM");
          const members = totalMembersOf(fir);

          return (
            <Card key={fir.id} className="flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    {fir.code}
                    <span className="text-muted-foreground font-normal">
                      {" "}
                      — {fir.name}
                    </span>
                  </CardTitle>
                  <Badge variant="secondary">{members} Members</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-3">
                <div className="text-sm text-muted-foreground">
                  <div>
                    Leitung:{" "}
                    <strong>{leitung?.members?.length ?? 0}</strong>
                  </div>
                  <div>
                    Event Team:{" "}
                    <strong>{team?.members?.length ?? 0}</strong>
                  </div>
                  <div>
                    Gruppen: <strong>{groups.length}</strong>
                  </div>
                </div>
                <div className="pt-2">
                  <Button asChild className="w-full">
                    <Link href={`/admin/firs/${encodeURIComponent(fir.code)}`}>
                      Details & Team verwalten
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Empty state */}
      {!filtered.length && !error && (
        <div className="text-sm text-muted-foreground">
          Keine FIRs gefunden.
        </div>
      )}
    </div>
  );
}
