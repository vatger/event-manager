"use client";

import { Lock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  PERMISSION_CATALOG,
  PERMISSION_CATEGORIES,
  TEAM_BASE_RIGHTS,
  getPermission,
  type PermissionKey,
} from "@/lib/acl/catalog";

/** Fest eingebaute Rechte – nur zur Anzeige, nicht abwählbar. */
export function FixedRights({
  title,
  rights,
  className,
}: {
  title: string;
  rights: readonly string[];
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg bg-muted/60 p-4", className)}>
      <p className="flex items-center gap-2 text-sm font-medium">
        <Lock className="h-3.5 w-3.5 text-muted-foreground" />
        {title}
      </p>
      <ul className="mt-2 grid gap-x-6 gap-y-1 text-sm text-muted-foreground sm:grid-cols-2">
        {rights.map((right) => (
          <li key={right} className="flex gap-2">
            <span aria-hidden className="text-muted-foreground/60">
              •
            </span>
            {right}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Rechte einer Untergruppe, nach Kategorie gruppiert. Deckt ein gewähltes
 * Recht ein anderes bereits mit ab, erscheint dieses als fest eingeschaltet.
 */
export function PermissionEditor({
  groupId,
  value,
  onChange,
  readOnly,
}: {
  groupId: number;
  value: PermissionKey[];
  onChange: (next: PermissionKey[]) => void;
  readOnly?: boolean;
}) {
  const selected = new Set(value);

  const toggle = (key: PermissionKey, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(key);
    else next.delete(key);
    // Reihenfolge des Katalogs beibehalten
    onChange(PERMISSION_CATALOG.map((p) => p.key).filter((k) => next.has(k)));
  };

  return (
    <div className="space-y-5">
      <FixedRights title="Jedes Teammitglied darf ohnehin" rights={TEAM_BASE_RIGHTS} />

      {PERMISSION_CATEGORIES.map((category) => (
        <fieldset key={category.id}>
          <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {category.label}
          </legend>
          <div className="mt-1 divide-y">
            {PERMISSION_CATALOG.filter((p) => p.category === category.id).map((permission) => {
              const direct = selected.has(permission.key);
              const via = direct
                ? undefined
                : value.find((k) => getPermission(k).includes?.includes(permission.key));
              const id = `perm-${groupId}-${permission.key}`;
              return (
                <div key={permission.key} className="flex items-start gap-3 py-3">
                  <Switch
                    id={id}
                    checked={direct || !!via}
                    disabled={readOnly || !!via}
                    onCheckedChange={(checked) => toggle(permission.key, checked)}
                    aria-describedby={`${id}-description`}
                    className="mt-0.5 data-[state=checked]:bg-accent-500"
                  />
                  <div className="min-w-0 flex-1">
                    <label htmlFor={id} className="text-sm font-medium">
                      {permission.label}
                    </label>
                    <p id={`${id}-description`} className="text-sm text-muted-foreground">
                      {permission.description}
                    </p>
                    {via && (
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Lock className="h-3 w-3" />
                        Enthalten in „{getPermission(via).label}“
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
