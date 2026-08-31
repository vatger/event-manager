"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check, Clock, MapPin, Users } from "lucide-react";
import Link from "next/link";
import EventBanner from "@/components/Eventbanner";
import { Event } from "@/types";
import { CanControlIcon } from "./CanControlIcon";
import { getRatingValue } from "@/utils/ratingToValue";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";

interface EventCardProps {
  event: Event;
  /**
   * true  → grosse Karte mit Banner (Startseite: "Deine Events", "Controlleranmeldungen")
   * false → kompakte Zeile mit Datumsblock (FIR-Übersicht, viele Events untereinander)
   */
  showBanner: boolean;
}

/** Statusfarben aus den Markenskalen, je mit eigener Fassung für den Dark Mode. */
const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  SIGNUP_OPEN: {
    label: "Anmeldung offen",
    className: "bg-success-100 text-success-800 dark:bg-success-900/40 dark:text-success-300",
  },
  SIGNUP_CLOSED: {
    label: "Anmeldung geschlossen",
    className: "bg-secondary-100 text-secondary-700 dark:bg-secondary-800 dark:text-secondary-300",
  },
  PLANNING: {
    label: "Geplant",
    className: "bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-200",
  },
  ROSTER_PUBLISHED: {
    label: "Besetzungsplan online",
    className: "bg-primary-900 text-secondary-50 dark:bg-secondary-50 dark:text-secondary-900",
  },
  CANCELLED: {
    label: "Abgesagt",
    className: "bg-danger-100 text-danger-900 dark:bg-danger-900/50 dark:text-danger-200",
  },
};

/** "18 Okt 2026" – ohne die Abkürzungspunkte, die de-DE sonst setzt. */
function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
    .format(d)
    .replace(/\./g, "");
}

