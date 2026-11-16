"use client";

import { useState } from "react";
import { Loader2, Lock, Pencil, ShieldCheck, Trash2, UserMinus, Users } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { teamApi } from "@/lib/api/team";
import { LEITUNG_FIXED_RIGHTS, type PermissionKey } from "@/lib/acl/catalog";
import type { Department, TeamGroup, TeamMember, TeamUserSearchResult } from "@/types/fir";
import { ConfirmRemovalDialog } from "./GroupDialogs";
import { FixedRights, PermissionEditor } from "./PermissionEditor";
import { PersonAvatar } from "./PersonAvatar";
import { UserSearch } from "./UserSearch";
import { peopleLeavingWithout } from "./teamUtils";

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

interface GroupDetailProps {
  department: Department;
  group: TeamGroup;
  /** Entwurf der Rechte (weicht vom gespeicherten Stand ab, solange ungespeichert) */
  draft: PermissionKey[];
  dirty: boolean;
  onDraftChange: (next: PermissionKey[]) => void;
  onDiscard: () => void;
  onChanged: () => Promise<unknown>;
  onEdit: () => void;
  onDelete: () => void;
  onOpenPerson: (cid: number) => void;
}

/** Eine Gruppe mit allem, was zu ihr gehört: Mitglieder und Rechte auf einer Seite. */
export function GroupDetail({
  department,
  group,
  draft,
  dirty,
  onDraftChange,
  onDiscard,
  onChanged,
  onEdit,
  onDelete,
  onOpenPerson,
}: GroupDetailProps) {
  const isLeitung = group.kind === "FIR_LEITUNG";
  // Die Leitungsgruppe pflegt nur die VATGER-Eventleitung bzw. ein Main-Admin
  const canManage = !isLeitung || department.viewer.isGlobal;

  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<TeamMember | null>(null);

  const memberCids = new Set(group.members.map((m) => m.cid));

  const addMember = async (user: TeamUserSearchResult) => {
    setAdding(true);
    try {
      await teamApi.addGroupMember(department.code, group.id, user.cid);
      await onChanged();
      toast.success(`${user.name} ist jetzt in „${group.name}“`);
    } catch (error) {
      toast.error(errorMessage(error, "Die Person konnte nicht hinzugefügt werden"));
    } finally {
      setAdding(false);
    }
  };

  const savePermissions = async () => {
    setSaving(true);
    try {
      await teamApi.setGroupPermissions(department.code, group.id, draft);
      await onChanged();
      onDiscard();
      toast.success(`Rechte von „${group.name}“ gespeichert`);
    } catch (error) {
      toast.error(errorMessage(error, "Die Rechte konnten nicht gespeichert werden"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className="rounded-xl border bg-card shadow-sm">
      {/* Kopf */}
      <header className="flex flex-wrap items-start justify-between gap-3 border-b p-4 sm:p-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">{group.name}</h2>
            {isLeitung && (
              <Badge>
                <ShieldCheck />
                Leitung
              </Badge>
            )}
          </div>
          {group.description && (
            <p className="mt-1 text-sm text-muted-foreground">{group.description}</p>
          )}
        </div>
        {canManage && (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={onEdit}>
              <Pencil />
              Bearbeiten
            </Button>
            {!isLeitung && (
              <Button variant="ghost" size="sm" onClick={onDelete} className="text-destructive hover:text-destructive">
                <Trash2 />
                Löschen
              </Button>
            )}
          </div>
        )}
      </header>

      {/* Mitglieder */}
      <section className="border-b p-4 sm:p-6">
        <h3 className="flex items-center gap-2 font-semibold">
          <Users className="h-4 w-4 text-muted-foreground" />
          Mitglieder
          <span className="text-sm font-normal text-muted-foreground">{group.members.length}</span>
        </h3>

        {canManage ? (
          <div className="mt-3 max-w-md">
            <UserSearch
              onPick={addMember}
              disabled={adding}
              placeholder="Person hinzufügen (Name oder CID)"
              unavailableReason={(user) => {
                if (memberCids.has(user.cid)) return "bereits Mitglied";
                if (user.firCode && user.firCode !== department.code)
                  return `im Department ${user.firCode}`;
                return null;
              }}
            />
          </div>
        ) : (
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Die Leitungsgruppe besetzt die VATGER-Eventleitung. Wende dich an sie, wenn sich an
            der Leitung etwas ändern soll.
          </p>
        )}

        {group.members.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            {isLeitung ? "Die Leitung ist noch nicht besetzt." : "Noch keine Mitglieder."}
          </p>
        ) : (
          <ul className="mt-3 grid gap-x-6 gap-y-0.5 sm:grid-cols-2">
            {group.members.map((member) => (
              <li key={member.cid} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onOpenPerson(member.cid)}
                  title="Zugriff ansehen"
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-1 py-1.5 text-left hover:bg-accent"
                >
                  <PersonAvatar name={member.name} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{member.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {member.cid} · {member.rating}
                    </span>
                  </span>
                </button>
                {canManage && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setRemoving(member)}
                    aria-label={`${member.name} aus der Gruppe entfernen`}
                    title="Aus der Gruppe entfernen"
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <UserMinus />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Rechte */}
      <section className="p-4 sm:p-6">
        <h3 className="font-semibold">Rechte</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {isLeitung
            ? "Die Rechte der Leitung sind fest und für niemanden änderbar."
            : `Gelten für alle Mitglieder dieser Gruppe – ausschließlich in ${department.code}.`}
        </p>

        <div className="mt-4">
          {isLeitung ? (
            <FixedRights title="Die Leitung darf" rights={LEITUNG_FIXED_RIGHTS} />
          ) : (
            <PermissionEditor groupId={group.id} value={draft} onChange={onDraftChange} />
          )}
        </div>
      </section>

      {/* Sammelspeichern: ein versehentlicher Klick vergibt kein Recht. Die
          Leiste schwebt unten mittig, damit sie beim Scrollen durch die Rechte
          sichtbar bleibt und den Meldungen unten rechts nicht im Weg steht. */}
      {dirty && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-4 z-40 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-xl border bg-card px-4 py-3 shadow-lg sm:inset-x-auto sm:bottom-6 sm:left-1/2 sm:-translate-x-1/2 sm:flex-nowrap sm:whitespace-nowrap"
        >
          <p className="flex items-center gap-2 text-sm font-medium">
            <span className="h-2 w-2 rounded-full bg-accent-500" />
            Ungespeicherte Änderungen in „{group.name}“
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onDiscard} disabled={saving}>
              Verwerfen
            </Button>
            <Button size="sm" onClick={savePermissions} disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              Rechte speichern
            </Button>
          </div>
        </div>
      )}

      <ConfirmRemovalDialog
        open={!!removing}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`${removing?.name ?? ""} entfernen?`}
        description={`${removing?.name ?? "Die Person"} verliert die Rechte der Gruppe „${group.name}“.`}
        confirmLabel="Aus der Gruppe entfernen"
        leaving={removing ? peopleLeavingWithout(department, group.id, [removing.cid]) : []}
        onConfirm={async () => {
          if (!removing) return;
          await teamApi.removeGroupMember(department.code, group.id, removing.cid);
          await onChanged();
          toast.success(`${removing.name} wurde aus „${group.name}“ entfernt`);
        }}
      />
    </article>
  );
}
