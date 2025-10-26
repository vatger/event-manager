// app/admin/firs/_components/PermissionsMatrix.tsx
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Permission {
  id: number;
  key: string;
  description?: string;
  assignedScope: "OWN_FIR" | "ALL" | null;
}

export default function PermissionsMatrix({
  firCode,
  groupId,
}: {
  firCode: string;
  groupId: number;
}) {
  const [perms, setPerms] = useState<Permission[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  async function loadPerms() {
    setLoading(true);
    try {
      const res = await fetch(`/api/firs/${firCode}/groups/${groupId}/permissions`);
      if (!res.ok) throw new Error(await res.text());
      setPerms(await res.json());
    } catch {
      toast.error("Fehler beim Laden der Berechtigungen");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPerms();
  }, [firCode, groupId]);

  function toggleScope(id: number, scope: "OWN_FIR" | "ALL") {
    setPerms((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, assignedScope: p.assignedScope === scope ? null : scope }
          : p
      )
    );
  }

  async function save() {
    setSaving(true);
    try {
      const body = perms.map((p) => ({
        permissionId: p.id,
        scope: p.assignedScope,
      }));
      const res = await fetch(`/api/firs/${firCode}/groups/${groupId}/permissions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Rechte gespeichert");
      await loadPerms();
    } catch {
      toast.error("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return (
      <div className="flex items-center gap-2 py-6">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Lade Berechtigungen...</span>
      </div>
    );

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="grid grid-cols-3 gap-4 border-b pb-2 font-semibold text-sm">
          <span>Permission</span>
          <span className="text-center">OWN_FIR</span>
          <span className="text-center">ALL</span>
        </div>

        {perms.map((p) => (
          <div
            key={p.id}
            className="grid grid-cols-3 gap-4 py-2 border-b items-center text-sm"
          >
            <div>
              <div className="font-medium">{p.key}</div>
              <div className="text-xs text-muted-foreground">{p.description}</div>
            </div>
            <div className="flex justify-center">
              <Checkbox
                checked={p.assignedScope === "OWN_FIR"}
                onCheckedChange={() => toggleScope(p.id, "OWN_FIR")}
              />
            </div>
            <div className="flex justify-center">
              <Checkbox
                checked={p.assignedScope === "ALL"}
                onCheckedChange={() => toggleScope(p.id, "ALL")}
              />
            </div>
          </div>
        ))}

        <div className="pt-4 flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Speichern
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
