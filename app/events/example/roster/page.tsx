"use client"
import React, { useMemo, useState } from "react";
import { DndContext, DragOverlay, rectIntersection, useDroppable, useDraggable } from "@dnd-kit/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// ---------- Demo data ----------
const DEMO_START = new Date("2025-10-18T17:00:00Z"); // 17:00z
const DEMO_END = new Date("2025-10-18T22:00:00Z");   // 22:00z

const DEMO_STATIONS: { id: string; label: string; group: "DEL" | "GND" | "TWR" | "APP" | "CTR" }[] = [
  { id: "EDDM_DEL", label: "EDDM_DEL", group: "DEL" },
  { id: "EDDM_1_GND", label: "EDDM_1_GND", group: "GND" },
  { id: "EDDM_2_GND", label: "EDDM_2_GND", group: "GND" },
  { id: "EDDM_N_TWR", label: "EDDM_N_TWR", group: "TWR" },
  { id: "EDDM_S_TWR", label: "EDDM_S_TWR", group: "TWR" },
  { id: "EDDM_NH_APP", label: "EDDM_NH_APP", group: "APP" },
  { id: "EDDM_SH_APP", label: "EDDM_SH_APP", group: "APP" },
  { id: "EDMM_ALB_CTR", label: "EDMM_ALB_CTR", group: "CTR" },
  { id: "EDMM_GER_CTR", label: "EDMM_GER_CTR", group: "CTR" },
];

const DEMO_USERS = [
  { cid: "1470001", name: "Max Mustermann", rating: "C1" },
  { cid: "1470002", name: "Anna Controller", rating: "C3" },
  { cid: "1470003", name: "John Doe", rating: "S3" },
  { cid: "1470004", name: "Lisa Tower", rating: "S2" },
  { cid: "1470005", name: "Ben Ground", rating: "S2" },
];

// ---------- Helpers ----------
function* halfHourSlots(start: Date, end: Date) {
  const t = new Date(start);
  while (t <= end) {
    yield t.toISOString().slice(11, 16) + "Z"; // HH:MMZ
    t.setUTCMinutes(t.getUTCMinutes() + 30);
  }
}

function clsx(...xs: (string | false | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

// ---------- Draggable Controller Pill ----------
function ControllerPill({ id, name, rating }: { id: string; name: string; rating: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id, data: { type: "user", cid: id.replace("user-", "") } });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={clsx(
        "px-3 py-1 rounded-full border shadow-sm bg-white hover:bg-muted cursor-grab active:cursor-grabbing select-none flex items-center gap-2",
        isDragging && "opacity-70"
      )}
      style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined }}
    >
      <span className="font-medium">{name}</span>
      <Badge variant="secondary">{rating}</Badge>
    </div>
  );
}

// ---------- Droppable Cell ----------
function SlotCell({ droppableId, assigned, onClear }: { droppableId: string; assigned?: { cid: string; name: string; rating: string } | null; onClear?: () => void; }) {
  const { setNodeRef, isOver } = useDroppable({ id: droppableId, data: { type: "cell" } });
  return (
    <div
      ref={setNodeRef}
      className={clsx(
        "h-12 rounded-lg border text-sm flex items-center justify-between px-2 bg-white/60",
        isOver && "ring-2 ring-blue-500",
        assigned ? "border-emerald-300" : "border-gray-200"
      )}
    >
      {assigned ? (
        <div className="flex items-center gap-2">
          <span className="font-medium">{assigned.name}</span>
          <Badge variant="outline">{assigned.rating}</Badge>
        </div>
      ) : (
        <span className="text-muted-foreground">frei</span>
      )}
      {assigned && (
        <Button size="sm" variant="ghost" onClick={onClear} className="h-7">✕</Button>
      )}
    </div>
  );
}

