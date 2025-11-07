"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import SignupEditDialog from "@/app/admin/events/[id]/_components/SignupEditDialog";
import { Edit } from "lucide-react";
import { Signup, TimeRange } from "@/types";
import { getBadgeClassForEndorsement } from "@/utils/EndorsementBadge";
import { EndorsementResponse } from "@/lib/endorsements/types";
import { getRatingValue } from "@/utils/ratingToValue";
import { useUser } from "@/hooks/useUser";

export type SignupRow = Signup;

export type EventRef = {
  id: string | number;
  startTime: string;
  endTime: string;
  airport?: string; // for dynamic group lookup
  fir?: string;     // optional FIR for CTR mapping
};

export type SignupTableColumn =
  | "cid"
  | "name"
  | "group"
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

function formatAvailability(av?: { available?: TimeRange[]; unavailable?: TimeRange[] }): string {
  if (av?.unavailable && av.unavailable.length === 0) return "full";
  const ranges = av?.available ?? [];
  if (ranges.length === 0) return "-";
  return ranges.map((r) => `${r.start}z-${r.end}z`).join(", ");
}

const HEAD_LABELS: Record<SignupTableColumn, string> = {
  cid: "CID",
  name: "Name",
  group: "Group",
  availability: "Availability",
  preferredStations: "Desired Position",
  remarks: "RMK",
};

export default function SignupsTable(props: SignupsTableProps) {
  const { signups, loading, error, columns, emptyMessage = "Keine Anmeldungen", groupBy = "endorsement", editable = false, event, onRefresh } = props;
  const [editOpen, setEditOpen] = useState(false);
  const [editSignup, setEditSignup] = useState<SignupRow | null>(null);
  const [groupResults, setGroupResults] = useState<Record<string | number, EndorsementResponse>>({});
  const [endorsementsLoading, setEndorsementsLoading] = useState(false);

  const { canInOwnFIR } = useUser()
  // Fetch dynamic group + restrictions per signup
  useEffect(() => {
    let cancelled = false;
    const fetchAll = async () => {
      // Only fetch dynamic endorsements when grouping by them and event airport is known
      if (groupBy !== "endorsement" || !event?.airport || signups.length === 0) {
        setGroupResults({});
        setEndorsementsLoading(false);
        return;
      }
      setEndorsementsLoading(true);
      const entries = await Promise.all(
        signups.map(async (s) => {
          const cidVal = Number(s.user?.cid ?? s.userCID);
          const ratingStr = s.user?.rating ?? "";
          if (!cidVal || !ratingStr) return [s.id, null] as const;
          try {
            const res = await fetch('/api/endorsements/group', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                user: { userCID: cidVal, rating: getRatingValue(ratingStr) },
                event: { airport: event.airport, fir: event.fir }
              })
            });
            if (!res.ok) return [s.id, null] as const;
            const data = (await res.json()) as EndorsementResponse;
            return [s.id, data] as const;
          } catch {
            return [s.id, null] as const;
          }
        })
      );
      if (cancelled) return;
      const map: Record<string | number, EndorsementResponse> = {};
      for (const [id, val] of entries) {
        if (val) map[id] = val;
      }
      setGroupResults(map);
      setEndorsementsLoading(false);
    };
    fetchAll();
    return () => {
      cancelled = true;
    };
  }, [JSON.stringify(signups.map(s => [s.id, s.user?.cid, s.userCID, s.user?.rating])), event?.airport, event?.fir, groupBy, signups.length]);

  const grouped = useMemo(() => {
    if (groupBy !== "endorsement") {
      return { ALL: signups } as Record<string, SignupRow[]>;
    }
    const out: Record<string, SignupRow[]> = {};
    for (const s of signups) {
      const computed = groupResults[s.id]?.group;
      const key = (computed || s.user?.rating || "UNSPEC") as string;
      if (!out[key]) out[key] = [];
      out[key].push(s);
    }
    return out;
  }, [signups, groupBy, groupResults]);

  const orderedAreas = useMemo(() => {
    const keys = Object.keys(grouped);
    if (groupBy !== "endorsement") return keys;
    const idx = (v: string) => PRIORITY[v] ?? 999;
    return keys.sort((a, b) => idx(a) - idx(b));
  }, [grouped, groupBy]);

  const colCount = columns.length;

  const hasActions = editable;
  const finalColumns = hasActions ? [...columns, "__actions__"] : columns;

  const isTableLoading = !!loading || (groupBy === "endorsement" && !!event?.airport && endorsementsLoading);

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
        {isTableLoading ? (
          <TableRow>
            <TableCell colSpan={finalColumns.length}>Loading...</TableCell>
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
                        <Button size="sm" variant="outline" onClick={() => { setEditSignup(s); setEditOpen(true); }} disabled={!event || !canInOwnFIR("signups.manage")}>
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
                      const showInlineGroup = !finalColumns.includes("group");
                      const computed = groupResults[s.id];
                      const badgeLabel = computed?.group || s.user?.rating || "UNSPEC";
                      return (
                        <TableCell key={`${s.id}-name`} className="flex items-center gap-2">
                          <div className="flex flex-col">
                            <span>{name}</span>
                            {showInlineGroup && (
                              <div className="flex flex-col">
                                <Badge className={getBadgeClassForEndorsement(badgeLabel)}>{badgeLabel}</Badge>
                                {computed && computed.restrictions.length > 0 && (
                                  <div className="mt-1">
                                    {computed.restrictions.map((r, idx) => (
                                      <div key={idx} className="text-xs text-muted-foreground">• {r}</div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </TableCell>
                      );
                    }
                    case "group": {
                      const computed = groupResults[s.id];
                      const badgeLabel = computed?.group || s.user?.rating || "UNSPEC";
                      return (
                        <TableCell key={`${s.id}-group`}>
                          <div className="flex flex-col">
                            <Badge className={getBadgeClassForEndorsement(badgeLabel)}>{badgeLabel}</Badge>
                            {computed && computed.restrictions.length > 0 && (
                              <div className="mt-1">
                                {computed.restrictions.map((r, idx) => (
                                  <div key={idx} className="text-xs text-muted-foreground">• {r}</div>
                                ))}
                              </div>
                            )}
                          </div>
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
