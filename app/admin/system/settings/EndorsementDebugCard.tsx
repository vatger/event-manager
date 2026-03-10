"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Search, CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react";
import { getBadgeClassForEndorsement } from "@/utils/EndorsementBadge";

interface LevelEvaluation {
  level: string;
  allowed: boolean;
  restrictions: string[];
  blockReasons: string[];
}

interface DebugResult {
  user: {
    cid: number;
    name: string | null;
    rating: string | null;
    ratingValue: number;
  };
  policy: {
    airport: string;
    fir?: string;
    isTier1: boolean;
    requiresAfis: boolean;
    s1TwrAllowed: boolean;
    s1TheoryMaxLevel?: string;
    tier1RequiredFrom?: string;
  };
  result: {
    maxAllowedGroup: "GND" | "TWR" | "APP" | "CTR" | null;
    restrictions: string[];
    reasonsPerLevel: LevelEvaluation[];
  };
}

export default function EndorsementDebugCard() {
  const [cid, setCid] = useState("");
  const [airport, setAirport] = useState("");
  const [fir, setFir] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DebugResult | null>(null);

  const handleLookup = async () => {
    const cidNum = parseInt(cid.trim(), 10);
    if (!Number.isInteger(cidNum) || cidNum <= 0) {
      setError("Bitte eine gültige CID eingeben");
      return;
    }
    if (!airport.trim()) {
      setError("Bitte einen Airport-Code eingeben (z.B. EDDM)");
      return;
    }

    setLoading(true);
    setError(null);
    setData(null);

    try {
      const res = await fetch("/api/admin/system/endorsement-debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cid: cidNum,
          airport: airport.trim(),
          fir: fir.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Unbekannter Fehler");
        return;
      }

      setData(json as DebugResult);
    } catch {
      setError("Netzwerkfehler – bitte erneut versuchen");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleLookup();
  };

  return (
    <Card className="shadow-sm border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="w-5 h-5" />
          Endorsement Debug
        </CardTitle>
        <CardDescription>
          Vollständige Eligibility-Auswertung für eine CID und einen Airport – inklusive
          Reasons per Level für die Fehlersuche im Livebetrieb.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Input row */}
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex flex-col gap-1">
            <Label htmlFor="debug-cid" className="text-xs text-muted-foreground">
              CID
            </Label>
            <Input
              id="debug-cid"
              placeholder="z.B. 1234567"
              value={cid}
              onChange={(e) => setCid(e.target.value)}
              onKeyDown={handleKeyDown}
              type="number"
              className="w-36"
              disabled={loading}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="debug-airport" className="text-xs text-muted-foreground">
              Airport (ICAO)
            </Label>
            <Input
              id="debug-airport"
              placeholder="z.B. EDDM"
              value={airport}
              onChange={(e) => setAirport(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              maxLength={4}
              className="w-28"
              disabled={loading}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="debug-fir" className="text-xs text-muted-foreground">
              FIR (optional)
            </Label>
            <Input
              id="debug-fir"
              placeholder="z.B. EDMM"
              value={fir}
              onChange={(e) => setFir(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              maxLength={4}
              className="w-28"
              disabled={loading}
            />
          </div>
          <Button onClick={handleLookup} disabled={loading || !cid || !airport}>
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Search className="w-4 h-4 mr-2" />
            )}
            Abfragen
          </Button>
        </div>

        {/* Error */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Results */}
        {data && (
          <div className="space-y-4 pt-2">
            {/* User + result summary */}
            <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">
                  {data.user.name ?? <span className="italic text-muted-foreground">Unbekannt</span>}
                  <span className="text-muted-foreground text-sm ml-2">({data.user.cid})</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Rating: {data.user.rating ?? "–"} (Wert: {data.user.ratingValue}) ·{" "}
                  {data.policy.airport}
                  {data.policy.fir ? ` / ${data.policy.fir}` : ""}
                  {data.policy.isTier1 ? " · T1" : ""}
                  {data.policy.requiresAfis ? " · AFIS" : ""}
                  {data.policy.s1TwrAllowed ? " · S1-TWR" : ""}
                </p>
              </div>
              <div>
                {data.result.maxAllowedGroup ? (
                  <Badge className={getBadgeClassForEndorsement(data.result.maxAllowedGroup)}>
                    {data.result.maxAllowedGroup}
                  </Badge>
                ) : (
                  <Badge variant="destructive">Keine Berechtigung</Badge>
                )}
              </div>
            </div>

            {/* Restrictions */}
            {data.result.restrictions.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Restrictions
                </p>
                {data.result.restrictions.map((r, i) => (
                  <p key={i} className="text-xs text-amber-600">
                    • {r}
                  </p>
                ))}
              </div>
            )}

            {/* Reasons per level */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Reasons per Level
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Level</TableHead>
                    <TableHead className="w-24">Status</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.result.reasonsPerLevel.map((lv) => (
                    <TableRow key={lv.level}>
                      <TableCell className="font-mono font-medium">{lv.level}</TableCell>
                      <TableCell>
                        {lv.allowed ? (
                          <span className="flex items-center gap-1 text-green-600 text-xs">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Erlaubt
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-600 text-xs">
                            <XCircle className="w-3.5 h-3.5" />
                            Blockiert
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground space-y-0.5">
                        {lv.blockReasons.map((r, i) => (
                          <p key={i} className="text-red-600">
                            ✗ {r}
                          </p>
                        ))}
                        {lv.restrictions.map((r, i) => (
                          <p key={i} className="text-amber-600">
                            ⚠ {r}
                          </p>
                        ))}
                        {lv.allowed && lv.restrictions.length === 0 && (
                          <p className="text-green-600">–</p>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
