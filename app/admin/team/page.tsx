"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { ArrowRight, ShieldAlert } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useUser } from "@/hooks/useUser";
import { teamApi } from "@/lib/api/team";
import type { DepartmentSummary } from "@/types/fir";
import { PersonAvatar } from "./_components/PersonAvatar";
import { RolesExplainer } from "./_components/RolesExplainer";
import { VatgerLeitungSection } from "./_components/VatgerLeitungSection";
import { plural } from "./_components/teamUtils";

function DepartmentCard({ department }: { department: DepartmentSummary }) {
  return (
    <Link
      href={`/admin/team/${department.code}`}
      className="group flex flex-col rounded-xl border bg-card p-5 shadow-sm transition-colors hover:border-accent-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-2xl font-bold tracking-tight">{department.code}</p>
          <p className="text-sm text-muted-foreground">{department.name}</p>
        </div>
        <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-accent-500" />
      </div>

      <p className="mt-4 text-sm">
        {plural(department.memberCount, "Person", "Personen")} ·{" "}
        {plural(department.groupCount, "Gruppe", "Gruppen")}
      </p>

      <div className="mt-4 border-t pt-4">
        <p className="text-xs font-medium text-muted-foreground">Leitung</p>
        {department.leads.length === 0 ? (
          <p className="mt-2 flex items-center gap-2 text-sm">
            <ShieldAlert className="h-4 w-4 text-warning-600" />
            Noch nicht besetzt
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {department.leads.map((lead) => (
              <li key={lead.cid} className="flex items-center gap-2 text-sm">
                <PersonAvatar name={lead.name} size="sm" />
                <span className="truncate">{lead.name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Link>
  );
}

export default function TeamOverviewPage() {
  const router = useRouter();
  const { user, isVATGERLead, isMainAdmin } = useUser();
  const { data: departments, error } = useSWR<DepartmentSummary[], Error>(
    "departments",
    () => teamApi.listDepartments(),
    { revalidateOnFocus: false }
  );

  const isGlobal = isVATGERLead();

  // Wer genau ein Department leitet, braucht keine Übersicht davor
  const onlyDepartment =
    user && !isGlobal && departments?.length === 1 ? departments[0].code : null;
  useEffect(() => {
    if (onlyDepartment) router.replace(`/admin/team/${onlyDepartment}`);
  }, [onlyDepartment, router]);

  if (error) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Kein Zugriff</h1>
        <p className="mt-2 text-muted-foreground">
          „Team &amp; Rechte“ sehen nur die Leitung eines FIR-Eventdepartments und die
          VATGER-Eventleitung.
        </p>
      </div>
    );
  }

  if (!departments || !user || onlyDepartment) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-16 w-72" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-52" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-4 py-8 sm:px-6 lg:px-8">
      <header>
        <p className="eyebrow">Organisation</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Team &amp; Rechte</h1>
        <p className="mt-1 text-muted-foreground">
          Wer gehört zu welchem Eventdepartment – und wer darf dort was?
        </p>
      </header>

      <section>
        <h2 className="text-lg font-semibold">Eventdepartments</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {departments.map((department) => (
            <DepartmentCard key={department.code} department={department} />
          ))}
        </div>
      </section>

      {isGlobal && (
        <section>
          <h2 className="text-lg font-semibold">Über den FIRs</h2>
          <div className="mt-3">
            <VatgerLeitungSection canManage={isMainAdmin()} />
          </div>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold">So greifen die Rollen ineinander</h2>
        <RolesExplainer className="mt-3" />
      </section>
    </div>
  );
}
