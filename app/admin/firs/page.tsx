// app/admin/firs/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";

type FIR = { id: number; code: string; name: string; groups: any[]; members: any[] };

export default function FIRListPage() {
  const [firs, setFirs] = useState<FIR[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ code: "", name: "" });
  const router = useRouter();

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/firs", { cache: "no-store" });
      if (!res.ok) throw new Error();
      setFirs(await res.json());
    } catch {
      toast.error("FIRs konnten nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return !t ? firs
      : firs.filter(f => f.code.toLowerCase().includes(t) || f.name.toLowerCase().includes(t));
  }, [firs, q]);

  async function createFIR() {
    if (!form.code || !form.name) return toast.error("Code & Name angeben");
    setCreating(true);
    try {
      const res = await fetch("/api/firs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: form.code.toUpperCase(), name: form.name }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("FIR erstellt");
      setOpen(false);
      setForm({ code: "", name: "" });
      load();
    } catch {
      toast.error("Fehler beim Erstellen");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">FIRs</h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Input placeholder="Suche (Code/Name)…" value={q} onChange={e=>setQ(e.target.value)} className="pl-9 w-56" />
            <Search className="h-4 w-4 text-muted-foreground absolute left-2 top-1/2 -translate-y-1/2" />
          </div>
          <Button onClick={()=>setOpen(true)}><Plus className="mr-2 h-4 w-4" /> Neue FIR</Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map(f => (
            <Card key={f.id} className="hover:shadow-sm transition">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="truncate">{f.name}</span>
                  <span className="text-xs text-muted-foreground">{f.code}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div>Gruppen: <b>{f.groups.length}</b></div>
                <div>Mitglieder: <b>{f.members.length}</b></div>
                <Button variant="secondary" className="w-full mt-2" onClick={()=>router.push(`/admin/firs/${f.code}`)}>
                  Öffnen
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Neue FIR</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Code (z. B. EDMM)" value={form.code} onChange={e=>setForm(s=>({...s, code: e.target.value.toUpperCase()}))} maxLength={4} />
            <Input placeholder="Name (z. B. FIR München)" value={form.name} onChange={e=>setForm(s=>({...s, name: e.target.value}))} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setOpen(false)}>Abbrechen</Button>
            <Button onClick={createFIR} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
