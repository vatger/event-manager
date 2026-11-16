"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ArrowUpRight, Check, Lock, Minus, Network, UserX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { teamApi } from "@/lib/api/team";
import {
  PERMISSION_CATEGORIES,
  TEAM_BASE_RIGHTS,
  getPermission,
} from "@/lib/acl/catalog";
import type { AccessSource, ExplainedPermission } from "@/lib/acl/access";
import type { Department, PersonAccess, TeamGroup } from "@/types/fir";
import { ConfirmRemovalDialog } from "./GroupDialogs";
import { PersonAvatar } from "./PersonAvatar";
import { peopleLeavingWithout } from "./teamUtils";

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

function describeSource(source: AccessSource): string {
  if (source.type === "leitung") return `über die Leitung (${source.groupName})`;
  if (source.type === "group") return `über ${source.groupName}`;
  return `enthalten in „${getPermission(source.via!).label}“ (${source.groupName})`;
}

function PermissionLine({ permission }: { permission: ExplainedPermission }) {
  const { label } = getPermission(permission.key);
  return (
    <li className="flex items-start gap-3 py-2">
      {permission.granted ? (
        <Check className="mt-0.5 h-4 w-4 shrink-0" aria-label="vergeben" />
      ) : (
        <Minus className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50" aria-label="nicht vergeben" />
      )}
      <div className="min-w-0">
        <p className={cn("text-sm", permission.granted ? "font-medium" : "text-muted-foreground")}>
          {label}
        </p>
        {permission.granted && (
          <p className="text-xs text-muted-foreground">
            {permission.sources.map(describeSource).join(" · ")}
          </p>
        )}
      </div>
    </li>
  );
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

function ObjectRoles({ access, firCode }: { access: PersonAccess; firCode: string }) {
  const { responsibleEvents, rosterEditorEvents, managedWeeklys, cptResponsible } =
    access.objectRoles;
  const empty =
    responsibleEvents.length === 0 &&
    rosterEditorEvents.length === 0 &&
    managedWeeklys.length === 0 &&
    !cptResponsible;

  if (empty) {
    return <p className="text-sm text-muted-foreground">Keine Rollen an einzelnen Events.</p>;
  }

  const item = (key: string, role: string, label: string, href: string) => (
    <li key={key}>
      <Link
        href={href}
        className="group flex items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-accent"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{label}</span>
          <span className="block text-xs text-muted-foreground">{role}</span>
        </span>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
      </Link>
    </li>
  );

  return (
    <ul className="-mx-2">
      {responsibleEvents.map((e) =>
        item(`r-${e.id}`, "Event-Verantwortung", `${e.name} · ${formatDate(e.startTime)}`, `/admin/events/${e.id}`)
      )}
      {rosterEditorEvents.map((e) =>
        item(`e-${e.id}`, "Bearbeiter des Besetzungsplans", `${e.name} · ${formatDate(e.startTime)}`, `/admin/events/${e.id}/roster`)
      )}
      {managedWeeklys.map((w) =>
        item(`w-${w.id}`, "Weekly-Verantwortung", w.name, `/admin/weeklys/${w.id}/edit`)
      )}
      {cptResponsible && item("cpt", "CPT-Verantwortung", `CPTs der FIR ${firCode}`, "/admin/cpts")}
    </ul>
  );
}

/**
 * Zugriff einer Person: ihre Gruppen (direkt umschaltbar), jedes Recht mit
 * Herkunft und die Rollen, die an einzelnen Events hängen.
 */
export function PersonSheet({
  department,
  cid,
  onClose,
  onChanged,
}: {
  department: Department;
  cid: number | null;
  onClose: () => void;
  onChanged: () => Promise<unknown>;
}) {
  const { data: access, error, mutate } = useSWR<PersonAccess, Error>(
    cid ? ["person-access", department.code, cid] : null,
    () => teamApi.getPersonAccess(department.code, cid!),
    { revalidateOnFocus: false }
  );

  const [busyGroup, setBusyGroup] = useState<number | null>(null);
  const [leavingGroup, setLeavingGroup] = useState<TeamGroup | null>(null);
  const [confirmRemoveAll, setConfirmRemoveAll] = useState(false);

  const person = department.groups.flatMap((g) => g.members).find((m) => m.cid === cid);
  const memberOf = new Set(
    department.groups.filter((g) => g.members.some((m) => m.cid === cid)).map((g) => g.id)
  );
  const inLeitung = department.groups.some(
    (g) => g.kind === "FIR_LEITUNG" && memberOf.has(g.id)
  );
  const canRemoveFromDepartment = !inLeitung || department.viewer.isGlobal;

  const refresh = async () => {
    await onChanged();
    await mutate();
  };

  const join = async (group: TeamGroup) => {
    if (!cid) return;
    setBusyGroup(group.id);
    try {
      await teamApi.addGroupMember(department.code, group.id, cid);
      await refresh();
      toast.success(`Zu „${group.name}“ hinzugefügt`);
    } catch (e) {
      toast.error(errorMessage(e, "Das hat nicht geklappt"));
    } finally {
      setBusyGroup(null);
    }
  };

  const name = person?.name ?? access?.name ?? "";

  return (
    <Sheet open={cid !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
        <SheetHeader className="border-b p-6">
          <div className="flex items-center gap-4">
            <PersonAvatar name={name || "?"} size="lg" />
            <div className="min-w-0">
              <SheetTitle className="truncate text-xl">{name || "Person"}</SheetTitle>
              <SheetDescription>
                {person ? `${person.cid} · ${person.rating}` : "Zugriff im Department"}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-8 p-6">
          {(access?.isVatgerLeitung || access?.isMainAdmin) && (
            <p className="flex items-start gap-3 rounded-lg border p-3 text-sm">
              <Network className="mt-0.5 h-4 w-4 shrink-0 text-accent-500" />
              <span>
                {name.split(" ")[0]} gehört zur{" "}
                {access.isMainAdmin ? "Systemadministration" : "VATGER-Eventleitung"} und darf
                damit in allen FIRs alles – unabhängig von den Gruppen hier.
              </span>
            </p>
          )}

          {/* Gruppen */}
          <section>
            <h3 className="font-semibold">Gruppen</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Über ihre Gruppen bekommt die Person ihre Rechte.
            </p>
            <ul className="mt-3 divide-y rounded-lg border">
              {department.groups.map((group) => {
                const isLeitung = group.kind === "FIR_LEITUNG";
                const locked = isLeitung && !department.viewer.isGlobal;
                const checked = memberOf.has(group.id);
                const id = `person-group-${group.id}`;
                return (
                  <li key={group.id} className="flex items-center gap-3 px-3 py-2.5">
                    <Switch
                      id={id}
                      checked={checked}
                      disabled={locked || busyGroup === group.id}
                      onCheckedChange={(next) => (next ? join(group) : setLeavingGroup(group))}
                      className="data-[state=checked]:bg-accent-500"
                    />
                    <label htmlFor={id} className="min-w-0 flex-1 text-sm font-medium">
                      <span className="block truncate">{group.name}</span>
                      {isLeitung && (
                        <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
                          {locked && <Lock className="h-3 w-3" />}
                          {locked ? "Besetzt die VATGER-Eventleitung" : "Leitung – alle Rechte"}
                        </span>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Rechte mit Herkunft */}
          <section>
            <h3 className="font-semibold">Rechte in {department.code}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Jedes Recht mit der Gruppe, aus der es stammt.
            </p>

            {error ? (
              <p className="mt-3 text-sm text-destructive">{error.message}</p>
            ) : !access ? (
              <div className="mt-3 space-y-2">
                {Array.from({ length: 6 }, (_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : (
              <div className="mt-3 space-y-4">
                {PERMISSION_CATEGORIES.map((category) => (
                  <div key={category.id}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {category.label}
                    </p>
                    <ul className="divide-y">
                      {access.permissions
                        .filter((p) => getPermission(p.key).category === category.id)
                        .map((p) => (
                          <PermissionLine key={p.key} permission={p} />
                        ))}
                    </ul>
                  </div>
                ))}
                <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Als Teammitglied ohnehin:</span>{" "}
                  {TEAM_BASE_RIGHTS.join(" · ")}
                </p>
              </div>
            )}
          </section>

          {/* Objektbezogene Rollen */}
          <section>
            <h3 className="font-semibold">Rollen an einzelnen Events</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Werden am jeweiligen Event, Weekly oder im CPT Manager gepflegt.
            </p>
            <div className="mt-3">
              {access ? (
                <ObjectRoles access={access} firCode={department.code} />
              ) : (
                !error && <Skeleton className="h-8 w-full" />
              )}
            </div>
          </section>

          {/* Entfernen */}
          <section className="border-t pt-6">
            <Button
              variant="outline"
              onClick={() => setConfirmRemoveAll(true)}
              disabled={!canRemoveFromDepartment}
              className="text-destructive hover:text-destructive"
            >
              <UserX />
              Aus dem Department entfernen
            </Button>
            {!canRemoveFromDepartment && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" />
                Mitglieder der Leitung entfernt nur die VATGER-Eventleitung.
              </p>
            )}
          </section>
        </div>

        <ConfirmRemovalDialog
          open={!!leavingGroup}
          onOpenChange={(open) => !open && setLeavingGroup(null)}
          title={`Aus „${leavingGroup?.name ?? ""}“ entfernen?`}
          description={`${name} verliert die Rechte dieser Gruppe.`}
          confirmLabel="Aus der Gruppe entfernen"
          leaving={
            leavingGroup && cid ? peopleLeavingWithout(department, leavingGroup.id, [cid]) : []
          }
          onConfirm={async () => {
            if (!leavingGroup || !cid) return;
            const lastGroup = memberOf.size === 1;
            await teamApi.removeGroupMember(department.code, leavingGroup.id, cid);
            toast.success(`${name} wurde aus „${leavingGroup.name}“ entfernt`);
            if (lastGroup) {
              await onChanged();
              onClose();
            } else {
              await refresh();
            }
          }}
        />

        <ConfirmRemovalDialog
          open={confirmRemoveAll}
          onOpenChange={setConfirmRemoveAll}
          title={`${name} aus dem Department entfernen?`}
          description={`${name} wird aus allen Gruppen von ${department.code} entfernt und verliert damit alle Rechte und den Zugang zum Admin-Bereich.`}
          confirmLabel="Aus dem Department entfernen"
          onConfirm={async () => {
            if (!cid) return;
            await teamApi.removeFromDepartment(department.code, cid);
            toast.success(`${name} gehört nicht mehr zum Department ${department.code}`);
            await onChanged();
            onClose();
          }}
        />
      </SheetContent>
    </Sheet>
  );
}
