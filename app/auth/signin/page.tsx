"use client";

import { useSession, signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Image from "next/image";
import { CodesandboxIcon, LogInIcon, Plane } from "lucide-react";
import Link from "next/link";

export default function SignInPage() {
  const { data: session, status } = useSession();
  const isDevMode = process.env.NEXT_PUBLIC_DEV_MODE === "true";


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
          <CardHeader className="space-y-4 pb-2">
            <div className="flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-900 shadow-lg">
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
                Melde dich beim VATGER Eventmanager an
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isDevMode && (
              <Button 
              onClick={() => signIn("vatsim-sandbox", { callbackUrl: "/" })}
              className="
                w-full h-12
                bg-blue-900
                text-white
                transition-all duration-400
                dark:hover:text-black
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
                bg-blue-900
                text-white
                transition-all duration-400
                dark:hover:text-black
              "
              size="lg"
            >
              <LogInIcon className="mr-2 h-5 w-5" />
              Mit VATGER Connect anmelden
            </Button>
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
