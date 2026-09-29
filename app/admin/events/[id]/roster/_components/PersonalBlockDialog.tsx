"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CUSTOM_BLOCK_COLORS,
  CUSTOM_BLOCK_COLOR_DOT,
  CUSTOM_BLOCK_COLOR_LABEL,
  type CustomBlockColor,
} from "@/lib/roster/blockColors";

/**
 * Häufige Einträge in der Zeile einer Person.
 *
 * Alles, was jemanden während des Events bindet, ohne dass er selbst eine
 * Position besetzt: Mentoring neben einem Trainee, eine geplante Pause, ein
 * Briefing, Bereitschaft.
 */
const PERSONAL_PRESETS = ["Mentor", "Pause", "Standby", "Briefing", "Supervisor"];

interface PersonalBlockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Für wen und wann – nur zur Anzeige */
  controllerName: string;
  timeLabel: string;
  onCreate: (label: string, color: CustomBlockColor | null) => void;
}

/**
 * Block in der Zeile einer Person eintragen, etwa „Mentor".
 *
 * Solche Blöcke hängen an keiner Station. Sie zeigen, dass die Person in der
 * Zeit gebunden ist – der Editor lässt sie dann auch nicht zusätzlich auf eine
 * Station setzen.
 */
export function PersonalBlockDialog({
  open,
  onOpenChange,
  controllerName,
  timeLabel,
  onCreate,
}: PersonalBlockDialogProps) {
  const [label, setLabel] = useState("");
  const [color, setColor] = useState<CustomBlockColor | null>(null);

  useEffect(() => {
    if (open) setLabel("");
  }, [open]);

  const submit = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onCreate(trimmed, color);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Block für {controllerName}</DialogTitle>
          <DialogDescription>
            {timeLabel} – zum Beispiel Mentoring oder eine Pause. Der Block steht in der Zeile der
            Person, nicht auf einer Station.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {PERSONAL_PRESETS.map((preset) => (
              <Button
                key={preset}
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => submit(preset)}
              >
                {preset}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Eigene Bezeichnung"
              value={label}
              maxLength={60}
              autoFocus
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit(label);
              }}
            />
            <Button variant="secondary" onClick={() => submit(label)} disabled={!label.trim()}>
              <Plus className="mr-1 h-4 w-4" /> Eintragen
            </Button>
          </div>
          <div className="flex items-center gap-1.5 pt-0.5">
            <span className="mr-0.5 text-xs text-muted-foreground">Farbe:</span>
            <button
              type="button"
              onClick={() => setColor(null)}
              aria-label="Standardfarbe"
              title="Standard"
              className={cn(
                "h-5 w-5 rounded-full border border-dashed border-muted-foreground/60 transition-transform",
                color === null && "scale-110 ring-2 ring-foreground/40"
              )}
            />
            {CUSTOM_BLOCK_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={CUSTOM_BLOCK_COLOR_LABEL[c]}
                title={CUSTOM_BLOCK_COLOR_LABEL[c]}
                className={cn(
                  "h-5 w-5 rounded-full transition-transform",
                  CUSTOM_BLOCK_COLOR_DOT[c],
                  color === c && "scale-110 ring-2 ring-foreground/40"
                )}
              />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default PersonalBlockDialog;
