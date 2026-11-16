"use client";

import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Rahmen der Anmeldedialoge – für Lotsen wie für das Eventteam derselbe.
 *
 * Kopf, scrollbarer Inhalt, feste Aktionsleiste. Auf dem Handy füllt der
 * Dialog den Bildschirm, damit die Zeitauswahl Platz hat und die Knöpfe
 * immer erreichbar bleiben.
 */
export function SignupDialogFrame({
  open,
  onOpenChange,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
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
          "sm:top-[50%] sm:left-[50%] sm:h-auto sm:max-h-[90vh] sm:max-w-xl sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg sm:border"
        )}
      >
        <DialogHeader className="gap-1 border-b px-5 py-4 pr-12 text-left">
          <DialogTitle className="text-lg">{title}</DialogTitle>
          {subtitle && (
            <DialogDescription className="text-sm tabular-nums">{subtitle}</DialogDescription>
          )}
        </DialogHeader>
        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">{children}</div>
        <div className="border-t px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {footer}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Abschnitt im Dialog: Überschrift wie ein Formularlabel, rechts optional ein Wert */
export function SignupSection({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium">{title}</h3>
        {aside && <span className="text-sm text-muted-foreground tabular-nums">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

/** Kurzer Hinweis im Dialog – eine Zeile, Markenfarbe je nach Bedeutung */
export function SignupNotice({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "warning";
  children: React.ReactNode;
}) {
  return (
    <p
      className={cn(
        "rounded-md border-l-4 px-3 py-2 text-sm",
        tone === "warning"
          ? "border-warning-700 bg-warning-50 text-warning-950 dark:bg-warning-950/40 dark:text-warning-100"
          : "border-primary-900 bg-secondary-100 text-foreground dark:border-secondary-300 dark:bg-secondary-900"
      )}
    >
      {children}
    </p>
  );
}
