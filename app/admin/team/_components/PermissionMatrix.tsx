"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, CornerDownRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PERMISSION_CATALOG,
  PERMISSION_CATEGORIES,
  getPermission,
  type PermissionKey,
} from "@/lib/acl/catalog";
import type { TeamGroup } from "@/types/fir";

type CellState =
  | { type: "granted" }
  | { type: "included"; via: PermissionKey }
  | { type: "none" };

function cellState(group: TeamGroup, key: PermissionKey): CellState {
  if (group.kind === "FIR_LEITUNG") {
    // Nur ausdrücklich vergebene Rechte hat die Leitung nicht automatisch
    return getPermission(key).explicitOnly ? { type: "none" } : { type: "granted" };
  }
  if (group.permissions.includes(key)) return { type: "granted" };
  const via = group.permissions.find((k) => getPermission(k).includes?.includes(key));
  return via ? { type: "included", via } : { type: "none" };
}

const STORAGE_KEY = "team-matrix-open";

/**
 * Lesende Übersicht „Gruppen × Rechte“ für das ganze Department. Bearbeitet
 * wird in der Gruppe – ein Klick auf den Spaltenkopf wählt sie aus.
 */
export function PermissionMatrix({
  groups,
  selectedId,
  onSelect,
}: {
  groups: TeamGroup[];
  selectedId: number | null;
  onSelect: (groupId: number) => void;
}) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    // Auf schmalen Bildschirmen zunächst eingeklappt – dort zählt die Gruppe
    // darunter mehr als die breite Tabelle. Eine eigene Wahl hat Vorrang.
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      // Ohne Speicherzugriff gilt die Vorgabe
    }
    if (stored === "0" || (stored === null && window.innerWidth < 640)) setOpen(false);
  }, []);

  const toggle = () => {
    setOpen((value) => {
      try {
        localStorage.setItem(STORAGE_KEY, value ? "0" : "1");
      } catch {
        // Zustand gilt dann nur für diesen Besuch
      }
      return !value;
    });
  };

  return (
    <section className="rounded-xl border bg-card shadow-sm">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left sm:px-5"
      >
        <span>
          <span className="font-semibold">Wer darf was?</span>
          <span className="ml-2 hidden text-sm text-muted-foreground sm:inline">
            Alle Gruppen und ihre Rechte auf einen Blick
          </span>
        </span>
        <ChevronDown
          className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="border-t">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-card px-4 py-2 text-left text-xs font-medium text-muted-foreground sm:px-5">
                    Recht
                  </th>
                  {groups.map((group) => (
                    <th key={group.id} className="p-0 align-bottom font-normal">
                      <button
                        type="button"
                        onClick={() => onSelect(group.id)}
                        title={`${group.name} öffnen`}
                        className={cn(
                          "w-full min-w-24 max-w-36 truncate px-2 py-2 text-xs font-medium hover:text-foreground",
                          group.id === selectedId
                            ? "text-foreground underline decoration-accent-500 decoration-2 underline-offset-4"
                            : "text-muted-foreground"
                        )}
                      >
                        {group.name}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              {PERMISSION_CATEGORIES.map((category) => (
                <tbody key={category.id} className="border-t">
                  {PERMISSION_CATALOG.filter((p) => p.category === category.id).map((permission) => (
                    <tr key={permission.key} className="hover:bg-muted/50">
                      <th
                        scope="row"
                        title={permission.description}
                        className="sticky left-0 z-10 whitespace-nowrap bg-card px-4 py-1.5 text-left font-normal sm:px-5"
                      >
                        {permission.label}
                      </th>
                      {groups.map((group) => {
                        const state = cellState(group, permission.key);
                        return (
                          <td
                            key={group.id}
                            className={cn(
                              "px-2 py-1.5 text-center",
                              group.id === selectedId && "bg-muted/60"
                            )}
                          >
                            {state.type === "granted" && (
                              <Check
                                className="mx-auto h-4 w-4"
                                aria-label={`${group.name}: ${permission.label} vergeben`}
                              />
                            )}
                            {state.type === "included" && (
                              <span
                                title={`Enthalten in „${getPermission(state.via).label}“`}
                                className="inline-flex"
                              >
                                <CornerDownRight
                                  className="mx-auto h-3.5 w-3.5 text-muted-foreground"
                                  aria-label={`${group.name}: ${permission.label} enthalten in ${getPermission(state.via).label}`}
                                />
                              </span>
                            )}
                            {state.type === "none" && (
                              <span className="text-muted-foreground/40" aria-hidden>
                                –
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-4 py-2 text-xs text-muted-foreground sm:px-5">
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-foreground" /> vergeben
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CornerDownRight className="h-3.5 w-3.5" /> in einem anderen Recht enthalten
            </span>
          </p>
        </div>
      )}
    </section>
  );
}
