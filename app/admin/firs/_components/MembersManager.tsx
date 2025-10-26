// app/admin/firs/_components/MembersManager.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Search, Trash2, UserPlus } from "lucide-react";

type Group = {
  id: number;
  name: string;
  description?: string | null;
};

type Member = {
  user: { cid: number; name: string; rating: string };
};

export default function MembersManager({
  firCode,
  onChanged,
}: {
  firCode: string;
  onChanged?: () => void;
}) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState<string>("");
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const [cid, setCid] = useState("");
  const [adding, setAdding] = useState(false);

  const [q, setQ] = useState("");

  async function loadGroups() {
    setLoading(true);
    try {
      const res = await fetch(`/api/firs/${firCode}/groups`);
      if (!res.ok) throw new Error(await res.text());
      const data: any[] = await res.json();
      setGroups(data.map(g => ({ id: g.id, name: g.name, description: g.description })));
      // Standard: erste Gruppe vorauswählen
      if (data.length && !groupId) {
        setGroupId(String(data[0].id));
      }
    } catch {
      toast.error("Gruppen konnten nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }

  async function loadMembers(gid: string) {
    if (!gid) return;
    setLoadingMembers(true);
    try {
      const res = await fetch(`/api/firs/${firCode}/groups/${gid}/members`);
      if (!res.ok) throw new Error(await res.text());
      const data: Member[] = await res.json();
      setMembers(data);
    } catch {
      toast.error("Mitglieder konnten nicht geladen werden");
    } finally {
      setLoadingMembers(false);
    }
  }

  useEffect(() => {
    loadGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firCode]);

  useEffect(() => {
    loadMembers(groupId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    if (!text) return members;
    return members.filter((m) =>
      m.user.name.toLowerCase().includes(text) ||
      String(m.user.cid).includes(text) ||
      m.user.rating.toLowerCase().includes(text)
    );
  }, [members, q]);

  async function addMember() {
    if (!groupId) return toast.error("Bitte zuerst eine Gruppe wählen");
    const num = Number(cid);
    if (!num || isNaN(num)) return toast.error("Bitte eine gültige CID eingeben");
    setAdding(true);
    try {
      const res = await fetch(`/api/firs/${firCode}/groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cid: num }),
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Fehler beim Hinzufügen");
      }
      toast.success(`CID ${num} hinzugefügt`);
      setCid("");
      await loadMembers(groupId);
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Hinzufügen");
    } finally {
      setAdding(false);
    }
  }

  async function removeMember(cidToRemove: number) {
    if (!groupId) return;
    try {
      const res = await fetch(
        `/api/firs/${firCode}/groups/${groupId}/members?cid=${cidToRemove}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error(await res.text());
      toast.success(`CID ${cidToRemove} entfernt`);
      await loadMembers(groupId);
      onChanged?.();
    } catch {
      toast.error("Konnte Mitglied nicht entfernen");
    }
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        {/* Kopfzeile: Gruppenwahl + Suche + Add CID */}
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="text-xs text-muted-foreground">Gruppe</label>
            {loading ? (
              <div className="h-10 flex items-center text-sm">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Lädt Gruppen…
              </div>
            ) : (
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger><SelectValue placeholder="Gruppe wählen" /></SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={String(g.id)}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Suche</label>
            <div className="relative">
              <Input
                placeholder="Name, CID, Rating…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9"
              />
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          <div className="flex flex-col">
            <label className="text-xs text-muted-foreground">Mitglied per CID hinzufügen</label>
            <div className="flex gap-2">
              <Input
                placeholder="z. B. 1234567"
                value={cid}
                onChange={(e) => setCid(e.target.value.replace(/\D/g, ""))}
                maxLength={10}
              />
              <Button onClick={addMember} disabled={adding || !groupId}>
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Hinweis: Der Nutzer muss bereits im System existieren (hat sich mindestens einmal via VATSIM angemeldet).
            </p>
          </div>
        </div>

        {/* Mitgliederliste */}
        <div className="rounded-md border overflow-hidden">
          <div className="grid grid-cols-12 bg-muted/60 px-3 py-2 text-xs font-medium">
            <div className="col-span-6">Name</div>
            <div className="col-span-2">CID</div>
            <div className="col-span-2">Rating</div>
            <div className="col-span-2 text-right">Aktionen</div>
          </div>

          {loadingMembers ? (
            <div className="p-6 text-sm flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Lade Mitglieder…
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">Keine Mitglieder gefunden.</div>
          ) : (
            filtered.map((m) => (
              <div key={m.user.cid} className="grid grid-cols-12 px-3 py-3 border-t items-center text-sm">
                <div className="col-span-6 truncate">{m.user.name}</div>
                <div className="col-span-2">{m.user.cid}</div>
                <div className="col-span-2">{m.user.rating}</div>
                <div className="col-span-2 text-right">
                  <Button variant="destructive" size="sm" onClick={() => removeMember(m.user.cid)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
