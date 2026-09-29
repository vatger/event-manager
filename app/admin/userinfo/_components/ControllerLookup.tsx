'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getBadgeClassForEndorsement } from '@/utils/EndorsementBadge';

interface Candidate {
  cid: number;
  name: string;
  rating: string;
}

interface ControllerLookupProps {
  /** Wird mit der gewählten CID aufgerufen */
  onSelect: (cid: number) => void;
  initialValue?: string;
}

/** Erst nach einer kurzen Pause suchen – nicht bei jedem Tastendruck */
const DEBOUNCE_MS = 250;

/**
 * Suchfeld der Controllerinfo – nimmt Name oder CID.
 *
 * Wer eine Person nachschlagen will, kennt meist ihren Namen, selten die CID.
 * Beim Tippen erscheinen passende Personen; eine vollständige CID lässt sich
 * weiterhin direkt mit Enter öffnen, auch wenn sie noch nie am Eventmanager
 * angemeldet war und deshalb nicht in den Vorschlägen auftaucht.
 */
export function ControllerLookup({ onSelect, initialValue = '' }: ControllerLookupProps) {
  const [query, setQuery] = useState(initialValue);
  const [results, setResults] = useState<Candidate[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(initialValue);
  }, [initialValue]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/admin/userinfo/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error('failed');
        const data: { users: Candidate[] } = await res.json();
        setResults(data.users);
        setActive(0);
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Außerhalb klicken schließt die Liste
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const choose = (cid: number) => {
    setOpen(false);
    onSelect(cid);
  };

  const isCid = /^\d{4,}$/.test(query.trim());

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    // Eine Auswahl in der Liste hat Vorrang, sonst zählt eine eingegebene CID
    if (open && results[active]) return choose(results[active].cid);
    if (isCid) return choose(Number(query.trim()));
    if (results.length === 1) return choose(results[0].cid);
    setOpen(true);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const showList = open && query.trim().length >= 2;

  return (
    <div ref={boxRef} className="relative">
      <form onSubmit={submit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Name oder CID eingeben"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            className="pl-8"
            autoComplete="off"
            role="combobox"
            aria-expanded={showList}
            aria-controls="controller-lookup-list"
          />
          {searching && (
            <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
        <Button type="submit" disabled={!query.trim()}>
          Anzeigen
        </Button>
      </form>

      {showList && (
        <ul
          id="controller-lookup-list"
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-md border bg-popover p-1 shadow-md"
        >
          {results.map((u, i) => (
            <li key={u.cid} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(u.cid)}
                className={cn(
                  'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm',
                  i === active ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
                )}
              >
                <span className="min-w-0 flex-1 truncate font-medium">{u.name}</span>
                <span className="font-mono text-xs text-muted-foreground">{u.cid}</span>
                {u.rating && (
                  <Badge className={cn(getBadgeClassForEndorsement(u.rating), 'text-[10px]')}>
                    {u.rating}
                  </Badge>
                )}
              </button>
            </li>
          ))}
          {!searching && results.length === 0 && (
            <li className="px-2 py-1.5 text-sm text-muted-foreground">
              {isCid
                ? 'Keine Person mit diesem Namen – Enter öffnet die CID direkt.'
                : 'Niemand gefunden. Gesucht wird unter allen, die sich schon einmal am Eventmanager angemeldet haben.'}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
