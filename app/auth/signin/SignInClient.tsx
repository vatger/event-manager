"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandLogo } from "@/components/BrandLogo";
import { CodesandboxIcon, LogInIcon } from "lucide-react";
import Link from "next/link";
import { Session } from "next-auth";

export interface LocalTestLogin {
  cid: number;
  name: string;
  rating: string;
  role?: string;
}

interface SignInClientProps {
  session: Session | null;
  isDevMode: boolean;
  /** Nur im lokalen Testmodus: alle Nutzer, als die man sich anmelden kann */
  localTestLogins?: LocalTestLogin[] | null;
}

export default function SignInClient({ session, isDevMode, localTestLogins }: SignInClientProps) {
  // Wenn bereits angemeldet
  if (session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="shadow-2xl border-0 dark:border max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Bereits angemeldet</CardTitle>
            <CardDescription>
              Du bist als {session.user?.name} angemeldet
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              asChild
              className="w-full"
              size="lg"
            >
              <Link href="/">Zur Startseite</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-2xl border-0 dark:border">
          <CardHeader className="space-y-4 pb-2">
            <div className="flex justify-center py-2">
              <BrandLogo variant="auto" height={56} priority />
            </div>
            <div className="space-y-2 text-center">
              <CardTitle className="text-2xl font-semibold tracking-tight">
                Willkommen zurück
              </CardTitle>
              <CardDescription className="text-base">
                Melde dich beim VATGER Eventmanager an
              </CardDescription>
            </div>
          </CardHeader>
          {localTestLogins ? (
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Lokaler Testmodus – als Testnutzer anmelden:
            </p>
            <div className="max-h-[60vh] overflow-y-auto divide-y rounded-md border">
              {localTestLogins.map((u) => (
                <button
                  key={u.cid}
                  type="button"
                  onClick={() => signIn("local-test", { cid: String(u.cid), callbackUrl: "/" })}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  <span>
                    {u.name}
                    {u.role && <span className="text-muted-foreground"> · {u.role}</span>}
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {u.rating} · {u.cid}
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
          ) : (
          <CardContent className="space-y-4">
            {isDevMode && (
              <Button 
                onClick={() => signIn("vatsim-sandbox", { callbackUrl: "/" })}
                variant="outline"
                className="
                  w-full h-12
                  transition-all duration-200
                "
                size="lg"
              >
                <CodesandboxIcon className="mr-2 h-5 w-5" />
                Mit VATSIM Sandbox anmelden
              </Button>
            )}
            <Button 
              onClick={() => signIn("vatsim", { callbackUrl: "/" })}
              className="
                w-full h-12
                transition-all duration-200
              "
              size="lg"
            >
              <LogInIcon className="mr-2 h-5 w-5" />
              Mit VATGER Connect anmelden
            </Button>
          </CardContent>
          )}
        </Card>
        
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            VATGER Eventmanager
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            © {new Date().getFullYear()} VATGER
          </p>
        </div>
      </div>
    </div>
  );
}