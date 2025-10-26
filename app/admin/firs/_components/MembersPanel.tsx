// app/admin/firs/[code]/_components/MembersPanel.tsx
"use client";

import { useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, UserPlus, Trash2 } from "lucide-react";
import { Member } from "./types";
import { toast } from "sonner";

export default function MembersPanel({
  firCode,
  selectedGroupId,
  members,
  loading,
  onReload,
}: {
  firCode: string;
  selectedGroupId: number | null;
  members: Member[];
  loading: boolean;
  onReload: () => void;
}) {
  const [q, setQ] = useState("");
  const [cid, setCid] = useState("");
  const [adding, setAdding] = useState(false);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return members;
    return members.filter(m =>
      m.user.name.toLowerCase().includes(t) ||
      String(m.user.cid).includes(t) ||
      m.user.rating.toLowerCase().includes(t)
    );
  }, [members, q]);

  async function addMember() {
    if (!selectedGroupId) return;
    const num = Number(cid);
    if (!num || isNaN(num)) return toast.error("Gültige CID eingeben");
    setAdding(true);
    try {
      const res = await fetch(`/api/firs/${firCode}/groups/${selectedGroupId}/members`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cid: num }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success(`CID ${num} hinzugefügt`);
      setCid("");
      onReload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Hinzufügen");
    } finally { setAdding(false); }
  }

  async function removeMember(cidToRemove: number) {
    if (!selectedGroupId) return;
    try {
      const res = await fetch(`/api/firs/${firCode}/groups/${selectedGroupId}/members?cid=${cidToRemove}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      toast.success(`CID ${cidToRemove} entfernt`);
      onReload();
    } catch {
      toast.error("Konnte Mitglied nicht entfernen");
    }
  }

  return (
    <Card className="col-span-5">
      <CardHeader><CardTitle>Mitglieder</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-12 gap-2">
          <div className="col-span-6 relative">
            <Input placeholder="Suche (Name/CID/Rating)…" value={q} onChange={e=>setQ(e.target.value)} className="pl-9" />
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>
          <div className="col-span-6 flex gap-2">
            <Input placeholder="CID hinzufügen…" value={cid} onChange={e=>setCid(e.target.value.replace(/\D/g,""))} />
            <Button onClick={addMember} disabled={!selectedGroupId || adding}>
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="rounded-md border overflow-hidden">
          <div className="grid grid-cols-12 bg-muted/60 px-3 py-2 text-xs font-medium">
            <div className="col-span-6">Name</div>
            <div className="col-span-2">CID</div>
            <div className="col-span-2">Rating</div>
            <div className="col-span-2 text-right">Aktion</div>
          </div>
          {loading ? (
            <div className="p-4 text-sm flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Lädt…</div>
          ) : filtered.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">Keine Mitglieder.</div>
          ) : filtered.map(m => (
            <div key={m.user.cid} className="grid grid-cols-12 px-3 py-3 border-t items-center text-sm">
              <div className="col-span-6 truncate">{m.user.name}</div>
              <div className="col-span-2">{m.user.cid}</div>
              <div className="col-span-2">{m.user.rating}</div>
              <div className="col-span-2 text-right">
                <Button size="sm" variant="destructive" onClick={()=>removeMember(m.user.cid)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
