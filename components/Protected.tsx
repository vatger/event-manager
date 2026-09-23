"use client";

import { useSession, signIn } from "next-auth/react";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function Protected({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const pathname = usePathname();

  // Die eingebetteten Ansichten laufen in einem fremden Fenster (ATCISS). Eine
  // Anmeldung brauchen sie trotzdem – sie holen sie nur selbst, mit einem
  // Fenster daneben statt einer Weiterleitung, die im iframe nur einen leeren
  // Rahmen hinterließe. Deshalb greift der Wächter hier nicht.
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
