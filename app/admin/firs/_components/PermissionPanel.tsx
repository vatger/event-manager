// app/admin/firs/[code]/_components/PermissionsPanel.tsx
"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { PermissionRow } from "./types";
import { toast } from "sonner";

export default function PermissionsPanel({
  firCode,
  selectedGroupId,
  perms,
  setPerms,
  loading,
  onReload,
}: {
  firCode: string;
  selectedGroupId: number | null;
  perms: PermissionRow[];
  setPerms: (p: PermissionRow[]) => void;
  loading: boolean;
  onReload: () => void;
}) {
  function toggleScope(pid: number, scope: "OWN_FIR" | "ALL") {
    setPerms(perms.map(p => p.id === pid ? ({ ...p, assignedScope: p.assignedScope === scope ? null : scope }) : p));
  }

  async function savePerms() {
    if (!selectedGroupId) return;
    try {
      const body = perms.map(p => ({ permissionId: p.id, scope: p.assignedScope }));
      const res = await fetch(`/api/firs/${firCode}/groups/${selectedGroupId}/permissions`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Fehler beim Speichern");
      }
      toast.success("Rechte gespeichert");
      onReload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Speichern");
    }
  }

  return (
    <Card className="col-span-4">
      <CardHeader><CardTitle>Rechte</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {!selectedGroupId ? (
          <div className="text-sm text-muted-foreground">Wähle links eine Gruppe.</div>
        ) : loading ? (
          <div className="text-sm flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Lädt…</div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 border-b pb-2 text-xs font-medium">
              <span>Permission</span><span className="text-center">OWN_FIR</span><span className="text-center">ALL</span>
            </div>
            {perms.map(p => (
              <div key={p.id} className="grid grid-cols-3 gap-2 py-2 border-b items-center text-sm">
                <div>
                  <div className="font-medium">{p.key}</div>
                  {p.description && <div className="text-xs text-muted-foreground">{p.description}</div>}
                </div>
                <div className="flex justify-center">
                  <Checkbox checked={p.assignedScope==="OWN_FIR"} onCheckedChange={()=>toggleScope(p.id,"OWN_FIR")} />
                </div>
                <div className="flex justify-center">
                  <Checkbox checked={p.assignedScope==="ALL"} onCheckedChange={()=>toggleScope(p.id,"ALL")} />
                </div>
              </div>
            ))}
            <div className="flex justify-end pt-2">
              <Button onClick={savePerms}>Speichern</Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
