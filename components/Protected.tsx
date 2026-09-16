"use client";

import { useSession, signIn } from "next-auth/react";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function Protected({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const pathname = usePathname();

  // Ohne Anmeldung erreichbar: die Anmeldeseite selbst und die eingebetteten
  // Ansichten. Letztere laufen in einem fremden Fenster (ATCISS) – ein
  // Weiterleiten zum Login würde dort nur ein leeres iframe hinterlassen.
  const isPublicPage =
    pathname === "/auth/signin" || pathname.startsWith("/embed");

  useEffect(() => {
    if (status === "unauthenticated" && !isPublicPage) {
      signIn(); // Leitet automatisch zur Login-Seite weiter
    }
  }, [status, isPublicPage]);

  if (isPublicPage) {
    return <>{children}</>;
  }

  if (status === "loading") return <p>Lade...</p>;
  if (status === "unauthenticated") return null;

  return <>{children}</>;
}