/** Zulu-Uhrzeit im Stil der übrigen Ansichten: "1800z" */
function formatZulu(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}z`;
}

function formatMonth(d: Date): string {
  return new Intl.DateTimeFormat("de-DE", { month: "short", timeZone: "UTC" })
    .format(d)
    .replace(/\./g, "");
}

function formatWeekday(d: Date): string {
  return new Intl.DateTimeFormat("de-DE", { weekday: "long", timeZone: "UTC" }).format(d);
}

export default function EventCard({ event, showBanner }: EventCardProps) {
  const { data: session } = useSession();

  const start = new Date(event.startTime);
  const end = new Date(event.endTime);
  const airports = Array.isArray(event.airports) ? event.airports.join(", ") : event.airports;

  const status = STATUS_CONFIG[event.status] ?? {
    label: event.status,
    className: "bg-secondary-100 text-secondary-700 dark:bg-secondary-800 dark:text-secondary-300",
  };

  const signupOpen = event.status === "SIGNUP_OPEN";
  const signedUp = event.isSignedUp === true;
  const registrationLabel = `${event.registrations} ${event.registrations === 1 ? "Anmeldung" : "Anmeldungen"}`;

  const controlIcon = signupOpen ? (
    <CanControlIcon
      params={{
        user: {
          userCID: Number(session?.user?.cid),
          rating: getRatingValue(session?.user?.rating || "OBS"),
        },
        event: {
          airport: Array.isArray(event.airports) ? event.airports : [event.airports],
          fir: event.firCode,
        },
      }}
    />
  ) : null;

  // =========================================================================
  // Kompakte Zeile: Datumsblock links, Details rechts. Für Listen, in denen
  // viele Events untereinander stehen – der Termin ist hier der Ankerpunkt.
  // =========================================================================
  if (!showBanner) {
    return (
      <div className="flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-shadow duration-200 hover:shadow-lg">
        <div className="flex gap-4 p-5 pb-4">
          <div className="flex h-[72px] w-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-[10px] bg-primary-900">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-accent-500">
              {formatMonth(start)}
            </span>
            <span className="text-[26px] font-bold leading-none tabular-nums text-secondary-50">
              {start.getUTCDate()}
            </span>
            <span className="text-[11px] font-medium text-secondary-300">
              {formatWeekday(start)}
            </span>
          </div>

          <div className="flex min-w-0 flex-grow flex-col gap-1.5">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-[17px] font-semibold leading-snug text-pretty text-foreground">
                {event.name}
              </h3>
              {controlIcon}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
              <span className="font-semibold tabular-nums text-foreground">
                {formatZulu(start)} – {formatZulu(end)}
              </span>
              <span className="h-[3px] w-[3px] shrink-0 rounded-full bg-secondary-300" />
              <span className="min-w-0 break-words">{airports}</span>
            </div>

            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <Badge className={cn("font-medium", status.className)}>{status.label}</Badge>
              <Badge variant="secondary" className="font-semibold">
                {event.firCode}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t bg-muted/40 px-5 py-3">
          <span className="flex items-center gap-1.5 whitespace-nowrap text-[13px] text-muted-foreground">
            <Users className="h-[15px] w-[15px] shrink-0" />
            {registrationLabel}
            {signedUp && (
              <span className="ml-1 flex items-center gap-1 font-semibold text-success-800 dark:text-success-300">
                <Check className="h-[14px] w-[14px]" />
                dabei
              </span>
            )}
          </span>
          <Link
            href={`/events/${event.id}`}
            className="ml-auto flex shrink-0 items-center gap-1.5 text-[13px] font-semibold text-accent-600 transition-colors hover:text-accent-700 dark:text-accent-500 dark:hover:text-accent-400"
          >
            Zum Event
            <ArrowRight className="h-[15px] w-[15px]" />
          </Link>
        </div>
      </div>
    );
  }

  // =========================================================================
  // Grosse Karte: Titel und Termin liegen auf dem Banner, darunter eine
  // schmale Leiste mit Anmeldungen und Handlung.
  // =========================================================================
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-shadow duration-200 hover:shadow-lg">
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-primary-900">
        <EventBanner
          bannerUrl={event.bannerUrl}
          eventName={event.name}
          className="absolute inset-0 h-full w-full object-cover"
          // Titel und Termin liegen hier selbst auf dem Banner
          showFallbackCaption={false}
        />
        {/* Abdunklung, damit die Schrift auf jedem Banner lesbar bleibt */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-primary-900 via-primary-900/55 to-transparent" />

        <div className="absolute left-4 top-3.5 flex flex-wrap items-center gap-1.5">
          <Badge className={cn("font-medium", status.className)}>{status.label}</Badge>
          <Badge className="bg-secondary-50/15 font-semibold text-secondary-50 backdrop-blur-sm">
            {event.firCode}
          </Badge>
        </div>

        {controlIcon && <div className="absolute right-4 top-3.5">{controlIcon}</div>}

        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 px-5 pb-[18px] pt-4">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-accent-500">
            {formatDate(start)} · {formatZulu(start)} – {formatZulu(end)}
          </span>
          <h3 className="text-[22px] font-bold leading-tight text-pretty text-secondary-50">
            {event.name}
          </h3>
          <span className="flex items-start gap-1.5 text-[13px] text-secondary-300">
            <MapPin className="mt-px h-[14px] w-[14px] shrink-0" />
            <span className="min-w-0 break-words">{airports}</span>
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3.5">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-x-1.5 whitespace-nowrap text-[13px] font-semibold text-foreground">
            <Users className="h-[15px] w-[15px] shrink-0 text-muted-foreground" />
            {registrationLabel}
            {signedUp && (
              <span className="flex items-center gap-1 text-success-800 dark:text-success-300">
                <Check className="h-[14px] w-[14px]" />
                dabei
              </span>
            )}
          </span>
          {signupOpen && event.signupDeadline && (
            <span className="flex items-center gap-1.5 pl-[21px] text-xs text-muted-foreground">
              <Clock className="h-3 w-3 shrink-0" />
              noch bis {formatDate(new Date(event.signupDeadline))}
            </span>
          )}
        </div>

        <Button asChild size="sm" className="ml-auto h-9 shrink-0 px-4">
          <Link href={`/events/${event.id}`}>
            Zum Event
            <ArrowRight className="h-[15px] w-[15px]" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
