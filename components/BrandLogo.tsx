import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * VATGER-Logo laut Brandbook.
 *
 * Das Brandbook gibt vier freigegebene Varianten vor und verlangt, die
 * gelieferten Assets unverändert zu verwenden – also keine Umfärbung,
 * Verzerrung, Rahmen, Schatten oder Effekte. Die Auswahl richtet sich
 * ausschließlich nach dem Hintergrund, auf dem das Logo liegt:
 *
 *  - "light" (Standard) → für weiße, secondary- und andere helle Flächen
 *  - "dark"             → für primary-farbene und andere dunkle Flächen
 *
 * Bei `variant="auto"` wird pro Theme umgeschaltet (gleiches Muster wie auf
 * branding.vatsim-germany.org): beide Dateien liegen im Markup, sichtbar ist
 * jeweils nur die passende. Das vermeidet Flackern beim Hydrieren.
 *
 * Schutzraum: rund um das Logo mindestens die Höhe (Spannweite) des
 * Flugzeug-Icons freihalten – dafür sorgt die aufrufende Stelle über
 * Abstände, nicht diese Komponente.
 */

const LOGO_SRC = {
  light: "/brand/logo_color_dark.svg",
  dark: "/brand/logo_color_light.svg",
  lightMono: "/brand/v1_vatger_logo_light_mono.svg",
  darkMono: "/brand/v1_vatger_logo_dark_mono.svg",
} as const;

// Seitenverhältnis der Originaldatei (139.38 × 55.22 mm)
const ASPECT = 139.38039 / 55.216167;

/**
 * Die gelieferten Dateien haben ihre Trägerfläche fest eingebaut: die
 * hellen Varianten secondary-50, die dunklen primary-900. Sie gehen daher
 * nur auf genau diesem Untergrund nahtlos auf. Weil die Fläche laut
 * Brandbook nicht entfernt werden darf, bekommt das Logo hier bewusst eine
 * passende Trägerfläche – dadurch wirkt sie als gestaltetes Logofeld statt
 * als sichtbarer Kasten.
 */
const PLATE_BG = {
  light: "bg-secondary-50",
  dark: "bg-primary-900",
  auto: "bg-secondary-50 dark:bg-primary-900",
} as const;

interface BrandLogoProps {
  /** Auf welchem Hintergrund liegt das Logo? "auto" schaltet per Theme um. */
  variant?: "light" | "dark" | "auto";
  /** Monochrome Fassung – laut Brandbook nur, wenn das Farblogo unpassend ist. */
  mono?: boolean;
  /** Darstellungshöhe in Pixeln; die Breite ergibt sich aus dem Seitenverhältnis. */
  height?: number;
  /**
   * Trägerfläche mitzeichnen (Standard). Nur dort abschalten, wo der
   * Untergrund bereits exakt secondary-50 bzw. primary-900 ist.
   */
  plate?: boolean;
  /**
   * Name des Dienstes, der als „/ name“ hinter dem Logo steht – so wie bei
   * den anderen VATGER-Diensten (vatger / forum, vatger / branding).
   * Der Schrägstrich trägt die Akzentfarbe.
   */
  service?: string;
  className?: string;
  priority?: boolean;
}

export function BrandLogo({
  variant = "light",
  mono = false,
  height = 32,
  plate = true,
  service,
  className,
  priority = false,
}: BrandLogoProps) {
  const width = Math.round(height * ASPECT);
  const src = (light: boolean) =>
    mono ? (light ? LOGO_SRC.lightMono : LOGO_SRC.darkMono) : light ? LOGO_SRC.light : LOGO_SRC.dark;

  const common = { width, height, priority };

  const image =
    variant === "auto" ? (
      <>
        <Image {...common} alt="VATGER" src={src(true)} className="dark:hidden" />
        <Image {...common} alt="" aria-hidden src={src(false)} className="hidden dark:block" />
      </>
    ) : (
      <Image {...common} alt="VATGER" src={src(variant === "light")} />
    );

  const logo = plate ? (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-1",
        PLATE_BG[variant],
        !service && className
      )}
    >
      {image}
    </span>
  ) : (
    <span className={cn("inline-flex", !service && className)}>{image}</span>
  );

  if (!service) return logo;

  // Dienst-Lockup: Der Schriftzug im Logo ist als Pfad hinterlegt, „/ name“
  // wird daher als echter Text in der Hausschrift ergänzt. Größe an der
  // Logohöhe ausgerichtet, damit beides auf einer Grundlinie sitzt.
  return (
    <span className={cn("inline-flex items-baseline gap-1.5", className)}>
      {logo}
      <span
        className="font-normal leading-none tracking-tight"
        style={{ fontSize: Math.round(height * 0.62) }}
      >
        <span className="text-accent-500">/</span>{" "}
        <span className="text-foreground/80">{service}</span>
      </span>
    </span>
  );
}

export default BrandLogo;
