"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, MapPin, Repeat, Users } from "lucide-react";
import Link from "next/link";
import EventBanner from "@/components/Eventbanner";
import { weeklyAirportList, weeklyPatternShort, WEEKDAYS_SHORT } from "@/lib/weeklys/publicDisplay";

interface FIR {
  code: string;
  name: string;
}

interface WeeklyConfig {
  id: number;
  firId: number | null;
  fir?: FIR;
  name: string;
  weekday: number;
  weeksOn: number;
  weeksOff: number;
  startDate: string;
  airports?: string[];
  startTime?: string;
  endTime?: string;
  description?: string;
  bannerUrl?: string | null;
  requiresRoster?: boolean;
  staffedStations?: string[];
  enabled: boolean;
}

interface WeeklyCardProps {
  config: WeeklyConfig;
  /**
   * true  → grosse Karte mit Banner
   * false → kompakte Zeile mit Rhythmus-Block (FIR-Übersicht, viele Weeklys untereinander)
   */
  showBanner?: boolean;
}

export default function WeeklyCard({ config, showBanner = false }: WeeklyCardProps) {
  const airportList = weeklyAirportList(config.airports);
  const airports = airportList.join(", ");
  const pattern = weeklyPatternShort(config.weekday, config.weeksOff);
  const timeLabel =
    config.startTime || config.endTime
      ? `${config.startTime ?? "?"} – ${config.endTime ?? "?"} lcl`
      : null;

  const badges = (
    <>
      <Badge className="bg-primary-100 font-medium text-primary-700 dark:bg-primary-900/50 dark:text-primary-200">
        {pattern}
      </Badge>
      {config.requiresRoster && (
        <Badge variant="secondary" className="font-semibold">
          <Users className="h-3 w-3" />
          Roster
        </Badge>
      )}
    </>
  );

  // =========================================================================
  // Kompakte Zeile: Rhythmus-Block links, Details rechts. Für Listen, in
  // denen viele Weeklys untereinander stehen.
  // =========================================================================
  if (!showBanner) {
    return (
      <div className="flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-shadow duration-200 hover:shadow-lg">
        <div className="flex gap-4 p-5 pb-4">
          <div className="flex h-[72px] w-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-[10px] bg-primary-900">
            <Repeat className="h-4 w-4 text-accent-500" />
            <span className="mt-1 text-[19px] font-bold leading-none text-secondary-50">
              {WEEKDAYS_SHORT[config.weekday]}
            </span>
            <span className="text-[10px] font-medium text-secondary-300">
              {config.weeksOff === 0 ? "wöchentlich" : `${config.weeksOn}/${config.weeksOn + config.weeksOff}`}
            </span>
          </div>

          <div className="flex min-w-0 flex-grow flex-col gap-1.5">
            <h3 className="text-[17px] font-semibold leading-snug text-pretty text-foreground">
              {config.name}
            </h3>

            <div className="flex min-w-0 items-center gap-2 text-[13px] text-muted-foreground">
              {timeLabel && <span className="shrink-0 font-semibold tabular-nums text-foreground">{timeLabel}</span>}
              {timeLabel && airports && (
                <span className="h-[3px] w-[3px] shrink-0 rounded-full bg-secondary-300" />
              )}
              {airports && (
                <span className="truncate" title={airports}>
                  {airports}
                </span>
              )}
            </div>

            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              {badges}
              <Badge variant="secondary" className="font-semibold">
                {config.fir?.code}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t bg-muted/40 px-5 py-3">
          {config.description ? (
            <span className="min-w-0 truncate text-[13px] text-muted-foreground" title={config.description}>
              {config.description}
            </span>
          ) : (
            <span />
          )}
          <Link
            href={`/weeklys/${config.id}`}
            className="ml-auto flex shrink-0 items-center gap-1.5 text-[13px] font-semibold text-accent-600 transition-colors hover:text-accent-700 dark:text-accent-500 dark:hover:text-accent-400"
          >
            Details ansehen
            <ArrowRight className="h-[15px] w-[15px]" />
          </Link>
        </div>
      </div>
    );
  }

  // =========================================================================
  // Grosse Karte: Titel und Rhythmus liegen auf dem Banner, darunter eine
  // schmale Leiste mit Handlung.
  // =========================================================================
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-shadow duration-200 hover:shadow-lg">
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-primary-900">
        <EventBanner
          bannerUrl={config.bannerUrl ?? ""}
          eventName={config.name}
          className="absolute inset-0 h-full w-full object-cover"
          // Titel und Rhythmus liegen hier selbst auf dem Banner
          showFallbackCaption={false}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-primary-900 via-primary-900/55 to-transparent" />

        <div className="absolute left-4 top-3.5 flex flex-wrap items-center gap-1.5">
          {badges}
        </div>

        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 px-5 pb-[18px] pt-4">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-accent-500">
            {pattern}
            {timeLabel ? ` · ${timeLabel}` : ""}
          </span>
          <h3 className="text-[22px] font-bold leading-tight text-pretty text-secondary-50">
            {config.name}
          </h3>
          {airports && (
            <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-secondary-300">
              <MapPin className="h-[14px] w-[14px] shrink-0" />
              <span className="truncate" title={airports}>
                {airports}
              </span>
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3.5">
        <Badge variant="secondary" className="font-semibold">
          {config.fir?.code}
        </Badge>
        <Button asChild size="sm" className="ml-auto h-9 shrink-0 px-4">
          <Link href={`/weeklys/${config.id}`}>
            Details ansehen
            <ArrowRight className="h-[15px] w-[15px]" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
