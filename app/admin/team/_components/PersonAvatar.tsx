import { cn } from "@/lib/utils";
import { getAvatarColor } from "@/utils/getAvatarColor";

const SIZES = {
  sm: "h-7 w-7 text-[0.65rem]",
  md: "h-9 w-9 text-xs",
  lg: "h-12 w-12 text-sm",
} as const;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.charAt(0) ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
  return (first + last).toUpperCase() || "?";
}

/** Initialen-Avatar in den Markentönen – reine Wiedererkennung, keine Bedeutung. */
export function PersonAvatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        SIZES[size],
        getAvatarColor(name),
        className
      )}
    >
      {initials(name)}
    </span>
  );
}
