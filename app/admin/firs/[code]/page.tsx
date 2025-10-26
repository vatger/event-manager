// app/admin/firs/[code]/page.tsx
"use client";

import { use, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FIR, Group } from "@prisma/client";
import { CreateGroupDialog, EditGroupDialog, DeleteGroupDialog } from "../_components/GroupDialogs";
import GroupsPanel from "../_components/GroupsPanel";
import MembersPanel from "../_components/MembersPanel";
import PermissionsPanel from "../_components/PermissionPanel";
import { Member, PermissionRow } from "../_components/types";

export default function FIRWorkspacePage(props: { params: Promise<{ code: string }> }) {
  const { code } = use(props.params);

  // FIR & Gruppen
  const [fir, setFIR] = useState<FIR | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);

  // Mitglieder
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Permissions
  const [perms, setPerms] = useState<PermissionRow[]>([]);
  const [loadingPerms, setLoadingPerms] = useState(false);

  // UI-Dialoge
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [deletingGroupId, setDeletingGroupId] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);

  // -------- Data loaders
  async function loadFIR() {
    const [firRes, groupRes] = await Promise.all([
      fetch(`/api/firs/${code}`, { cache: "no-store" }),
      fetch(`/api/firs/${code}/groups`, { cache: "no-store" }),
    ]);
    if (!firRes.ok) throw new Error("FIR nicht gefunden");
    if (!groupRes.ok) throw new Error("Gruppen konnten nicht geladen werden");
    const firData: FIR = await firRes.json();
    setFIR(firData);
    const grpData = await groupRes.json();
    const mapped: Group[] = grpData.map((g: any) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      firId: g.firId,
      createdAt: new Date(g.createdAt),
      updatedAt: new Date(g.updatedAt),
    }));
    setGroups(mapped);
    setGroups(mapped);
    if (!selectedGroupId && mapped.length) setSelectedGroupId(mapped[0].id);
  }

  async function loadMembers(groupId: number) {
    setLoadingMembers(true);
    try {
      const res = await fetch(`/api/firs/${code}/groups/${groupId}/members`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      setMembers(await res.json());
    } catch {
      toast.error("Mitglieder konnten nicht geladen werden");
    } finally {
      setLoadingMembers(false);
    }
  }

  async function loadPermissions(groupId: number) {
    setLoadingPerms(true);
    try {
      const res = await fetch(`/api/firs/${code}/groups/${groupId}/permissions`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      setPerms(await res.json());
    } catch {
      toast.error("Rechte konnten nicht geladen werden");
    } finally {
      setLoadingPerms(false);
    }
  }

  useEffect(() => {
    (async () => {
      try { setLoading(true); await loadFIR(); }
      catch (e) { toast.error(e instanceof Error ? e.message : "Fehler beim Laden"); }
      finally { setLoading(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  useEffect(() => {
    if (selectedGroupId) {
      loadMembers(selectedGroupId);
      loadPermissions(selectedGroupId);
    } else {
      setMembers([]);
      setPerms([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroupId]);

  // -------- Actions (werden an Panels/Dialogs übergeben)
  const refetchGroupsAndSelect = async (selectId?: number) => {
    await loadFIR();
    if (selectId) setSelectedGroupId(selectId);
  };

  const openEditGroup = (g: Group) => { setEditingGroup(g); setEditOpen(true); };
  const confirmDeleteGroup = (groupId: number) => { setDeletingGroupId(groupId); setDeleteOpen(true); };

  if (loading) {
    return <div className="flex justify-center items-center h-96"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  if (!fir) return <div className="container mx-auto py-8">FIR nicht gefunden.</div>;

  return (
    <div className="container mx-auto py-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">
          {fir.name} <span className="text-muted-foreground">({fir.code})</span>
        </h1>
        <Button onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" /> Gruppe</Button>
      </div>

      <div className="hidden lg:grid grid-cols-12 gap-4">
        <GroupsPanel
          groups={groups}
          selectedId={selectedGroupId}
          onSelect={setSelectedGroupId}
          onCreateClick={() => setCreateOpen(true)}
          onEditClick={openEditGroup}
          onDeleteClick={confirmDeleteGroup}
        />

        <MembersPanel
          firCode={code}
          selectedGroupId={selectedGroupId}
          members={members}
          loading={loadingMembers}
          onReload={() => selectedGroupId && loadMembers(selectedGroupId)}
        />

        <PermissionsPanel
          firCode={code}
          selectedGroupId={selectedGroupId}
          perms={perms}
          setPerms={setPerms}
          loading={loadingPerms}
          onReload={() => selectedGroupId && loadPermissions(selectedGroupId)}
        />
      </div>

      {/* Mobile/Tablet? => Optional: Tabs wie vorher. (aus Platzgründen hier weggelassen) */}

      {/* Dialoge */}
      <CreateGroupDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        firCode={code}
        onCreated={async (newGroupId) => {
          setCreateOpen(false);
          await refetchGroupsAndSelect(newGroupId);
        }}
      />
      <EditGroupDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        firCode={code}
        group={editingGroup}
        onUpdated={async () => {
          setEditOpen(false);
          await refetchGroupsAndSelect(editingGroup?.id ?? undefined);
        }}
      />
      <DeleteGroupDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        firCode={code}
        groupId={deletingGroupId}
        onDeleted={async () => {
          setDeleteOpen(false);
          setDeletingGroupId(null);
          await refetchGroupsAndSelect();
        }}
      />
    </div>
  );
}
