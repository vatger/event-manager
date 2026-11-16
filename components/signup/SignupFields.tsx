"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CharLimitHint } from "@/components/CharLimitHint";
import { SIGNUP_PREFERRED_MAX, SIGNUP_REMARKS_MAX } from "@/lib/signups/signupLimits";
import { slotRuns, type AvailabilityGrid } from "@/lib/signups/availabilitySlots";
import { formatLocalTime, formatZulu } from "@/lib/events/eventDisplay";

/** Verfügbare Zeitspannen in Zulu und Ortszeit */
export function availableSpans(grid: AvailabilityGrid, blocked: boolean[]) {
  return slotRuns(blocked, false).map((r) => {
    const start = grid.slots[r.from].startMinute;
    const end =
      r.to < grid.slots.length
        ? grid.slots[r.to].startMinute
        : grid.slots[grid.slots.length - 1].startMinute + grid.slotMinutes;
    const a = new Date(start * 60000);
    const b = new Date(end * 60000);
    return {
      key: start,
      zulu: `${formatZulu(a)}–${formatZulu(b)}`,
      local: `${formatLocalTime(a)}–${formatLocalTime(b)}`,
    };
  });
}

/** Wunschposition und Bemerkungen */
export function PreferenceFields({
  position,
  onPositionChange,
  remarks,
  onRemarksChange,
}: {
  position: string;
  onPositionChange: (v: string) => void;
  remarks: string;
  onRemarksChange: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="signup-position">Wunschposition</Label>
        <Input
          id="signup-position"
          placeholder="z. B. TWR, kein DEL"
          value={position}
          maxLength={SIGNUP_PREFERRED_MAX}
          onChange={(e) => onPositionChange(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="signup-remarks">Bemerkungen</Label>
          <CharLimitHint length={remarks.length} max={SIGNUP_REMARKS_MAX} className="text-xs" />
        </div>
        <Textarea
          id="signup-remarks"
          value={remarks}
          maxLength={SIGNUP_REMARKS_MAX}
          onChange={(e) => onRemarksChange(e.target.value)}
          className="min-h-20"
        />
      </div>
    </div>
  );
}
