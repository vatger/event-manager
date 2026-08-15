import React from "react";
import { cn } from "@/lib/utils";

/**
 * Freitext mit Links – ohne HTML.
 *
 * Beschreibungstexte kommen aus dem Adminbereich und sollen auf externe Seiten
 * verweisen können („Für die Real-Life-Anmeldung hier klicken"). HTML zuzulassen
 * hieße, jedem mit Schreibrecht auf ein Event auch Skripte auf der öffentlichen
 * Seite zu erlauben. Stattdessen versteht diese Komponente zwei Schreibweisen
 * und baut die Links selbst – der übrige Text bleibt immer reiner Text:
 *
 *   [Beschriftung](https://…)   → Link mit eigener Beschriftung
 *   https://…                   → wird automatisch verlinkt
 *
 * Zulässig sind ausschließlich http(s)- und mailto-Ziele; alles andere bleibt
 * als Text stehen, damit `javascript:`-Adressen gar nicht erst entstehen.
 */

/** Markdown-Link oder nackte URL; die Reihenfolge im Muster ist wichtig */
const PATTERN =
  /\[([^\]\n]{1,120})\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)|(https?:\/\/[^\s<]+|mailto:[^\s<]+)/g;

/** Satzzeichen am Ende einer nackten URL gehören meist zum Satz, nicht zum Link */
function trimTrailingPunctuation(url: string): { url: string; rest: string } {
  const match = /[.,;:!?)\]]+$/.exec(url);
  if (!match) return { url, rest: "" };
  return { url: url.slice(0, -match[0].length), rest: match[0] };
}

function isSafeHref(href: string): boolean {
  return /^(https?:\/\/|mailto:)/i.test(href);
}

/** Anzeigeform einer nackten URL: ohne Schema und ohne abschließenden Slash */
function prettyUrl(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

interface RichTextProps {
  text: string;
  className?: string;
  /** Klassen für die erzeugten Links */
  linkClassName?: string;
}

export function RichText({ text, className, linkClassName }: RichTextProps) {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  // Zeilenumbrüche bleiben erhalten (whitespace-pre-line am Container)
  for (const match of text.matchAll(PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) nodes.push(text.slice(lastIndex, index));

    const [full, label, labelHref, bareUrl] = match;
    if (label && labelHref && isSafeHref(labelHref)) {
      nodes.push(
        <a
          key={key++}
          href={labelHref}
          target="_blank"
          rel="noopener noreferrer"
          className={cn("link underline underline-offset-2", linkClassName)}
        >
          {label}
        </a>
      );
    } else if (bareUrl && isSafeHref(bareUrl)) {
      const { url, rest } = trimTrailingPunctuation(bareUrl);
      nodes.push(
        <a
          key={key++}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn("link underline underline-offset-2", linkClassName)}
        >
          {prettyUrl(url)}
        </a>
      );
      if (rest) nodes.push(rest);
    } else {
      // Unbekanntes Ziel: unverändert als Text ausgeben
      nodes.push(full);
    }
    lastIndex = index + full.length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));

  return <span className={cn("whitespace-pre-line", className)}>{nodes}</span>;
}

export default RichText;
