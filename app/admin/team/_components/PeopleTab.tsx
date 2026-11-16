"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Search, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { Department } from "@/types/fir";
import { PersonAvatar } from "./PersonAvatar";
import { listPeople, plural } from "./teamUtils";

/**
 * Alle Personen des Departments mit ihren Gruppen. Ein Klick öffnet den
 * Zugriff der Person – dort steht jedes Recht mit seiner Herkunft.
 */
export function PeopleTab({
  department,
  onOpenPerson,
}: {
  department: Department;
  onOpenPerson: (cid: number) => void;
}) {
  const [query, setQuery] = useState("");
  const people = useMemo(() => listPeople(department), [department]);

  const term = query.trim().toLowerCase();
  const filtered = term
    ? people.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          String(p.cid).includes(term) ||
          p.groups.some((g) => g.name.toLowerCase().includes(term))
      )
    : people;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nach Name, CID oder Gruppe filtern"
            className="bg-card pl-9"
            aria-label="Personen filtern"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          {term
            ? `${filtered.length} von ${plural(people.length, "Person", "Personen")}`
            : plural(people.length, "Person", "Personen")}
        </p>
      </div>

      <div className="rounded-xl border bg-card shadow-sm">
        {filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            {people.length === 0
              ? "Dieses Department hat noch keine Mitglieder."
              : "Niemand passt zu diesem Filter."}
          </p>
        ) : (
          <ul className="divide-y">
            {filtered.map((person) => (
              <li key={person.cid}>
                <button
                  type="button"
                  onClick={() => onOpenPerson(person.cid)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-accent sm:px-5"
                >
                  <PersonAvatar name={person.name} />
                  <span className="min-w-0 flex-1 sm:w-56 sm:flex-none">
                    <span className="block truncate text-sm font-medium">{person.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {person.cid} · {person.rating}
                    </span>
                  </span>
                  <span className="hidden min-w-0 flex-1 flex-wrap gap-1.5 sm:flex">
                    {person.groups.map((group) =>
                      group.kind === "FIR_LEITUNG" ? (
                        <Badge key={group.id}>
                          <ShieldCheck />
                          Leitung
                        </Badge>
                      ) : (
                        <Badge key={group.id} variant="secondary">
                          {group.name}
                        </Badge>
                      )
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground sm:hidden">
                    {plural(person.groups.length, "Gruppe", "Gruppen")}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
