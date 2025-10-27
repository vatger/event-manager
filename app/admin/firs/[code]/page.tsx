"use client";

import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Permission = { key: string; description?: string | null; scope: "OWN_FIR" | "ALL" };
type Member = { id: number; cid: string; name: string; rating: string; role: "USER" | "MAINADMIN" };
type Group = {
  id: number;
  name: string;
  kind: "FIR_LEITUNG" | "FIR_TEAM" | "GLOBAL_VATGER_LEITUNG" | "CUSTOM";
  description?: string | null;
  members: Member[];
  permissions: Permission[];
};
type FIR = { id: number; code: string; name: string; groups: Group[] };

function ScopeBadge({ scope }: { scope: Permission["scope"] }) {
  return (
    <Badge variant={scope === "ALL" ? "destructive" : "outline"}>
      {scope === "ALL" ? "ALL" : "OWN_FIR"}
    </Badge>
  );
}

export default function FIRDetailPage() {
  const params = useParams<{ code: string }>();
  const code = params?.code?.toUpperCase?.() ?? "";
  const router = useRouter();

  const [allFirs, setAllFirs] = useState<FIR[] | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/firs", { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const json: FIR[] = await res.json();
      setAllFirs(json);
    } catch (e) {
      console.error(e);
      setAllFirs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const fir = useMemo(() => {
    return (allFirs ?? []).find(f => f.code.toUpperCase() === code);
  }, [allFirs, code]);

  if (loading && !fir) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Laden…
      </div>
    );
  }

  if (!fir) {
    return (
      <div className="p-6 space-y-4">
        <div className="text-sm text-muted-foreground">FIR nicht gefunden.</div>
        <Button variant="outline" onClick={() => router.push("/admin/firs")}>Zurück</Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {fir.code} <span className="text-muted-foreground font-normal">— {fir.name}</span>
        </h1>
        <div className="ml-auto">
          <Button variant="outline" onClick={load}>
            <Loader2 className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </div>
      </div>

      <Tabs defaultValue="groups" className="w-full">
        <TabsList>
          <TabsTrigger value="groups">Gruppen</TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Zusammenfassung</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <div>Gruppen: <strong>{fir.groups.length}</strong></div>
              <div>
                Mitglieder (gesamt):{" "}
                <strong>{fir.groups.reduce((acc, g) => acc + (g.members?.length ?? 0), 0)}</strong>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="groups" className="space-y-4 pt-4">
          <Accordion type="multiple" className="w-full">
            {fir.groups.map((group) => (
              <AccordionItem key={group.id} value={`group-${group.id}`}>
                <AccordionTrigger className="text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{group.name}</span>
                    {group.kind !== "CUSTOM" && (
                      <Badge variant="secondary">{group.kind.replaceAll("_", " ")}</Badge>
                    )}
                    <Badge variant="outline">{group.members.length} Members</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <GroupPanel code={fir.code} group={group} reload={load} />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function GroupPanel({ code, group, reload }: { code: string; group: Group; reload: () => void }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Mitglieder</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <AddMemberForm code={code} groupId={group.id} onSuccess={reload} />
          <Separator />
          <div className="space-y-2">
            {group.members.length === 0 && (
              <div className="text-sm text-muted-foreground">Keine Mitglieder.</div>
            )}
            {group.members.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-md border p-2">
                <div className="text-sm">
                  <div className="font-medium">{m.name} <span className="text-muted-foreground">({m.cid})</span></div>
                  <div className="text-muted-foreground text-xs">Rating: {m.rating}</div>
                </div>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={async () => {
                    try {
                      const res = await fetch(`/api/firs/${code}/group/${group.id}/members?cid=${m.cid}`, { method: "DELETE" });
                      if (!res.ok) throw new Error(await res.text());
                      reload();
                      toast.success("Mitglied entfernt");
                    } catch (e) {
                      console.error(e);
                      toast.error("Entfernen fehlgeschlagen");
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Rechte (Permissions)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <AddPermissionForm code={code} groupId={group.id} onSuccess={reload} />
          <Separator />
          <div className="space-y-2">
            {group.permissions.length === 0 && (
              <div className="text-sm text-muted-foreground">Keine Berechtigungen gesetzt.</div>
            )}
            {group.permissions.map((p, idx) => (
              <div key={`${p.key}-${idx}`} className="flex items-center justify-between rounded-md border p-2">
                <div className="text-sm">
                  <div className="font-medium flex items-center gap-2">
                    {p.key} <ScopeBadge scope={p.scope} />
                  </div>
                  {p.description && (
                    <div className="text-xs text-muted-foreground">{p.description}</div>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      const res = await fetch(`/api/firs/${code}/group/${group.id}/permissions`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          operations: [{ action: "REMOVE", key: p.key, scope: p.scope }],
                        }),
                      });
                      if (!res.ok) throw new Error(await res.text());
                      reload();
                      toast.success("Permission entfernt");
                    } catch (e) {
                      console.error(e);
                      toast.error("Entfernen fehlgeschlagen");
                    }
                  }}
                >
                  Entfernen
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AddMemberForm({ code, groupId, onSuccess }: { code: string; groupId: number; onSuccess: () => void }) {
  const [cid, setCid] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!cid.trim()) return;
        setBusy(true);
        try {
          const res = await fetch(`/api/firs/${code}/group/${groupId}/members`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cid: Number(cid) }),
          });
          if (!res.ok) throw new Error(await res.text());
          setCid("");
          onSuccess();
          toast.success("Mitglied hinzugefügt");
        } catch (e) {
          console.error(e);
          toast.error("Hinzufügen fehlgeschlagen");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="grid gap-1">
        <Label className="text-xs">CID</Label>
        <Input
          inputMode="numeric"
          placeholder="z. B. 1234567"
          value={cid}
          onChange={(e) => setCid(e.target.value)}
          className="w-40"
        />
      </div>
      <Button type="submit" disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
        Hinzufügen
      </Button>
    </form>
  );
}

function AddPermissionForm({ code, groupId, onSuccess }: { code: string; groupId: number; onSuccess: () => void }) {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="flex gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!key.trim()) return;
        setBusy(true);
        try {
          const res = await fetch(`/api/firs/${code}/group/${groupId}/permissions`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              operations: [{ action: "ADD", key: key.trim(), scope: "OWN_FIR" }],
            }),
          });
          if (!res.ok) throw new Error(await res.text());
          setKey("");
          onSuccess();
          toast.success("Permission hinzugefügt");
        } catch (e) {
          console.error(e);
          toast.error("Hinzufügen fehlgeschlagen");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="grid gap-1">
        <Label className="text-xs">Permission-Key</Label>
        <Input
          placeholder="z. B. event.edit"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className="w-56"
        />
      </div>
      <Button type="submit" disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
        Hinzufügen
      </Button>
    </form>
  );
}
