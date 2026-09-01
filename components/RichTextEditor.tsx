"use client";

import { useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Link2 } from "lucide-react";

interface RichTextEditorProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  disabled?: boolean;
  className?: string;
}

/**
 * Leichter Editor für den von components/RichText.tsx erwarteten Freitext:
 * ein Textarea plus ein Werkzeug, das die Link-Schreibweise `[Text](url)`
 * an der Cursorposition einfügt, statt sie von Hand tippen zu müssen. Es
 * entsteht bewusst kein HTML – RichText baut daraus ausschließlich sichere
 * http(s)/mailto-Links, alles andere bleibt reiner Text (siehe dort).
 */
export function RichTextEditor({
  id,
  value,
  onChange,
  placeholder,
  rows = 4,
  maxLength,
  disabled,
  className,
}: RichTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const selectionRef = useRef({ start: 0, end: 0 });
  const [open, setOpen] = useState(false);
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  const openLinkPopover = () => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    selectionRef.current = { start, end };
    setLinkLabel(value.slice(start, end));
    setLinkUrl("");
    setOpen(true);
  };

  const insertLink = () => {
    const url = linkUrl.trim();
    if (!url) return;
    const label = linkLabel.trim() || url;
    const { start, end } = selectionRef.current;
    const markdown = `[${label}](${url})`;
    onChange(value.slice(0, start) + markdown + value.slice(end));
    setOpen(false);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      const pos = start + markdown.length;
      el.setSelectionRange(pos, pos);
    });
  };

  return (
    <div className={className}>
      <div className="flex items-center gap-1 rounded-t-md border border-b-0 bg-muted/40 px-1.5 py-1">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs"
              disabled={disabled}
              onClick={openLinkPopover}
            >
              <Link2 className="h-3.5 w-3.5" />
              Link
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor={id ? `${id}-link-label` : undefined} className="text-xs">
                Beschriftung
              </Label>
              <Input
                id={id ? `${id}-link-label` : undefined}
                value={linkLabel}
                onChange={(e) => setLinkLabel(e.target.value)}
                placeholder="z. B. Real-life-Anmeldung"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={id ? `${id}-link-url` : undefined} className="text-xs">
                Adresse
              </Label>
              <Input
                id={id ? `${id}-link-url` : undefined}
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://…"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    insertLink();
                  }
                }}
              />
            </div>
            <Button
              type="button"
              size="sm"
              className="w-full"
              onClick={insertLink}
              disabled={!linkUrl.trim()}
            >
              Einfügen
            </Button>
          </PopoverContent>
        </Popover>
        <span className="ml-1 hidden text-[11px] text-muted-foreground sm:inline">
          Adressen werden auch automatisch erkannt
        </span>
      </div>
      <Textarea
        id={id}
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        disabled={disabled}
        className="rounded-t-none"
      />
      {typeof maxLength === "number" && (
        <p className="mt-1 text-xs text-muted-foreground">
          {value.length}/{maxLength} Zeichen
        </p>
      )}
    </div>
  );
}

export default RichTextEditor;
