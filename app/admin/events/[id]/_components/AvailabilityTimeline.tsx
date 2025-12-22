"use client";

import React, {
  useState,
  useEffect,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertCircle } from "lucide-react";
import type { TimeRange } from "@/types";
import type { SignupTableEntry } from "@/lib/cache/types";

interface AvailabilityTimelineProps {
  eventId: number;
  slots: { slotStart: string; slotEnd: string }[];
}

// 🔹 Externe Steuerung: Parent kann per ref reload auslösen
export interface AvailabilityTimelineHandle {
  reload: () => Promise<void>;
}

const PRIORITY: Record<string, number> = { DEL: 0, GND: 1, TWR: 2, APP: 3, CTR: 4 };

export const AvailabilityTimeline = forwardRef<
  AvailabilityTimelineHandle,
  AvailabilityTimelineProps
>(({ eventId, slots }, ref) => {
  const [signups, setSignups] = useState<SignupTableEntry[]>([]);
  const [cached, setCached] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // =============================================================
  // 🔹 API-Aufruf
  // =============================================================
  const loadSignups = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/events/${eventId}/signup/full`);
      if (!res.ok) throw new Error("Fehler beim Laden der Anmeldungen");

      const data = await res.json();
      setSignups(Array.isArray(data.signups) ? data.signups : []);
      setCached(Boolean(data.cached));
    } catch (err) {
      console.error("[Timeline] Fehler beim Laden:", err);
      setError("Fehler beim Laden der Anmeldungen");
      setSignups([]);
    } finally {
      setLoading(false);
    }
  };

  // 🔁 Bei Mount laden
  useEffect(() => {
    loadSignups();
  }, [eventId]);

  // 🔁 Zugriff auf reload() von außen
  useImperativeHandle(ref, () => ({
    reload: loadSignups,
  }));

  // =============================================================
  // 🔹 Gruppierung nach Endorsement-Level
  // =============================================================
  const grouped = useMemo(() => {
    const groups: Record<string, SignupTableEntry[]> = {};
    for (const s of signups) {
      const key = s.endorsement?.group || s.user.rating || "UNSPEC";
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    }
    return groups;
  }, [signups]);

  const orderedAreas = useMemo(() => {
    const keys = Object.keys(grouped);
    const idx = (v: string) => PRIORITY[v] ?? 999;
    return keys.sort((a, b) => idx(a) - idx(b));
  }, [grouped]);

  // =============================================================
  // 🔹 Rendering
  // =============================================================
  if (loading)
    return <div className="text-sm text-muted-foreground mb-3">Lade Anmeldungen...</div>;

  if (error)
    return (
      <Alert variant="destructive" className="mb-3">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );

  if (signups.length === 0)
    return <div className="text-sm text-muted-foreground">Keine Anmeldungen vorhanden.</div>;

  return (
    <Card className="w-full overflow-hidden">
      <CardHeader>
        <CardTitle>
          Availability Übersicht (alle Zeiten UTC)
        </CardTitle>
      </CardHeader>

      {/* ✅ Scrollcontainer für horizontales Scrollen */}
      <CardContent className="pl-2">
        <div className="w-full overflow-x-auto max-w-full scrollbar-thin scrollbar-thumb-muted hover:scrollbar-thumb-muted-foreground">
          <div className="min-w-max px-2 pb-2">
            <TimelineHeader slots={slots} />
            {orderedAreas.map((area) => (
              <TimelineAreaGroup
                key={area}
                area={area}
                signups={grouped[area]}
                slots={slots}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

AvailabilityTimeline.displayName = "AvailabilityTimeline";

// =============================================================
// 🔸 Sub-Komponenten
// =============================================================
function TimelineHeader({ slots }: { slots: { slotStart: string; slotEnd: string }[] }) {
  return (
    <div
      className="grid items-center mb-2"
      style={{
        gridTemplateColumns: `240px repeat(${slots.length}, minmax(60px, 1fr))`,
      }}
    >
      <div className="text-xs text-muted-foreground px-2">Controller</div>
      {slots.map((slot) => (
        <div
          key={`header-${slot.slotStart}-${slot.slotEnd}`}
          className="flex flex-col items-center justify-center text-[10px] text-muted-foreground border-l border-gray-300 first:border-l-0"
        >
          <div className="font-medium">{slot.slotStart}z</div>
          <div className="text-[8px] opacity-70 mt-0.5">bis</div>
          <div className="font-medium">{slot.slotEnd}z</div>
        </div>
      ))}
    </div>
  );
}

function TimelineAreaGroup({
  area,
  signups,
  slots,
}: {
  area: string;
  signups?: SignupTableEntry[];
  slots: { slotStart: string; slotEnd: string }[];
}) {
  if (!signups) return null;

  return (
    <div className="mt-2">
      <div className="bg-muted/50 text-xs font-semibold px-2 py-1 rounded mb-1 inline-block">
        {area}
      </div>
      {signups.map((signup) => (
        <TimelineRow key={signup.id} signup={signup} slots={slots} groupLabel={area} />
      ))}
    </div>
  );
}

function TimelineRow({
  signup,
  slots,
  groupLabel,
}: {
  signup: SignupTableEntry;
  slots: { slotStart: string; slotEnd: string }[];
  groupLabel: string;
}) {
  const name = signup.user.name;
  const cid = String(signup.user.cid);
  const unavailable = signup.availability?.unavailable || [];
  const hasAvailability =
    !!signup.availability &&
    ((signup.availability.unavailable?.length ?? 0) > 0 ||
      (signup.availability.available?.length ?? 0) > 0);

  return (
    <div
      className="grid items-center mb-1"
      style={{
        gridTemplateColumns: `240px repeat(${slots.length}, minmax(60px, 1fr))`,
      }}
    >
      <ControllerInfo name={name} cid={cid} group={groupLabel} />
      {slots.map((slot) => (
        <AvailabilitySlot
          key={`${signup.id}__${slot.slotStart}-${slot.slotEnd}`}
          slot={slot}
          unavailable={unavailable}
          hasAvailability={hasAvailability}
        />
      ))}
    </div>
  );
}

function ControllerInfo({ name, cid, group }: { name: string; cid: string; group?: string }) {
  const badgeClassFor = (endorsement?: string) => {
    switch (endorsement) {
      case "DEL":
        return "bg-green-100 text-green-800";
      case "GND":
        return "bg-blue-100 text-blue-800";
      case "TWR":
        return "bg-amber-100 text-amber-800";
      case "APP":
        return "bg-purple-100 text-purple-800";
      case "CTR":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };
  return (
    <div className="flex items-center gap-2 px-2 py-1 border-r bg-background/50">
      <div className="flex flex-col min-w-0">
        <span className="text-sm font-medium leading-tight truncate">{name}</span>
        <span className="text-xs text-muted-foreground leading-tight">CID {cid}</span>
      </div>
      <Badge className={`${badgeClassFor(group)} shrink-0`}>{group || "UNSPEC"}</Badge>
    </div>
  );
}

function AvailabilitySlot({
  slot,
  unavailable,
  hasAvailability,
}: {
  slot: { slotStart: string; slotEnd: string };
  unavailable: TimeRange[];
  hasAvailability: boolean;
}) {
  const isSlotUnavailable = (
    slotStart: string,
    slotEnd: string,
    unavailable: TimeRange[]
  ): boolean => {
    if (!unavailable?.length) return false;
    const toMinutes = (hm: string) => {
      const [h, m] = hm.split(":").map(Number);
      return h * 60 + m;
    };
    const s1 = toMinutes(slotStart);
    const e1 = toMinutes(slotEnd);
    return unavailable.some((r) => {
      const rs = toMinutes(r.start);
      const re = toMinutes(r.end);
      return Math.max(s1, rs) < Math.min(e1, re);
    });
  };

  const unavailableSlot = isSlotUnavailable(slot.slotStart, slot.slotEnd, unavailable);
  const cls = hasAvailability
    ? unavailableSlot
      ? "bg-red-500"
      : "bg-emerald-400"
    : "bg-gray-200";
  return <div className={`h-8 border border-white ${cls}`} />;
}
