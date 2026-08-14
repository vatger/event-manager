"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Eye, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAvatarColor } from "@/utils/getAvatarColor";
import type { RosterPresenceUser } from "@/lib/roster/rosterEvents";

interface PresenceBarProps {
  users: RosterPresenceUser[];
  /** Eigene CID – die eigene Kachel wird gekennzeichnet und zuerst gezeigt */
  selfCID: number | null;
  className?: string;
}

/** So viele Kacheln stehen nebeneinander, der Rest wird gezählt */
const MAX_VISIBLE = 4;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/**
 * Wer sitzt gerade mit am Plan?
 *
 * Die Liste kommt aus den offenen Realtime-Verbindungen – sie zeigt also
 * genau die Personen, die den Editor tatsächlich offen haben, nicht bloß
 * eingeloggte Nutzer. Beim gemeinsamen Planen ist das der Unterschied
 * zwischen „ich kann loslegen" und „gleich überschreiben wir uns".
 */
export function PresenceBar({ users, selfCID, className }: PresenceBarProps) {
  if (users.length === 0) return null;

  const sorted = [...users].sort((a, b) => {
    if ((a.cid === selfCID) !== (b.cid === selfCID)) return a.cid === selfCID ? -1 : 1;
    return a.since - b.since;
  });
  const visible = sorted.slice(0, MAX_VISIBLE);
  const overflow = sorted.length - visible.length;

  const label = (u: RosterPresenceUser) =>
    `${u.name}${u.cid === selfCID ? " (du)" : ""} – ${u.canEdit ? "bearbeitet" : "sieht zu"}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn("flex items-center -space-x-1.5 pl-1", className)}
          title={`${users.length} ${users.length === 1 ? "Person hat" : "Personen haben"} den Plan offen`}
        >
          {visible.map((u) => (
            <span
              key={u.cid}
              className={cn(
                "relative flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white ring-2 ring-background",
                getAvatarColor(u.name)
              )}
            >
              {initials(u.name)}
              {/* Nur-Lesend bekommt einen gedämpften Punkt, Bearbeitende einen grünen */}
              <span
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-background",
                  u.canEdit ? "bg-emerald-500" : "bg-muted-foreground"
                )}
              />
            </span>
          ))}
          {overflow > 0 && (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold ring-2 ring-background">
              +{overflow}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Gerade am Besetzungsplan
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ul className="py-1">
          {sorted.map((u) => (
            <li key={u.cid} className="flex items-center gap-2 px-2 py-1.5 text-sm">
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white",
                  getAvatarColor(u.name)
                )}
              >
                {initials(u.name)}
              </span>
              <span className="min-w-0 flex-1 truncate">
                {u.name}
                {u.cid === selfCID && <span className="text-muted-foreground"> (du)</span>}
              </span>
              <span
                className="shrink-0 text-muted-foreground"
                title={label(u)}
                aria-label={label(u)}
              >
                {u.canEdit ? <Pencil className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </span>
            </li>
          ))}
        </ul>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default PresenceBar;
