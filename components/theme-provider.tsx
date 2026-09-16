"use client"

import * as React from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { ThemeProvider as NextThemesProvider } from "next-themes"

/**
 * Eingebettete Ansichten dürfen ihr Aussehen mitgeben: `/embed/...?theme=dark`
 * passt den Plan an die einbettende Oberfläche an.
 *
 * Erzwungen statt gesetzt – ein `setTheme` würde in der Ablage des Browsers
 * landen und damit die Wahl des Nutzers für den ganzen Eventmanager
 * umstellen, nur weil irgendwo ein dunkles iframe hing.
 */
function useForcedTheme(): string | undefined {
  const pathname = usePathname()
  const params = useSearchParams()
  if (!pathname?.startsWith("/embed")) return undefined
  const theme = params.get("theme")
  return theme === "dark" || theme === "light" ? theme : undefined
}

function ThemeProviderInner({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  const forcedTheme = useForcedTheme()
  return (
    <NextThemesProvider {...props} forcedTheme={forcedTheme}>
      {children}
    </NextThemesProvider>
  )
}

export function ThemeProvider(props: React.ComponentProps<typeof NextThemesProvider>) {
  // useSearchParams verlangt eine Suspense-Grenze, sonst fällt die ganze Seite
  // aus dem statischen Rendering.
  return (
    <React.Suspense fallback={<NextThemesProvider {...props} />}>
      <ThemeProviderInner {...props} />
    </React.Suspense>
  )
}
