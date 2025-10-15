"use client";

import React, { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import SignupEditDialog from "@/components/SignupEditDialog";
import { Edit } from "lucide-react";
import { Signup, TimeRange } from "@/types";

export type SignupRow = Signup;

export type EventRef = {
  id: string | number;
  startTime: string;
  endTime: string;
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
  editable?: boolean;
  event?: EventRef;
  onRefresh?: () => void;
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
    case "S1":
      return "bg-blue-100 text-blue-800";
    case "S2":
      return "bg-amber-100 text-amber-800";
    case "S3":
      return "bg-purple-100 text-purple-800";
    case "C1":
      return "bg-red-100 text-red-800";
    case "C2":
      return "bg-red-100 text-red-800";
    case "C3":
      return "bg-red-100 text-red-800";
    case "I1":
      return "bg-red-100 text-red-800";
    case "I2":
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
  const { signups, loading, error, columns, emptyMessage = "Keine Anmeldungen", groupBy = "endorsement", editable = false, event, onRefresh } = props;
  const [editOpen, setEditOpen] = useState(false);
  const [editSignup, setEditSignup] = useState<SignupRow | null>(null);

  const grouped = useMemo(() => {
    if (groupBy !== "endorsement") {
      return { ALL: signups } as Record<string, SignupRow[]>;
    }
    const out: Record<string, SignupRow[]> = {};
    for (const s of signups) {
      const key = (s.endorsement || s.user?.rating || "UNSPEC") as string;
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

  const hasActions = editable;
  const finalColumns = hasActions ? [...columns, "__actions__"] : columns;

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            {finalColumns.map((c) => (
              <TableHead key={c}>{c === "__actions__" ? "" : HEAD_LABELS[c as SignupTableColumn]}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
        {loading ? (
          <TableRow>
            <TableCell colSpan={finalColumns.length}>Laden...</TableCell>
          </TableRow>
        ) : error ? (
          <TableRow>
            <TableCell colSpan={finalColumns.length} className="text-red-500">{error}</TableCell>
          </TableRow>
        ) : signups.length === 0 ? (
          <TableRow>
            <TableCell colSpan={finalColumns.length} className="text-muted-foreground">{emptyMessage}</TableCell>
          </TableRow>
        ) : (
          orderedAreas.flatMap((area) => [
            groupBy === "endorsement" ? (
              <TableRow key={`group-${area}`}>
                <TableCell colSpan={finalColumns.length} className="bg-muted/50 font-semibold">
                  {area}
                </TableCell>
              </TableRow>
            ) : null,
            ...(grouped[area] || []).map((s) => (
              <TableRow key={String(s.id)}>
                {finalColumns.map((col) => {
                  if (col === "__actions__") {
                    return (
                      <TableCell key={`${s.id}-actions`} className="text-right">
                        <Button size="sm" variant="outline" onClick={() => { setEditSignup(s); setEditOpen(true); }} disabled={!event}>
                          <Edit />
                        </Button>
                      </TableCell>
                    );
                  }
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
                          <Badge className={badgeClassFor(s.endorsement || s.user?.rating)}>{s.endorsement || s.user?.rating || "UNSPEC"}</Badge>
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

      {editable && event && (
        <SignupEditDialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
          signup={editSignup}
          event={event}
          onSaved={onRefresh}
          onDeleted={onRefresh}
        />
      )}
    </>
  );
}
