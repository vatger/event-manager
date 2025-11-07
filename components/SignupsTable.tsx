"use client";

import React, { useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit } from "lucide-react";
import SignupEditDialog from "@/app/admin/events/[id]/_components/SignupEditDialog";
import { getBadgeClassForEndorsement } from "@/utils/EndorsementBadge";
import { useUser } from "@/hooks/useUser";
import { SignupTableEntry, SignupTableResponse } from "@/lib/cache/types";

interface SignupsTableProps {
  eventId: number;
  editable?: boolean;
  onRefresh?: () => void;
}

export default function SignupsTable({ eventId, editable = false, onRefresh }: SignupsTableProps) {
  const [data, setData] = useState<SignupTableEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const [editSignup, setEditSignup] = useState<SignupTableEntry | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const { canInOwnFIR } = useUser();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/events/${eventId}/signup/full`);
        if (!res.ok) throw new Error("Failed to fetch signup data");
        const json: SignupTableResponse = await res.json();
        setData(json.signups);
        setCached(json.cached);
      } catch (err) {
        setError("Fehler beim Laden der Anmeldungen");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [eventId]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">
          Signups {cached && <span className="text-xs text-muted-foreground">(cached)</span>}
        </h2>
        <Button variant="outline" onClick={onRefresh}>Neu laden</Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>CID</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Endorsement</TableHead>
            <TableHead>Remarks</TableHead>
            {editable && <TableHead></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={5}>Lade...</TableCell>
            </TableRow>
          ) : error ? (
            <TableRow>
              <TableCell colSpan={5} className="text-red-500">{error}</TableCell>
            </TableRow>
          ) : data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground">
                Keine Anmeldungen
              </TableCell>
            </TableRow>
          ) : (
            data.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.user.cid}</TableCell>
                <TableCell>{s.user.name}</TableCell>
                <TableCell>
                  {s.endorsement ? (
                    <div className="flex flex-col">
                      <Badge className={getBadgeClassForEndorsement(s.endorsement.group)}>
                        {s.endorsement.group}
                      </Badge>
                      {s.endorsement.restrictions.length > 0 && (
                        <ul className="text-xs text-muted-foreground mt-1">
                          {s.endorsement.restrictions.map((r, idx) => (
                            <li key={idx}>• {r}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell>{s.remarks ?? "-"}</TableCell>
                {editable && (
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditSignup(s);
                        setEditOpen(true);
                      }}
                      disabled={!canInOwnFIR("signups.manage")}
                    >
                      <Edit />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {editSignup && (
        <SignupEditDialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
          signup={editSignup}
          event={{ id: eventId.toString(), startTime: "", endTime: "" }}
          onSaved={onRefresh}
          onDeleted={onRefresh}
        />
      )}
    </div>
  );
}
