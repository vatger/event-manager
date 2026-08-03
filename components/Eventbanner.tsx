import { Plane } from 'lucide-react';
import React, { useState } from 'react'

/**
 * Event-Banner mit Ersatzdarstellung.
 *
 * Fehlt ein Banner oder lässt er sich nicht laden, tritt eine gestaltete
 * Markenfläche an seine Stelle: dunkles primary-900 mit feinem Raster (wie
 * die Live-Map auf vatsim-germany.org) und dem Markenakzent als Signal.
 * Bewusst in beiden Themes gleich dunkel, damit Event-Kacheln ein ruhiges,
 * einheitliches Raster ergeben.
 */
function EventBanner({ bannerUrl, eventName, className = "" }: {
    bannerUrl: string;
    eventName: string;
    className?: string;
  }) {
    const [imgError, setImgError] = useState(false);

    if (imgError || !bannerUrl) {
      return (
        <div
          className={`surface-brand relative flex items-center justify-center overflow-hidden aspect-video ${className}`}
        >
          {/* Rastertextur */}
          <div className="surface-brand-grid absolute inset-0 opacity-70" aria-hidden />
          {/* Akzent-Schimmer aus der oberen Ecke */}
          <div
            className="absolute -left-8 -top-10 h-32 w-52 rounded-full blur-3xl opacity-25"
            style={{ background: "var(--color-accent-500)" }}
            aria-hidden
          />
          <div className="relative px-4 text-center">
            <Plane className="mx-auto mb-2 h-7 w-7 text-accent-500" aria-hidden />
            <p className="font-semibold leading-tight text-secondary-50">{eventName}</p>
            <p className="eyebrow mt-1">Demnächst</p>
          </div>
        </div>
      );
    }

    return (
      <div className={`overflow-hidden ${className} aspect-video`}>
        <img
          src={bannerUrl}
          className="w-full h-full object-cover"
          alt={`${eventName} Banner`}
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

export default EventBanner
