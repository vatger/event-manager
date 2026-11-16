"use client";

import { CalendarClock, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type SignupStatusTone = "neutral" | "success" | "warning" | "danger";

const STATUS_TONE: Record<SignupStatusTone, string> = {
  neutral: "bg-secondary-100 text-secondary-700 dark:bg-secondary-800 dark:text-secondary-200",
  success: "bg-success-100 text-success-900 dark:bg-success-900/40 dark:text-success-200",
  warning: "bg-warning-100 text-warning-950 dark:bg-warning-900/40 dark:text-warning-100",
  danger: "bg-danger-100 text-danger-800 dark:bg-danger-900/40 dark:text-danger-200",
};

/**
 * Rahmen der Anmeldedialoge – für Lotsen wie für das Eventteam derselbe.
 *
 * Kopf mit Status, scrollbarer Inhalt auf dem Seitenhintergrund, darin die
 * Abschnitte als Karten, unten eine feste Aktionsleiste. Auf dem Handy füllt
 * der Dialog den Bildschirm.
 */
export function SignupDialogFrame({
  open,
  onOpenChange,
  title,
  subtitle,
  subtitleIcon: SubtitleIcon = CalendarClock,
  status,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  subtitleIcon?: LucideIcon;
  status?: { label: string; tone?: SignupStatusTone };
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // Kein Fokus beim Öffnen: sonst springt auf dem Handy die Tastatur auf
        onOpenAutoFocus={(e) => e.preventDefault()}
        className={cn(
          "flex flex-col gap-0 p-0 outline-none",
          "top-0 left-0 h-[100dvh] max-h-[100dvh] w-full max-w-full translate-x-0 translate-y-0 rounded-none border-0",
          "sm:top-[50%] sm:left-[50%] sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-xl sm:border"
        )}
      >
        <DialogHeader className="gap-1.5 border-b bg-card px-5 py-4 pr-12 text-left sm:rounded-t-xl">
          {status && (
            <span
              className={cn(
                "w-fit rounded-full px-2.5 py-0.5 text-xs font-medium",
                STATUS_TONE[status.tone ?? "neutral"]
              )}
            >
              {status.label}
            </span>
          )}
          <DialogTitle className="text-xl leading-tight">{title}</DialogTitle>
          {subtitle && (
            <DialogDescription className="flex items-center gap-1.5 text-sm tabular-nums">
              <SubtitleIcon className="h-4 w-4 shrink-0" />
              <span>{subtitle}</span>
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
        <div className="border-t bg-card px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:rounded-b-xl">
          {footer}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Abschnitt als Karte: Symbol, Überschrift, rechts optional Aktionen oder ein Wert */
export function SignupSection({
  icon: Icon,
  title,
  aside,
  children,
}: {
  icon: LucideIcon;
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-lg border bg-card p-4 shadow-xs">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {title}
        </h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Kurzer Hinweis mit Symbol */
export function SignupNotice({
  icon: Icon,
  tone = "neutral",
  children,
}: {
  icon: LucideIcon;
  tone?: "neutral" | "warning";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border px-4 py-3 text-sm",
        tone === "warning"
          ? "border-warning-300 bg-warning-50 text-warning-950 dark:border-warning-800 dark:bg-warning-950/40 dark:text-warning-100"
          : "bg-card text-foreground"
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          tone === "warning" ? "text-warning-800 dark:text-warning-300" : "text-muted-foreground"
        )}
      />
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}
