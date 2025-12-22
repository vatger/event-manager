"use client";

import { useSession, signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Image from "next/image";
import { Plane } from "lucide-react";
import Link from "next/link";

export default function SignInPage() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        <div className="animate-pulse">
          <Plane className="h-12 w-12 text-primary animate-bounce" />
        </div>
      </div>
    );
  }

  // If already logged in, show message with logout option
  if (session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4">
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-2xl border-0 dark:border">
          <CardHeader className="space-y-4 pb-8">
            <div className="flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg">
                <Image
                  src="/logo.png"
                  alt="VATGER Logo"
                  width={64}
                  height={64}
                  className="p-2 rounded-2xl"
                />
              </div>
            </div>
            <div className="space-y-2 text-center">
              <CardTitle className="text-2xl font-bold tracking-tight">
                Willkommen zurück
              </CardTitle>
              <CardDescription className="text-base">
                Melde dich mit deinem VATSIM Account an
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={() => signIn("vatsim", { callbackUrl: "/" })}
              className="w-full h-12 text-base font-medium shadow-md hover:shadow-lg transition-all duration-200"
              size="lg"
            >
              <Plane className="mr-2 h-5 w-5" />
              Mit VATSIM Connect anmelden
            </Button>

            <div className="pt-4 text-center">
              <p className="text-xs text-muted-foreground">
                Durch die Anmeldung stimmst du der Verwendung deiner VATSIM-Daten zu.
              </p>
            </div>
          </CardContent>
        </Card>
        
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            VATGER Eventmanager
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            © {new Date().getFullYear()} VATSIM Germany
          </p>
        </div>
      </div>
    </div>
  );
}