// ---------- Main Component ----------
export default function SchedulerEditorDemo() {
  // Build slots array
  const slots = useMemo(() => Array.from(halfHourSlots(DEMO_START, DEMO_END)), []);

  // assignments: key = `${stationId}__${time}` => value = user
  const [assignments, setAssignments] = useState<Record<string, { cid: string; name: string; rating: string }>>({});

  const [search, setSearch] = useState("");
  const filteredUsers = useMemo(
    () => DEMO_USERS.filter((u) => u.name.toLowerCase().includes(search.toLowerCase()) || u.cid.includes(search)),
    [search]
  );

  const [activeTab, setActiveTab] = useState<"DEL" | "GND" | "TWR" | "APP" | "CTR">("GND");

  function keyFor(stationId: string, time: string) {
    return `${stationId}__${time}`;
  }

  function clearAt(stationId: string, time: string) {
    const k = keyFor(stationId, time);
    setAssignments((prev) => {
      const copy = { ...prev };
      delete copy[k];
      return copy;
    });
  }

  function dropUserOnCell(cid: string, stationId: string, time: string) {
    const user = DEMO_USERS.find((u) => u.cid === cid);
    if (!user) return;

    // Rule: a user can hold only one station per time slice
    setAssignments((prev) => {
      const next = { ...prev };
      // remove any assignment for this user at the same time, across all stations
      for (const [k, v] of Object.entries(next)) {
        const [, t] = k.split("__");
        if (t === time && v.cid === cid) delete next[k];
      }
      // assign to target cell
      next[keyFor(stationId, time)] = { cid: user.cid, name: user.name, rating: user.rating };
      return next;
    });
  }

  function handleDragEnd(event: any) {
    const { active, over } = event;
    if (!over) return;

    // dragging from controller list
    if (active?.data?.current?.type === "user" && over?.data?.current?.type === "cell") {
      const cid = active.data.current.cid as string;
      const [stationId, time] = (over.id as string).split("__");
      dropUserOnCell(cid, stationId, time);
    }
  }

  function exportJSON() {
    const rows: { station: string; time: string; cid: string; name: string }[] = [];
    Object.entries(assignments).forEach(([k, v]) => {
      const [station, time] = k.split("__");
      rows.push({ station, time, cid: v.cid, name: v.name });
    });
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "roster.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function clearAll() {
    setAssignments({});
  }

  const groupedStations = useMemo(() => {
    return {
      DEL: DEMO_STATIONS.filter((s) => s.group === "DEL"),
      GND: DEMO_STATIONS.filter((s) => s.group === "GND"),
      TWR: DEMO_STATIONS.filter((s) => s.group === "TWR"),
      APP: DEMO_STATIONS.filter((s) => s.group === "APP"),
      CTR: DEMO_STATIONS.filter((s) => s.group === "CTR"),
    };
  }, []);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Scheduler Editor (Demo)</h1>
          <p className="text-muted-foreground">Drag & Drop: Ordne Controller halbstündlich auf Stationen zu. Doppelte Belegung pro Zeit wird verhindert.</p>
        </div>
        <div className="flex items-center gap-2">
          <Input placeholder="Controller suchen (Name/CID)" className="w-64" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button variant="outline" onClick={clearAll}>Reset</Button>
          <Button onClick={exportJSON}>Export JSON</Button>
        </div>
      </div>

      <DndContext onDragEnd={handleDragEnd} collisionDetection={rectIntersection}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Controllers */}
        <Card className="lg:col-span-4 xl:col-span-3">
          <CardHeader>
            <CardTitle>Angemeldete Controller</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {filteredUsers.map((u) => (
              <ControllerPill key={u.cid} id={`user-${u.cid}`} name={u.name} rating={u.rating} />
            ))}
            {filteredUsers.length === 0 && <p className="text-sm text-muted-foreground">Keine Treffer.</p>}
          </CardContent>
        </Card>

        {/* Right: Grid */}
        <Card className="lg:col-span-8 xl:col-span-9 overflow-hidden">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Besetzungsplan</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
              <TabsList className="grid grid-cols-5 w-full">
                {(["DEL","GND","TWR","APP","CTR"] as const).map((g) => (
                  <TabsTrigger key={g} value={g}>{g}</TabsTrigger>
                ))}
              </TabsList>

              {(["DEL","GND","TWR","APP","CTR"] as const).map((group) => (
                <TabsContent key={group} value={group} className="mt-4">
                    <div className="overflow-x-auto">
                      <div className="min-w-[720px]">
                        {/* header row */}
                        <div className="grid" style={{ gridTemplateColumns: `220px repeat(${slots.length}, minmax(100px, 1fr))` }}>
                          <div className="h-10"></div>
                          {slots.map((s) => (
                            <div key={s} className="h-10 flex items-center justify-center text-xs text-muted-foreground">{s}</div>
                          ))}
                        </div>

                        {groupedStations[group].map((st) => (
                          <div key={st.id} className="grid items-center" style={{ gridTemplateColumns: `220px repeat(${slots.length}, minmax(100px, 1fr))` }}>
                            <div className="sticky left-0 bg-white z-10 pr-2 h-12 flex items-center font-mono text-sm border-r">{st.label}</div>
                            {slots.map((time) => {
                              const k = keyFor(st.id, time);
                              const assigned = assignments[k];
                              return (
                                <div key={k} className="p-1">
                                  <SlotCell droppableId={k} assigned={assigned} onClear={() => clearAt(st.id, time)} />
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
        <DragOverlay />
        </div>
        </DndContext>
    </div>
  );
}
