"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, HelpCircle, Plus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { teamApi } from "@/lib/api/team";
import type { PermissionKey } from "@/lib/acl/catalog";
import type { TeamGroup } from "@/types/fir";
import { AddPersonDialog } from "../_components/AddPersonDialog";
import {
  ConfirmRemovalDialog,
  GroupFormDialog,
  describeGroupDeletion,
} from "../_components/GroupDialogs";
import { GroupDetail } from "../_components/GroupDetail";
import { GroupList } from "../_components/GroupList";
import { PeopleTab } from "../_components/PeopleTab";
import { PermissionMatrix } from "../_components/PermissionMatrix";
import { PersonSheet } from "../_components/PersonSheet";
import { RolesExplainer } from "../_components/RolesExplainer";
import { listPeople, peopleLeavingWithout, plural } from "../_components/teamUtils";
import { useDepartment } from "../_components/useDepartment";

const sameKeys = (a: PermissionKey[], b: PermissionKey[]) =>
  a.length === b.length && a.every((key) => b.includes(key));

export default function DepartmentPage() {
  const params = useParams();
  const code = String(params.code ?? "").toUpperCase();
  const { department, error, loading, reload } = useDepartment(code);

  const [tab, setTab] = useState("groups");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  // Ungespeicherte Rechte je Gruppe – bleiben beim Wechsel der Gruppe erhalten
  const [drafts, setDrafts] = useState<Record<number, PermissionKey[]>>({});
  const [personCid, setPersonCid] = useState<number | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TeamGroup | null>(null);
  const [deleting, setDeleting] = useState<TeamGroup | null>(null);
  const [addPersonOpen, setAddPersonOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const groups = useMemo(() => department?.groups ?? [], [department]);
  const selected = groups.find((g) => g.id === selectedId) ?? groups[0] ?? null;
  const peopleCount = useMemo(
    () => (department ? listPeople(department).length : 0),
    [department]
  );

  const dirtyIds = useMemo(() => {
    const ids = new Set<number>();
    for (const group of groups) {
      const draft = drafts[group.id];
      if (draft && !sameKeys(draft, group.permissions)) ids.add(group.id);
    }
    return ids;
  }, [groups, drafts]);

  // Verlassen der Seite mit ungespeicherten Rechten: der Browser fragt nach
  useEffect(() => {
    if (dirtyIds.size === 0) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirtyIds]);

  const discardDraft = (groupId: number) =>
    setDrafts((current) => {
      const next = { ...current };
      delete next[groupId];
      return next;
    });

  const selectGroup = (groupId: number) => {
    setSelectedId(groupId);
    setTab("groups");
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-16 w-72" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !department) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Department nicht verfügbar</h1>
        <p className="mt-2 text-muted-foreground">
          {error?.message === "Keine Berechtigung"
            ? "Diesen Bereich sehen nur die Leitung der FIR und die VATGER-Eventleitung."
            : error?.message ?? "Das Department konnte nicht geladen werden."}
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link href="/admin/team">Zur Übersicht</Link>
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8",
        // Platz für die schwebende Speicherleiste
        dirtyIds.size > 0 && "pb-28"
      )}
    >
      {/* Kopf */}
      {department.viewer.isGlobal && (
        <Link
          href="/admin/team"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Alle Departments
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Eventdepartment {department.code}</p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{department.name}</h1>
          <p className="mt-1 text-muted-foreground">
            {plural(peopleCount, "Person", "Personen")} in{" "}
            {plural(groups.length, "Gruppe", "Gruppen")}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setHelpOpen(true)}>
          <HelpCircle />
          So funktionieren Rollen &amp; Rechte
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="groups" className="px-4">
              Gruppen
              <span className="text-muted-foreground">{groups.length}</span>
            </TabsTrigger>
            <TabsTrigger value="people" className="px-4">
              Personen
              <span className="text-muted-foreground">{peopleCount}</span>
            </TabsTrigger>
          </TabsList>

          {tab === "groups" ? (
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus />
              Neue Gruppe
            </Button>
          ) : (
            <Button onClick={() => setAddPersonOpen(true)}>
              <UserPlus />
              Person hinzufügen
            </Button>
          )}
        </div>

        {/* Gruppen */}
        <TabsContent value="groups" className="mt-4 space-y-4">
          <PermissionMatrix
            groups={groups}
            selectedId={selected?.id ?? null}
            onSelect={selectGroup}
          />

          <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
            <GroupList
              groups={groups}
              selectedId={selected?.id ?? null}
              dirtyIds={dirtyIds}
              onSelect={setSelectedId}
            />
            {selected && (
              <GroupDetail
                key={selected.id}
                department={department}
                group={selected}
                draft={drafts[selected.id] ?? selected.permissions}
                dirty={dirtyIds.has(selected.id)}
                onDraftChange={(next) =>
                  setDrafts((current) => ({ ...current, [selected.id]: next }))
                }
                onDiscard={() => discardDraft(selected.id)}
                onChanged={reload}
                onEdit={() => {
                  setEditing(selected);
                  setFormOpen(true);
                }}
                onDelete={() => setDeleting(selected)}
                onOpenPerson={setPersonCid}
              />
            )}
          </div>
        </TabsContent>

        {/* Personen */}
        <TabsContent value="people" className="mt-4">
          <PeopleTab department={department} onOpenPerson={setPersonCid} />
        </TabsContent>
      </Tabs>

      {/* Dialoge */}
      <GroupFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        firCode={department.code}
        group={editing}
        onSaved={async (groupId) => {
          await reload();
          setSelectedId(groupId);
        }}
      />

      <ConfirmRemovalDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Gruppe „${deleting?.name ?? ""}“ löschen?`}
        description={deleting ? describeGroupDeletion(deleting) : ""}
        confirmLabel="Gruppe löschen"
        leaving={deleting ? peopleLeavingWithout(department, deleting.id) : []}
        onConfirm={async () => {
          if (!deleting) return;
          await teamApi.deleteGroup(department.code, deleting.id);
          discardDraft(deleting.id);
          setSelectedId(null);
          await reload();
          toast.success(`Gruppe „${deleting.name}“ gelöscht`);
        }}
      />

      <AddPersonDialog
        open={addPersonOpen}
        onOpenChange={setAddPersonOpen}
        department={department}
        onAdded={reload}
      />

      <PersonSheet
        department={department}
        cid={personCid}
        onClose={() => setPersonCid(null)}
        onChanged={reload}
      />

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>So funktionieren Rollen &amp; Rechte</DialogTitle>
            <DialogDescription>
              Vier Ebenen, von der Systemadministration bis zum Teammitglied. Rechte werden an
              Gruppen vergeben, nie an einzelne Personen.
            </DialogDescription>
          </DialogHeader>
          <RolesExplainer className="xl:grid-cols-2" />
        </DialogContent>
      </Dialog>
    </div>
  );
}
