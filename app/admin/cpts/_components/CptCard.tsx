"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Circle,
  GraduationCap,
  Link2,
  Loader2,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CptEntry } from "../_lib/cptTypes";
import {
  copyBannerUrlToClipboard,
  formatZulu,
  hasBanner,
  isUrgent,
  relativeDay,
  STATION_GROUP_CLASS,
  stationGroupOf,
} from "../_lib/cptUtils";

interface CptCardProps {
  cpt: CptEntry;
  canEdit: boolean;
  busy: boolean;
  onTogglePosted: () => void;
}

/**
 * Karte eines CPTs.
 *
 * Zeigt Termin, Position und die Beteiligten und trägt die beiden Handgriffe,
 * die das Eventteam wirklich braucht: gepostet markieren und – sofern es eine
 * Vorlage gibt – den Banner in die Zwischenablage legen.
 */
export function CptCard({ cpt, canEdit, busy, onTogglePosted }: CptCardProps) {
  const [copying, setCopying] = useState(false);
  const urgent = isUrgent(cpt);
  const posted = cpt.status.posted;

  const copyBanner = async () => {
    setCopying(true);
    try {
      await copyBannerUrlToClipboard(cpt);
      toast.success("Banner-Link in der Zwischenablage");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Banner-Link konnte nicht kopiert werden"
      );
    } finally {
      setCopying(false);
    }
  };

  return (
    <Card
      className={cn(
        "relative rounded-xl shadow-sm transition-all duration-300 hover:shadow-lg",
        posted
          ? "border-l-4 border-l-green-500"
          : urgent
            ? "border-l-4 border-l-red-500"
            : "border-l-4 border-l-amber-500"
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle
              className="text-lg font-semibold line-clamp-1"
              title={cpt.trainee_name}
            >
              {cpt.trainee_name}
            </CardTitle>
            <CardDescription className="mt-1 flex flex-wrap items-center gap-1">
              <Calendar className="h-4 w-4 shrink-0" />
              <span className="tabular-nums">{formatZulu(cpt.date)}</span>
              <span className="mx-1">•</span>
              <span>{relativeDay(cpt.date)}</span>
            </CardDescription>
          </div>

          <Badge
            variant={posted ? "default" : "secondary"}
            className={cn(
              "shrink-0",
              posted
                ? "bg-green-600 hover:bg-green-700"
                : urgent
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-amber-600 text-white hover:bg-amber-700"
            )}
          >
            {posted ? (
              <>
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Gepostet
              </>
            ) : urgent ? (
              <>
                <AlertTriangle className="mr-1 h-3 w-3" />
                Dringend
              </>
            ) : (
              "Offen"
            )}
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <GraduationCap className="h-4 w-4 shrink-0" />
            <span className="truncate">{cpt.course_name}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="h-4 w-4 shrink-0" />
            <span className="truncate">
              ATD {cpt.examiner_name} • Mentor {cpt.local_name}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge
              variant="outline"
              className={cn(
                "font-mono",
                STATION_GROUP_CLASS[stationGroupOf(cpt.position)]
              )}
            >
              {cpt.position}
            </Badge>
            {cpt.firCode && <Badge variant="outline">{cpt.firCode}</Badge>}
            {!cpt.confirmed && (
              <Badge variant="outline" className="text-amber-600 dark:text-amber-400">
                Unbestätigt
              </Badge>
            )}
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2 border-t pt-3">
        <Button
          size="sm"
          variant={posted ? "outline" : "default"}
          onClick={onTogglePosted}
          disabled={!canEdit || busy}
          className="flex-1 sm:flex-none"
          title={
            canEdit
              ? posted
                ? "Markierung zurücknehmen"
                : "Als im Forum gepostet markieren"
              : "Keine Berechtigung für diese FIR"
          }
        >
          {busy ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : posted ? (
            <Circle className="mr-1 h-4 w-4" />
          ) : (
            <CheckCircle2 className="mr-1 h-4 w-4" />
          )}
          {posted ? "Zurücknehmen" : "Als gepostet markieren"}
        </Button>

        {hasBanner(cpt) && (
          <Button
            size="sm"
            variant="outline"
            onClick={copyBanner}
            disabled={copying}
            className="flex-1 sm:flex-none"
          >
            {copying ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Link2 className="mr-1 h-4 w-4" />
            )}
            Banner-Link kopieren
          </Button>
        )}
      </CardFooter>

      {posted && cpt.status.postedByName && (
        <p className="px-6 pb-3 text-xs text-muted-foreground">
          Markiert von {cpt.status.postedByName}
        </p>
      )}
    </Card>
  );
}
