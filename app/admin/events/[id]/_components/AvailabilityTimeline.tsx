import { useMemo } from "react";
import { Signup, TimeRange } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useEndorsements } from "@/hooks/useEndorsements";

interface AvailabilityTimelineProps {
  signups: Signup[];
  slots: { slotStart: string; slotEnd: string }[];
  loading: boolean;
  error: string;
  event?: { airports?: string | string[]; fir?: string };
}

const PRIORITY: Record<string, number> = { DEL: 0, GND: 1, TWR: 2, APP: 3, CTR: 4 };

export default function AvailabilityTimeline({ signups, slots, loading, error, event }: AvailabilityTimelineProps) {
  const { data: endorsementData, loading: loadingEndos } = useEndorsements(signups, event);
  const groupedSignups = useMemo(() => {
    const groups: Record<string, Signup[]> = {};
    for (const s of signups) {
      const cid = String(s.user?.cid ?? s.userCID ?? "");
      const key = (endorsementData[cid]?.group || "UNSPEC") as string;
      console.log("endo", endorsementData)
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    }
    return groups;
  }, [signups, endorsementData]);

  const orderedAreas = useMemo(() => {
    const present = Object.keys(groupedSignups);
    const idx = (v: string) => PRIORITY[v] ?? 999;
    return present.sort((a, b) => idx(a) - idx(b));
  }, [groupedSignups]);

  const timelineMinWidth = useMemo(() => {
    const NAME_COL_PX = 240;
    const SLOT_MIN_PX = 60;
    const slotCount = Math.max(slots.length, 0);
    return NAME_COL_PX + slotCount * SLOT_MIN_PX;
  }, [slots.length]);

  if (loading || loadingEndos) return <div className="text-sm text-muted-foreground mb-3">Lade Anmeldungen...</div>;
  if (error) return <div className="text-sm text-red-500 mb-3">{error}</div>;
  if (signups.length === 0) return <div className="text-sm text-muted-foreground">Keine Anmeldungen vorhanden.</div>;

  return (
    <Card className="relative overflow-hidden">
      <CardHeader>
        <CardTitle>Availability Übersicht (alle Zeiten UTC)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div style={{ minWidth: timelineMinWidth }}>
            <TimelineHeader slots={slots} />
            {orderedAreas.map((area) => (
              <TimelineAreaGroup 
                key={area} 
                area={area} 
                signups={groupedSignups[area]} 
                slots={slots} 
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Sub-Komponenten für die Timeline
function TimelineHeader({ slots }: { slots: { slotStart: string; slotEnd: string }[] }) {
  return (
    <div className="grid items-center mb-2" style={{ 
      gridTemplateColumns: `240px repeat(${Math.max(slots.length, 0)}, minmax(60px, 1fr))` 
    }}>
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
  slots 
}: { 
  area: string; 
  signups?: Signup[]; 
  slots: { slotStart: string; slotEnd: string }[]; 
}) {
  if (!signups) return null;

  return (
    <div className="mt-2">
      <div className="bg-muted/50 text-xs font-semibold px-2 py-1 rounded mb-1 inline-block">
        {area}
      </div>
      {signups.map((signup) => (
        <TimelineRow key={String(signup.id)} signup={signup} slots={slots} groupLabel={area} />
      ))}
    </div>
  );
}

function TimelineRow({ 
  signup, 
  slots,
  groupLabel,
}: { 
  signup: Signup; 
  slots: { slotStart: string; slotEnd: string }[];
  groupLabel: string;
}) {
  const name = signup.user?.name || "";
  const cid = String(signup.user?.cid ?? signup.userCID ?? "");
  const unavailable = signup.availability?.unavailable || [];
  const hasAvailability = !!signup.availability && (
    (signup.availability.unavailable && signup.availability.unavailable.length > 0) || 
    (signup.availability.available && signup.availability.available.length > 0)
  );

  return (
    <div 
      className="grid items-center mb-1" 
      style={{ 
        gridTemplateColumns: `240px repeat(${Math.max(slots.length, 0)}, minmax(60px, 1fr))` 
      }}
    >
      <ControllerInfo name={name} cid={cid} group={groupLabel} />
      {slots.map((slot) => (
        <AvailabilitySlot
          key={`${signup.id}__${slot.slotStart}-${slot.slotEnd}`}
          slot={slot}
          unavailable={unavailable}
          hasAvailability={hasAvailability!}
        />
      ))}
    </div>
  );
}

function ControllerInfo({ name, cid, group }: { name: string; cid: string; group?: string; }) {
  const badgeClassFor = (endorsement?: string) => {
    switch (endorsement) {
      case "DEL": return "bg-green-100 text-green-800";
      case "GND": return "bg-blue-100 text-blue-800";
      case "TWR": return "bg-amber-100 text-amber-800";
      case "APP": return "bg-purple-100 text-purple-800";
      case "CTR": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };
  // Pull computed group from context via hook usage in parent grouping
  // We can't access endorsementData here directly; to avoid refetch, keep the label simple
  // The row’s group badge will reflect grouping title; fallback to UNSPEC when unknown.

  return (
    <div className="flex items-center gap-2 px-2 py-1 border-r bg-white/50">
      <div className="flex flex-col min-w-0">
        <span className="text-sm font-medium leading-tight truncate">{name || "Unbekannt"}</span>
        <span className="text-xs text-muted-foreground leading-tight">CID {cid}</span>
      </div>
      <Badge className={`${badgeClassFor(group)} shrink-0`}>
        {group || "UNSPEC"}
      </Badge>
    </div>
  );
}

function AvailabilitySlot({
  slot,
  unavailable,
  hasAvailability
}: {
  slot: { slotStart: string; slotEnd: string };
  unavailable: TimeRange[];
  hasAvailability: boolean;
}) {
  const isSlotUnavailable = (slotStart: string, slotEnd: string, unavailable: TimeRange[]): boolean => {
    if (!unavailable || unavailable.length === 0) return false;
    
    const toMinutesHM = (hhmm: string): number => {
      const [h, m] = hhmm.split(":").map(Number);
      return h * 60 + m;
    };

    const slotStartMin = toMinutesHM(slotStart);
    const slotEndMin = toMinutesHM(slotEnd);
    
    return unavailable.some((r) => {
      const rangeStart = toMinutesHM(r.start);
      const rangeEnd = toMinutesHM(r.end);
      return Math.max(slotStartMin, rangeStart) < Math.min(slotEndMin, rangeEnd);
    });
  };

  const unavailableSlot = isSlotUnavailable(slot.slotStart, slot.slotEnd, unavailable);
  const cls = hasAvailability
    ? (unavailableSlot ? "bg-red-500" : "bg-emerald-400")
    : "bg-gray-200";

  return (
    <div 
      className={`h-8 border border-white relative group ${cls}`}
    />
  );
}
