"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Columns3, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { INFO_FIELDS, INFO_FIELD_LABEL, type InfoField } from "../_lib/infoFields";

interface InfoFieldsControls {
  showInfoColumn: boolean;
  onToggleInfoColumn: () => void;
  infoFields: Set<InfoField>;
  onToggleInfoField: (field: InfoField) => void;
}

/**
 * Auswahl der Angaben in der Infospalte.
 *
 * Dieselben Einträge erscheinen an zwei Stellen – als Knopf über der Spalte und
 * als Rechtsklick-Menü in ihr. Deshalb liegen sie hier gemeinsam: Wer die
 * Auswahl ändert, soll überall dasselbe vorfinden.
 */
export function InfoFieldsMenuItems({
  showInfoColumn,
  onToggleInfoColumn,
  infoFields,
  onToggleInfoField,
}: InfoFieldsControls) {
  return (
    <>
      <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
        Infospalte
      </DropdownMenuLabel>
      <DropdownMenuCheckboxItem checked={showInfoColumn} onCheckedChange={onToggleInfoColumn}>
        Spalte anzeigen
      </DropdownMenuCheckboxItem>
      <DropdownMenuSeparator />
      {INFO_FIELDS.map((field) => (
        <DropdownMenuCheckboxItem
          key={field}
          checked={infoFields.has(field)}
          disabled={!showInfoColumn}
          onCheckedChange={() => onToggleInfoField(field)}
        >
          {INFO_FIELD_LABEL[field]}
        </DropdownMenuCheckboxItem>
      ))}
    </>
  );
}

/**
 * Knopfpaar über der Infospalte: Auswahl der Angaben und Ein-/Ausklappen.
 * Steht direkt über der Spalte, die es steuert.
 */
export function InfoColumnControls(props: InfoFieldsControls) {
  return (
    <div className="flex items-center gap-0.5">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title="Anzeige der Infospalte wählen (auch per Rechtsklick in der Spalte)"
            aria-label="Anzeige der Infospalte wählen"
          >
            <Columns3 className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <InfoFieldsMenuItems {...props} />
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        title={props.showInfoColumn ? "Infospalte ausblenden" : "Infospalte einblenden"}
        onClick={props.onToggleInfoColumn}
      >
        {props.showInfoColumn ? (
          <PanelLeftClose className="h-3.5 w-3.5" />
        ) : (
          <PanelLeftOpen className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  );
}

/**
 * Rechtsklick-Menü in der Infospalte.
 *
 * Der Anker ist ein Punkt an der Mausposition – so öffnet das Menü dort, wo
 * geklickt wurde, ohne dass jede Zeile ein eigenes Menü mitschleppen muss.
 */
export function InfoColumnContextMenu({
  at,
  onClose,
  ...controls
}: InfoFieldsControls & {
  at: { x: number; y: number } | null;
  onClose: () => void;
}) {
  return (
    <DropdownMenu open={at !== null} onOpenChange={(open) => !open && onClose()}>
      <DropdownMenuTrigger asChild>
        <span
          aria-hidden
          className="pointer-events-none fixed"
          style={{ left: at?.x ?? 0, top: at?.y ?? 0, width: 0, height: 0 }}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <InfoFieldsMenuItems {...controls} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
