"use client";

import { useEffect, useState } from "react";
import { CalendarX2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getBadgeClassForEndorsement } from "@/utils/EndorsementBadge";
import { cn } from "@/lib/utils";

interface Absence {
  cid: number;
  name: string;
  rating: string;
  reason: string | null;
  since: string;
}

const COLLAPSED = 6;

/**
 * Wer hat sich als „nicht dabei“ gemeldet?
 *
 * Neben der Anmeldeliste: Viele Abwesende heißen „schlechter Termin“, wenige
 * Anmeldungen ohne Abwesende eher „das Event ist untergegangen“.
 */
export function AbsencesCard({ eventId, signupCount }: { eventId: number; signupCount: number }) {
  const [absences, setAbsences] = useState<Absence[] | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/events/${eventId}/absences`)
      .then((res) => (res.ok ? res.json() : { absences: [] }))
      .then((data) => {
        if (!cancelled) setAbsences(data.absences ?? []);
      })
      .catch(() => {
        if (!cancelled) setAbsences([]);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  if (absences === null) return null;

  const shown = expanded ? absences : absences.slice(0, COLLAPSED);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <CalendarX2 className="h-5 w-5" />
          Nicht dabei
          <Badge variant="secondary" className="font-semibold">
            {absences.length}
          </Badge>
          <span className="ml-auto text-sm font-normal text-muted-foreground">
            {signupCount} angemeldet
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {absences.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Noch niemand hat sich für diesen Termin abgemeldet.
          </p>
        ) : (
          <div className="space-y-2">
            <ul className="divide-y rounded-md border">
              {shown.map((a) => (
                <li key={a.cid} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                  <span className="font-medium">{a.name}</span>
                  <span className="text-muted-foreground tabular-nums">{a.cid}</span>
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-xs font-semibold",
                      getBadgeClassForEndorsement(a.rating)
                    )}
                  >
                    {a.rating}
                  </span>
                  {a.reason && <span className="min-w-0 flex-1 text-muted-foreground">{a.reason}</span>}
                  <span className="ml-auto text-muted-foreground tabular-nums">
                    {new Date(a.since).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
                  </span>
                </li>
              ))}
            </ul>
            {absences.length > COLLAPSED && (
              <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
                {expanded ? "Weniger anzeigen" : `Alle ${absences.length} anzeigen`}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default AbsencesCard;
