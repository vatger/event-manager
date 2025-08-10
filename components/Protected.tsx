"use client";

import { useSession, signIn } from "next-auth/react";
import { useEffect } from "react";

export default function Protected({ children }: { children: React.ReactNode }) {
  const { status } = useSession();

  useEffect(() => {
    if (status === "unauthenticated") {
      signIn(); // Leitet automatisch zur Login-Seite weiter
    }
  }, [status]);

  if (status === "loading") return <p>Lade...</p>;
  if (status === "unauthenticated") return null;

  return <>{children}</>;
}
