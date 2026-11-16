"use client";

import { Plus, ShieldCheck, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { PERMISSION_KEYS } from "@/lib/acl/catalog";
import type { TeamGroup } from "@/types/fir";
import { plural } from "./teamUtils";

/**
 * Die Gruppen des Departments als Auswahlliste: Leitung zuerst, darunter die
 * Untergruppen. Auf schmalen Bildschirmen eine waagerechte Leiste.
 */
export function GroupList({
  groups,
  selectedId,
  dirtyIds,
  onSelect,
  onCreate,
}: {
  groups: TeamGroup[];
  selectedId: number | null;
  /** Gruppen mit ungespeicherten Rechte-Änderungen */
  dirtyIds: Set<number>;
  onSelect: (groupId: number) => void;
  onCreate?: () => void;
}) {
  return (
    <nav
      aria-label="Gruppen"
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0"
    >
      {groups.map((group) => {
        const isLeitung = group.kind === "FIR_LEITUNG";
        const active = group.id === selectedId;
        const Icon = isLeitung ? ShieldCheck : Users;
        return (
          <button
            key={group.id}
            type="button"
            onClick={() => onSelect(group.id)}
            aria-current={active ? "true" : undefined}
            className={cn(
              "flex w-60 shrink-0 items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-left transition-colors lg:w-auto",
              active
                ? "border-accent-500 ring-1 ring-accent-500/40"
                : "hover:bg-accent"
            )}
          >
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
                isLeitung
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">{group.name}</span>
                {dirtyIds.has(group.id) && (
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-500"
                    title="Ungespeicherte Änderungen"
                  />
                )}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {plural(group.members.length, "Mitglied", "Mitglieder")} ·{" "}
                {isLeitung
                  ? "feste Rechte"
                  : `${group.permissions.length} von ${PERMISSION_KEYS.length} Rechten`}
              </span>
            </span>
          </button>
        );
      })}

      {onCreate && (
        <button
          type="button"
          onClick={onCreate}
          className="flex w-48 shrink-0 items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:w-auto"
        >
          <Plus className="h-4 w-4" />
          Neue Gruppe
        </button>
      )}
    </nav>
  );
}
