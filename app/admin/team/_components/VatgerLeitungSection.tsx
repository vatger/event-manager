"use client";

import { useState } from "react";
import useSWR from "swr";
import { KeyRound, Network, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { teamApi } from "@/lib/api/team";
import type { MainAdmin, VatgerLeader } from "@/types/fir";
import { ConfirmRemovalDialog } from "./GroupDialogs";
import { PersonAvatar } from "./PersonAvatar";
import { UserSearch } from "./UserSearch";

/**
 * Die beiden Ebenen über den FIRs: VATGER-Eventleitung (ernennt ein Main-Admin)
 * und Main-Admins (stehen in der Serverkonfiguration, hier nur Anzeige).
 */
export function VatgerLeitungSection({ canManage }: { canManage: boolean }) {
  const { data, error, mutate } = useSWR<
    { leaders: VatgerLeader[]; mainAdmins: MainAdmin[] },
    Error
  >("vatger-leitung", () => teamApi.getVatgerLeitung(), { revalidateOnFocus: false });

  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<VatgerLeader | null>(null);

  if (error) return null;

  const leaderCids = new Set(data?.leaders.map((l) => l.cid));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
        <h3 className="flex items-center gap-2 font-semibold">
          <Network className="h-4 w-4 text-muted-foreground" />
          VATGER-Eventleitung
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Führt alle Eventdepartments und besetzt die Leitungsgruppen der FIRs.
        </p>

        {canManage && (
          <div className="mt-4">
            <UserSearch
              disabled={adding}
              placeholder="Person ernennen (Name oder CID)"
              unavailableReason={(user) => (leaderCids.has(user.cid) ? "bereits ernannt" : null)}
              onPick={async (user) => {
                setAdding(true);
                try {
                  await teamApi.addVatgerLeader(user.cid);
                  await mutate();
                  toast.success(`${user.name} gehört jetzt zur VATGER-Eventleitung`);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Das hat nicht geklappt");
                } finally {
                  setAdding(false);
                }
              }}
            />
          </div>
        )}

        {!data ? (
          <Skeleton className="mt-4 h-12 w-full" />
        ) : data.leaders.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Noch niemand ernannt.</p>
        ) : (
          <ul className="mt-3 divide-y">
            {data.leaders.map((leader) => (
              <li key={leader.cid} className="flex items-center gap-3 py-2.5">
                <PersonAvatar name={leader.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{leader.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {leader.cid} · {leader.rating}
                  </p>
                </div>
                {leader.isMainAdmin && <Badge variant="secondary">auch Main-Admin</Badge>}
                {canManage && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setRemoving(leader)}
                    aria-label={`${leader.name} abberufen`}
                    title="Abberufen"
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <UserMinus />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {!canManage && (
          <p className="mt-3 text-xs text-muted-foreground">
            Die VATGER-Eventleitung ernennt ein Main-Admin.
          </p>
        )}
      </section>

      <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
        <h3 className="flex items-center gap-2 font-semibold">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
          Main-Admins
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Administrieren das System. Festgelegt in der Serverkonfiguration (
          <code className="font-mono text-xs">MAIN_ADMIN_CIDS</code>), hier nur zur Anzeige.
        </p>

        {!data ? (
          <Skeleton className="mt-4 h-12 w-full" />
        ) : data.mainAdmins.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Keine Main-Admins konfiguriert.</p>
        ) : (
          <ul className="mt-3 divide-y">
            {data.mainAdmins.map((admin) => (
              <li key={admin.cid} className="flex items-center gap-3 py-2.5">
                <PersonAvatar name={admin.name ?? "?"} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {admin.name ?? (
                      <span className="font-normal text-muted-foreground">
                        Noch nie angemeldet
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {admin.cid}
                    {admin.rating ? ` · ${admin.rating}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmRemovalDialog
        open={!!removing}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`${removing?.name ?? ""} abberufen?`}
        description={`${removing?.name ?? "Die Person"} verliert den Zugriff auf alle Eventdepartments. Mitgliedschaften in einzelnen FIR-Gruppen bleiben bestehen.`}
        confirmLabel="Abberufen"
        onConfirm={async () => {
          if (!removing) return;
          await teamApi.removeVatgerLeader(removing.cid);
          await mutate();
          toast.success(`${removing.name} gehört nicht mehr zur VATGER-Eventleitung`);
        }}
      />
    </div>
  );
}
