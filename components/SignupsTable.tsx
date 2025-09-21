"use client";

import React, { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export type TimeRange = { start: string; end: string };

export type SignupRow = {
  id: string | number;
  userCID?: string | number;
  user?: { cid?: string | number; name?: string };
  endorsement?: string | null;
  availability?: { available?: TimeRange[]; unavailable?: TimeRange[] };
  preferredStations?: string | null;
  remarks?: string | null;
};

export type SignupTableColumn =
  | "cid"
  | "name"
  | "availability"
  | "preferredStations"
  | "remarks";

type SignupsTableProps = {
  signups: SignupRow[];
  loading?: boolean;
  error?: string;
  columns: SignupTableColumn[];
  emptyMessage?: string;
  groupBy?: "endorsement" | "none";
};

const PRIORITY: Record<string, number> = { DEL: 0, GND: 1, TWR: 2, APP: 3, CTR: 4 };

function badgeClassFor(endorsement?: string | null) {
  if(!endorsement) return "bg-gray-100 text-gray-800"
  switch (endorsement) {
    case "DEL":
      return "bg-green-100 text-green-800";
    case "GND":
      return "bg-blue-100 text-blue-800";
    case "TWR":
      return "bg-amber-100 text-amber-800";
    case "APP":
      return "bg-purple-100 text-purple-800";
    case "CTR":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function formatAvailability(av?: { available?: TimeRange[]; unavailable?: TimeRange[] }): string {
  if (av?.unavailable && av.unavailable.length === 0) return "full";
  const ranges = av?.available ?? [];
  if (ranges.length === 0) return "-";
  return ranges.map((r) => `${r.start}z-${r.end}z`).join(", ");
}

const HEAD_LABELS: Record<SignupTableColumn, string> = {
  cid: "CID",
  name: "Name",
  availability: "Availability",
  preferredStations: "Desired Position",
  remarks: "RMK",
};

export default function SignupsTable(props: SignupsTableProps) {
  const { signups, loading, error, columns, emptyMessage = "Keine Anmeldungen", groupBy = "endorsement" } = props;

  const grouped = useMemo(() => {
    if (groupBy !== "endorsement") {
      return { ALL: signups } as Record<string, SignupRow[]>;
    }
    const out: Record<string, SignupRow[]> = {};
    for (const s of signups) {
      const key = (s.endorsement || "UNSPEC") as string;
      if (!out[key]) out[key] = [];
      out[key].push(s);
    }
    return out;
  }, [signups, groupBy]);

  const orderedAreas = useMemo(() => {
    const keys = Object.keys(grouped);
    if (groupBy !== "endorsement") return keys;
    const idx = (v: string) => PRIORITY[v] ?? 999;
    return keys.sort((a, b) => idx(a) - idx(b));
  }, [grouped, groupBy]);

  const colCount = columns.length;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((c) => (
            <TableHead key={c}>{HEAD_LABELS[c]}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          <TableRow>
            <TableCell colSpan={colCount}>Laden...</TableCell>
          </TableRow>
        ) : error ? (
          <TableRow>
            <TableCell colSpan={colCount} className="text-red-500">{error}</TableCell>
          </TableRow>
        ) : signups.length === 0 ? (
          <TableRow>
            <TableCell colSpan={colCount} className="text-muted-foreground">{emptyMessage}</TableCell>
          </TableRow>
        ) : (
          orderedAreas.flatMap((area) => [
            groupBy === "endorsement" ? (
              <TableRow key={`group-${area}`}>
                <TableCell colSpan={colCount} className="bg-muted/50 font-semibold">
                  {area}
                </TableCell>
              </TableRow>
            ) : null,
            ...(grouped[area] || []).map((s) => (
              <TableRow key={String(s.id)}>
                {columns.map((col) => {
                  switch (col) {
                    case "cid":
                      return (
                        <TableCell key={`${s.id}-cid`}>{s.user?.cid ?? s.userCID}</TableCell>
                      );
                    case "name": {
                      const name = s.user?.name ?? "";
                      return (
                        <TableCell key={`${s.id}-name`} className="flex items-center gap-2">
                          {name}
                          <Badge className={badgeClassFor(s.endorsement)}>{s.endorsement || "UNSPEC"}</Badge>
                        </TableCell>
                      );
                    }
                    case "availability":
                      return (
                        <TableCell key={`${s.id}-av`}>{formatAvailability(s.availability)}</TableCell>
                      );
                    case "preferredStations":
                      return (
                        <TableCell key={`${s.id}-pref`}>{s.preferredStations || "-"}</TableCell>
                      );
                    case "remarks":
                      return (
                        <TableCell key={`${s.id}-rmk`}>{s.remarks ?? "-"}</TableCell>
                      );
                    default:
                      return <TableCell key={`${s.id}-unk`} />;
                  }
                })}
              </TableRow>
            )),
          ])
        )}
      </TableBody>
    </Table>
  );
}
