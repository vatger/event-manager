"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, KeyRound, Loader2, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ApiTokenRow {
  id: number;
  name: string;
  tokenPrefix: string;
  firCode: string | null;
  includeDrafts: boolean;
  createdByName: string | null;
  createdByCID: number;
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

const EXPIRY_OPTIONS = [
  { value: "30", label: "30 Tage" },
  { value: "90", label: "90 Tage" },
  { value: "365", label: "1 Jahr" },
  { value: "none", label: "Unbegrenzt" },
];

const fmt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "–";

function tokenState(t: ApiTokenRow): { label: string; className: string } {
  if (t.revokedAt) return { label: "Widerrufen", className: "bg-muted text-muted-foreground" };
  if (t.expiresAt && new Date(t.expiresAt) <= new Date()) {
    return { label: "Abgelaufen", className: "bg-muted text-muted-foreground" };
  }
  return {
    label: "Aktiv",
    className: "bg-success-100 text-success-800 dark:bg-success-900/40 dark:text-success-300",
  };
}

/**
 * API-Tokens für /api/v1 vergeben und widerrufen (nur Main Admins).
 *
 * Das Token erscheint genau einmal nach dem Anlegen; gespeichert wird nur
 * sein Hash.
 */
export default function ApiTokensCard() {
  const [tokens, setTokens] = useState<ApiTokenRow[]>([]);
  const [firs, setFirs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [fir, setFir] = useState("all");
  const [expiry, setExpiry] = useState("365");
  const [includeDrafts, setIncludeDrafts] = useState(false);
  const [secret, setSecret] = useState<{ name: string; value: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ApiTokenRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/system/api-tokens");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTokens(data.tokens ?? []);
    } catch {
      toast.error("API-Tokens konnten nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    fetch("/api/firs")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const list = (Array.isArray(data) ? data : data?.firs ?? []) as { code?: string }[];
        setFirs(list.map((f) => f.code).filter((c): c is string => !!c).sort());
      })
      .catch(() => setFirs([]));
  }, [load]);

  const create = async () => {
    if (!name.trim()) {
      toast.error("Bitte einen Namen angeben");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/system/api-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          firCode: fir === "all" ? null : fir,
          expiresInDays: expiry === "none" ? null : Number(expiry),
          includeDrafts,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Token konnte nicht angelegt werden");
      setSecret({ name: data.token.name, value: data.secret });
      setCopied(false);
      setName("");
      setIncludeDrafts(false);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Token konnte nicht angelegt werden");
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (token: ApiTokenRow) => {
    try {
      const res = await fetch(`/api/admin/system/api-tokens/${token.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success(`„${token.name}“ widerrufen`);
      void load();
    } catch {
      toast.error("Token konnte nicht widerrufen werden");
    } finally {
      setRevokeTarget(null);
    }
  };

  const copySecret = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret.value);
      setCopied(true);
    } catch {
      toast.error("Kopieren nicht möglich – bitte manuell markieren");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5" />
          API-Tokens
        </CardTitle>
        <CardDescription>
          Zugang zu <code className="text-xs">/api/v1</code> (Events einer FIR, Besetzungspläne) ohne
          Login – z. B. für ATCISS oder Bots. Gesendet wird das Token als{" "}
          <code className="text-xs">Authorization: Bearer …</code>. Es gibt nur veröffentlichte
          Pläne und nie interne Notizen heraus; Entwürfe nur, wenn das Token sie einschließt.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_10rem_10rem_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="api-token-name" className="text-xs">
              Name / Verwendung
            </Label>
            <Input
              id="api-token-name"
              placeholder="z. B. ATCISS EDMM"
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">FIR</Label>
            <Select value={fir} onValueChange={setFir}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle FIRs</SelectItem>
                {firs.map((code) => (
                  <SelectItem key={code} value={code}>
                    {code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Gültig</Label>
            <Select value={expiry} onValueChange={setExpiry}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPIRY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={create} disabled={creating}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Anlegen
          </Button>
        </div>

        <label className="-mt-2 flex items-center gap-2 text-sm">
          <Checkbox checked={includeDrafts} onCheckedChange={(v) => setIncludeDrafts(v === true)} />
          Entwürfe einschließen
        </label>

        {secret && (
          <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-900/20">
            <p className="font-medium">Token für „{secret.name}“</p>
            <p className="text-xs text-muted-foreground">
              Jetzt kopieren – es wird nur dieses eine Mal angezeigt und lässt sich nicht
              wiederherstellen.
            </p>
            <div className="flex gap-2">
              <code className="flex-1 overflow-x-auto whitespace-nowrap rounded border bg-background px-2 py-1.5 text-xs">
                {secret.value}
              </code>
              <Button size="sm" variant="outline" onClick={copySecret}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Kopiert" : "Kopieren"}
              </Button>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setSecret(null)}>
              Ausblenden
            </Button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Lädt …
          </div>
        ) : tokens.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine Tokens vergeben.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Token</TableHead>
                  <TableHead>FIR</TableHead>
                  <TableHead>Angelegt</TableHead>
                  <TableHead>Gültig bis</TableHead>
                  <TableHead>Zuletzt genutzt</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {tokens.map((t) => {
                  const state = tokenState(t);
                  const active = state.label === "Aktiv";
                  return (
                    <TableRow key={t.id} className={active ? undefined : "opacity-60"}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell>
                        <code className="text-xs">{t.tokenPrefix}…</code>
                      </TableCell>
                      <TableCell>
                        {t.firCode ?? "Alle"}
                        {t.includeDrafts && (
                          <span className="block text-xs text-muted-foreground">inkl. Entwürfe</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {fmt(t.createdAt)}
                        <span className="block text-muted-foreground">
                          {t.createdByName ?? `CID ${t.createdByCID}`}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">{t.expiresAt ? fmt(t.expiresAt) : "unbegrenzt"}</TableCell>
                      <TableCell className="text-xs">{fmt(t.lastUsedAt)}</TableCell>
                      <TableCell>
                        <Badge className={state.className}>{state.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {!t.revokedAt && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-danger-700 hover:text-danger-800 dark:text-danger-300"
                            onClick={() => setRevokeTarget(t)}
                          >
                            <Trash2 className="h-4 w-4" />
                            Widerrufen
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!revokeTarget} onOpenChange={(o) => !o && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Token widerrufen?</AlertDialogTitle>
            <AlertDialogDescription>
              „{revokeTarget?.name}“ funktioniert danach sofort nicht mehr. Das lässt sich nicht
              rückgängig machen – für einen neuen Zugang ein neues Token anlegen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger-600 text-white hover:bg-danger-700"
              onClick={() => revokeTarget && void revoke(revokeTarget)}
            >
              Widerrufen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
