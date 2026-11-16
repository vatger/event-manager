import type { Department, GroupKind, TeamMember } from "@/types/fir";

export interface DepartmentPerson extends TeamMember {
  groups: Array<{ id: number; name: string; kind: GroupKind }>;
  isLead: boolean;
}

/** Alle Personen eines Departments mit ihren Gruppen, Leitung zuerst. */
export function listPeople(department: Department): DepartmentPerson[] {
  const byCid = new Map<number, DepartmentPerson>();
  for (const group of department.groups) {
    for (const member of group.members) {
      const person =
        byCid.get(member.cid) ?? { ...member, groups: [], isLead: false };
      person.groups.push({ id: group.id, name: group.name, kind: group.kind });
      if (group.kind === "FIR_LEITUNG") person.isLead = true;
      byCid.set(member.cid, person);
    }
  }
  return Array.from(byCid.values()).sort((a, b) => {
    if (a.isLead !== b.isLead) return a.isLead ? -1 : 1;
    return a.name.localeCompare(b.name, "de");
  });
}

/**
 * Personen, die nach dem Wegfall einer Gruppe in keiner Gruppe des
 * Departments mehr wären – sie verlieren damit den Zugang zum Admin-Bereich.
 */
export function peopleLeavingWithout(
  department: Department,
  groupId: number,
  cids?: number[]
): TeamMember[] {
  const group = department.groups.find((g) => g.id === groupId);
  if (!group) return [];
  const elsewhere = new Set(
    department.groups
      .filter((g) => g.id !== groupId)
      .flatMap((g) => g.members.map((m) => m.cid))
  );
  return group.members.filter(
    (m) => !elsewhere.has(m.cid) && (!cids || cids.includes(m.cid))
  );
}

export const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;
