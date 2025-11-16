"use client";

import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Edit, AlertCircle, RotateCcw, PlusCircle, Hourglass, UserSearch, AlertTriangle, Trash2 } from "lucide-react";
import SignupEditDialog, { EventRef } from "@/app/admin/events/[id]/_components/SignupEditDialog";
import { getBadgeClassForEndorsement } from "@/utils/EndorsementBadge";
import { useUser } from "@/hooks/useUser";
import type { TimeRange } from "@/types";
import { SignupTableEntry } from "@/lib/cache/types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const PRIORITY: Record<string, number> = { DEL: 0, GND: 1, TWR: 2, APP: 3, CTR: 4 };

type SignupTableColumn =
  | "cid"
  | "name"
  | "group"
  | "availability"
  | "preferredStations"
  | "remarks";

export interface SignupsTableRef {
  reload: () => void;
}

interface SignupsTableProps {
  eventId: number;
  editable?: boolean;
  columns?: SignupTableColumn[];
  emptyMessage?: string;
  event?: EventRef;
  onRefresh?: () => void;
}

const HEAD_LABELS: Record<SignupTableColumn, string> = {
  cid: "CID",
  name: "Name",
  group: "Group",
  availability: "Availability",
  preferredStations: "Desired Position",
  remarks: "RMK",
};

// 🔹 Utility
function formatAvailability(av?: { available?: TimeRange[]; unavailable?: TimeRange[] }): string {
  if (av?.unavailable && av.unavailable.length === 0) return "full";
  const ranges = av?.available ?? [];
  if (ranges.length === 0) return "-";
  return ranges.map((r) => `${r.start}z-${r.end}z`).join(", ");
}

