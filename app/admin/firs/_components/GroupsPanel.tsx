// app/admin/firs/[code]/_components/GroupsPanel.tsx
"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Pencil, Trash2, Plus } from "lucide-react";
import { Group } from "./types";

export default function GroupsPanel({
  groups,
  selectedId,
  onSelect,
  onCreateClick,
  onEditClick,
  onDeleteClick,
}: {
  groups: Group[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onCreateClick: () => void;
  onEditClick: (g: Group) => void;
  onDeleteClick: (id: number) => void;
}) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return !t ? groups : groups.filter(g => g.name.toLowerCase().includes(t));
  }, [groups, q]);

  return (
    <Card className="col-span-3">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Gruppen</CardTitle>
        <Button size="sm" onClick={onCreateClick}><Plus className="h-4 w-4 mr-1" /> Neu</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Input placeholder="Gruppe suchen…" value={q} onChange={e=>setQ(e.target.value)} className="pl-9" />
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </div>
        <div className="border rounded-md divide-y">
          {filtered.length === 0 && <div className="p-3 text-sm text-muted-foreground">Keine Gruppen.</div>}
          {filtered.map((g) => (
            <div key={g.id} className={`flex items-center justify-between p-3 ${selectedId===g.id ? "bg-muted" : "hover:bg-muted/60"}`}>
              <button className="text-left flex-1 min-w-0" onClick={() => onSelect(g.id)}>
                <div className="font-medium truncate">{g.name}</div>
                <div className="text-xs text-muted-foreground truncate">{g.description || "–"}</div>
              </button>
              <div className="flex gap-1 ml-2 shrink-0">
                <Button variant="ghost" size="icon" onClick={() => onEditClick(g)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => onDeleteClick(g.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
