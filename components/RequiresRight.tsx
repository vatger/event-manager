"use client";

import * as React from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { missingRightMessage, type CapabilityKey } from "@/lib/events/eventCapabilities";

/**
 * Knopf, der ohne passendes Recht deaktiviert ist und im Tooltip sagt, welches
 * Recht fehlt. Statt erst beim Speichern zu scheitern, sieht man es vorher.
 *
 * Das Kind muss `disabled` annehmen. Deaktivierte Knöpfe lösen keine
 * Zeiger-Ereignisse aus – der Tooltip hängt deshalb an einer Hülle.
 */
export function RequiresRight({
  allowed,
  capability,
  reason,
  children,
  className,
}: {
  allowed: boolean;
  capability?: CapabilityKey;
  /** Eigene Begründung statt des Standardsatzes */
  reason?: string;
  children: React.ReactElement<{ disabled?: boolean }>;
  className?: string;
}) {
  if (allowed) return children;

  const message = reason ?? (capability ? missingRightMessage(capability) : "Dafür fehlt dir das Recht.");
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className={className ?? "inline-flex w-full cursor-not-allowed"} aria-label={message}>
          {React.cloneElement(children, { disabled: true })}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-64">
        {message}
      </TooltipContent>
    </Tooltip>
  );
}
