"use client";

import { useSession, signIn } from "next-auth/react";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function Protected({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const pathname = usePathname();

  // Don't protect the sign-in page
  const isSignInPage = pathname === "/auth/signin";

  useEffect(() => {
    if (status === "unauthenticated" && !isSignInPage) {
      signIn(); // Leitet automatisch zur Login-Seite weiter
    }
  }, [status, isSignInPage]);

  if (isSignInPage) {
    return <>{children}</>;
  }

  if (status === "loading") return <p>Lade...</p>;
  if (status === "unauthenticated") return null;

  return <>{children}</>;
}
