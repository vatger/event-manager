import { cn } from "@/lib/utils";

/**
 * Zeichenzähler, der erst gegen Ende auftaucht.
 *
 * Ein dauernd sichtbarer Zähler ist bei kurzen Notizen nur Rauschen. Er
 * erscheint ab 80 % der Grenze, damit man sie sieht, bevor das Feld aufhört,
 * Zeichen anzunehmen.
 */
export function CharLimitHint({
  length,
  max,
  className,
}: {
  length: number;
  max: number;
  className?: string;
}) {
  if (length < max * 0.8) return null;
  return (
    <span
      className={cn(
        "text-[10px] tabular-nums",
        length >= max ? "text-destructive" : "text-muted-foreground",
        className
      )}
    >
      {length}/{max}
    </span>
  );
}
