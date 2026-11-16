"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { teamApi } from "@/lib/api/team";
import type { TeamUserSearchResult } from "@/types/fir";
import { PersonAvatar } from "./PersonAvatar";

interface UserSearchProps {
  onPick: (user: TeamUserSearchResult) => void;
  /** Grund, warum ein Treffer nicht wählbar ist – oder null, wenn er es ist */
  unavailableReason?: (user: TeamUserSearchResult) => string | null;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

/**
 * Personensuche nach Name oder CID. Zeigt schon im Ergebnis, warum jemand
 * nicht hinzugefügt werden kann (anderes Department, bereits Mitglied) –
 * statt einer Fehlermeldung nach dem Klick.
 */
export function UserSearch({
  onPick,
  unavailableReason,
  placeholder = "Person suchen (Name oder CID)",
  disabled,
  autoFocus,
}: UserSearchProps) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TeamUserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const term = query.trim();

  useEffect(() => {
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => {
      teamApi
        .searchUsers(term, controller.signal)
        .then((users) => {
          setResults(users);
          setActive(0);
        })
        .catch(() => {
          if (!controller.signal.aborted) setResults([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term]);

  // Klick außerhalb schließt die Trefferliste
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const pick = (user: TeamUserSearchResult) => {
    if (unavailableReason?.(user)) return;
    onPick(user);
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (results.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (i - 1 + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      pick(results[active]);
    }
  };

  const showList = open && term.length >= 2;

  return (
    <div ref={containerRef} className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        autoComplete="off"
        className="pl-9 pr-9"
      />
      {loading && (
        <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}

      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {results.length === 0 ? (
            <li className="px-3 py-3 text-sm text-muted-foreground">
              {loading
                ? "Suche …"
                : "Niemand gefunden. Auffindbar ist nur, wer sich schon einmal im Eventmanager angemeldet hat."}
            </li>
          ) : (
            results.map((user, index) => {
              const reason = unavailableReason?.(user) ?? null;
              return (
                <li
                  key={user.cid}
                  role="option"
                  aria-selected={index === active}
                  aria-disabled={!!reason}
                  onPointerEnter={() => setActive(index)}
                  onClick={() => pick(user)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-2 py-2 text-sm",
                    reason ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                    index === active && !reason && "bg-accent"
                  )}
                >
                  <PersonAvatar name={user.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{user.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {user.cid} · {user.rating}
                    </div>
                  </div>
                  {reason && (
                    <span className="shrink-0 text-xs text-muted-foreground">{reason}</span>
                  )}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
