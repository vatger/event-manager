"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export default function SignInPage() {
  const { data: session, status } = useSession();

  if (status === "loading") return <p>Lade...</p>;

  if (session) {
    return (
      <div>
        <p>Angemeldet als {session.user?.name}</p>
        <Button onClick={() => signOut()}>Logout</Button>
      </div>
    );
  }

  return (
    <div>
      <h1>Bitte anmelden</h1>
      <Button onClick={() => signIn("vatsim")}>Mit VATSIM Connect anmelden</Button>
    </div>
  );
}
