import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

/** Kennzeichen für Controller auf dem Theory Roster (siehe lib/training/s1TheoryRoster) */
export function S1TheoryBadge({
  className,
  compact = false,
}: {
  className?: string;
  /** Nur das Symbol, für enge Zeilen */
  compact?: boolean;
}) {
  return (
    <span
      title="Theory Roster"
      className={cn(
        "inline-flex items-center gap-0.5 rounded border px-1 text-[10px] font-medium leading-4 shrink-0",
        "border-violet-300 bg-violet-100 text-violet-800",
        "dark:border-violet-700 dark:bg-violet-900/40 dark:text-violet-200",
        className
      )}
    >
      <GraduationCap className="h-3 w-3" />
      {!compact && "Theory Roster"}
    </span>
  );
}

export default S1TheoryBadge;
