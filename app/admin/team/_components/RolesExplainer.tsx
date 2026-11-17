import { KeyRound, Network, ShieldCheck, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const ROLES = [
  {
    icon: KeyRound,
    title: "Main-Admin",
    text: "Administriert das System: API-Keys, Cronjobs und Diagnose. Ernennt die VATGER-Eventleitung.",
  },
  {
    icon: Network,
    title: "VATGER-Eventleitung",
    text: "Führt alle Eventdepartments, besetzt die Leitungsgruppen der FIRs und darf inhaltlich alles.",
  },
  {
    icon: ShieldCheck,
    title: "FIR-Eventleitung",
    text: "Organisiert ihr Department: legt Untergruppen an, nimmt Mitglieder auf und verteilt Rechte.",
  },
  {
    icon: Users,
    title: "Teammitglied",
    text: "Hat die Grundrechte des Teams und zusätzlich die Rechte seiner Gruppen – nur in der eigenen FIR.",
  },
] as const;

/** Die vier Ebenen des Rechtesystems, von oben nach unten. */
export function RolesExplainer({ className }: { className?: string }) {
  return (
    <ol className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-4", className)}>
      {ROLES.map(({ icon: Icon, title, text }, index) => (
        <li key={title} className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
              <Icon className="h-4 w-4" />
            </span>
            <span className="text-xs font-medium text-muted-foreground">Ebene {index + 1}</span>
          </div>
          <p className="mt-3 font-semibold">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{text}</p>
        </li>
      ))}
    </ol>
  );
}