// =====================================================================
// 🔹 Hauptkomponente
// =====================================================================
const SignupsTable = forwardRef<SignupsTableRef, SignupsTableProps>(
  (
    {
      eventId,
      editable = false,
      columns = ["cid", "name", "group", "availability", "preferredStations", "remarks"],
      emptyMessage = "Keine Anmeldungen",
      event,
      onRefresh,
    },
    ref
  ) => {
    const { canInOwnFIR } = useUser();

    // Local state
    const [signups, setSignups] = useState<SignupTableEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Dialog state
    const [editOpen, setEditOpen] = useState(false);
    const [editSignup, setEditSignup] = useState<SignupTableEntry | null>(null);

    // --------------------------------------------------------------------
    // 🔹 1️⃣ Load signups from API (cached)
    // --------------------------------------------------------------------
    const loadSignups = useCallback(async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/events/${eventId}/signup/full`);
        if (!res.ok) throw new Error("Fehler beim Laden der Signups");

        const data = await res.json();
        if (!Array.isArray(data.signups)) throw new Error("Invalid response format");
        setSignups(data.signups);
      } catch (err) {
        console.error("SignupTable load error:", err);
        setSignups([]);
        setError("Fehler beim Laden der Signups");
      } finally {
        setLoading(false);
      }
    }, [eventId]);

    // 👇 Ref erlaubt Parent-Komponente reload() auszulösen
    useImperativeHandle(ref, () => ({
      reload: loadSignups,
    }));
    // Initial Load
    useEffect(() => {
      loadSignups();
    }, [loadSignups]);

    // --------------------------------------------------------------------
    // 🔹 2️⃣ Group signups by endorsement level
    // --------------------------------------------------------------------
    const grouped = useMemo(() => {
      const out: Record<string, SignupTableEntry[]> = {};
      if (!Array.isArray(signups)) return out;

      for (const s of signups) {
        const label = s.endorsement?.group || s.user.rating || "UNSPEC";
        if (!out[label]) out[label] = [];
        out[label].push(s);
      }
      return out;
    }, [signups]);

    const orderedGroups = useMemo(() => {
      const keys = Object.keys(grouped);
      const idx = (v: string) => PRIORITY[v] ?? 999;
      return keys.sort((a, b) => idx(a) - idx(b));
    }, [grouped]);

    // --------------------------------------------------------------------
    // 🔹 3️⃣ Render
    // --------------------------------------------------------------------
    const hasActions = editable;
    const finalColumns = hasActions ? [...columns, "__actions__"] : columns;

    if (loading) {
      return (
        <div className="flex justify-center items-center h-32">
          <p className="text-muted-foreground">Lade Anmeldungen...</p>
        </div>
      );
    }

    if (error) {
      return (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      );
    }

    return (
      <>
        {canInOwnFIR("signups.manage") && (
          <div className="flex justify-self-end pb-2">
            <Button onClick={() => {
              setEditSignup(null);
              setEditOpen(true);
            }}
            variant={"outline"}>
              <PlusCircle />
            </Button>
          </div>
        )}

         {signups.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <UserSearch className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Keine Anmeldungen gefunden
          </h3>
          <p className="text-gray-500">
            Derzeit gibt es noch keine Anmeldungen, für dieses Event.
          </p>
        </div>
         ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {finalColumns.map((c) => (
                  <TableHead key={c}>
                    {c === "__actions__" ? "" : HEAD_LABELS[c as SignupTableColumn]}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>

            <TableBody>
              {orderedGroups.map((group) => (
                <React.Fragment key={group}>
                  <TableRow>
                    <TableCell colSpan={finalColumns.length} className="bg-muted/50 font-semibold">
                      {group}
                    </TableCell>
                  </TableRow>

                  {grouped[group].map((s) => {
                    const isDeleted = !!s.deletedAt;
                    const rowClassName = isDeleted ? "opacity-50" : "";
                    
                    return (
                      <TableRow key={s.id} className={rowClassName}>
                        {finalColumns.map((col) => {
                          const cellContent = (() => {
                            switch (col) {
                              case "cid":
                                return (
                                  <span className={isDeleted ? "line-through" : ""}>
                                    {s.user.cid}
                                  </span>
                                );

                              case "name":
                                return (
                                  <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                      <span className={isDeleted ? "line-through" : ""}>
                                        {s.user.name}
                                      </span>
                                      {s.modifiedAfterDeadline && !isDeleted && (
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger>
                                              <AlertTriangle className="h-4 w-4 text-orange-500" />
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <div className="space-y-1">
                                                <p className="font-semibold">Geändert nach Deadline</p>
                                                {s.changeLog && s.changeLog.length > 0 && (
                                                  <div className="text-xs">
                                                    {s.changeLog.map((change, idx) => (
                                                      <div key={idx}>
                                                        • {change.field} geändert am{" "}
                                                        {new Date(change.changedAt).toLocaleString("de-DE")}
                                                      </div>
                                                    ))}
                                                  </div>
                                                )}
                                              </div>
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      )}
                                      {isDeleted && (
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger>
                                              <Trash2 className="h-4 w-4 text-red-500" />
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <p>Gelöscht am {new Date(s.deletedAt!).toLocaleString("de-DE")}</p>
                                              {s.deletedBy && <p className="text-xs">Von CID: {s.deletedBy}</p>}
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      )}
                                    </div>
                                    {!finalColumns.includes("group") && (
                                      <Badge className={getBadgeClassForEndorsement(s.endorsement?.group || s.user.rating)}>
                                        {s.endorsement?.group || s.user.rating}
                                      </Badge>
                                    )}
                                  </div>
                                );

                              case "group":
                                return (
                                  <div className="flex flex-col">
                                    <Badge className={getBadgeClassForEndorsement(s.endorsement?.group || s.user.rating)}>
                                      {s.endorsement?.group || s.user.rating}
                                    </Badge>
                                    {s.endorsement?.restrictions?.length ? (
                                      <div className="mt-1">
                                        {s.endorsement.restrictions.map((r, idx) => (
                                          <div key={idx} className="text-xs text-muted-foreground">
                                            • {r}
                                          </div>
                                        ))}
                                      </div>
                                    ) : null}
                                  </div>
                                );

                              case "availability":
                                return (
                                  <span className={isDeleted ? "line-through" : ""}>
                                    {formatAvailability(s.availability)}
                                  </span>
                                );

                              case "preferredStations":
                                return (
                                  <span className={isDeleted ? "line-through" : ""}>
                                    {s.preferredStations || "-"}
                                  </span>
                                );

                              case "remarks":
                                return (
                                  <span className={isDeleted ? "line-through" : ""}>
                                    {s.remarks || "-"}
                                  </span>
                                );

                              case "__actions__":
                                return (
                                  <div className="flex gap-2 justify-end">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={!canInOwnFIR("signups.manage")}
                                      onClick={() => {
                                        setEditSignup(s);
                                        setEditOpen(true);
                                      }}
                                    >
                                      <Edit />
                                    </Button>
                                  </div>
                                );

                              default:
                                return "–";
                            }
                          })();

                          return (
                            <TableCell key={`${s.id}-${col}`}>
                              {cellContent}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
         )}

        

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
);

SignupsTable.displayName = "SignupsTable";
export default SignupsTable;
