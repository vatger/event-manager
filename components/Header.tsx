"use client";

import { useSession, signOut } from "next-auth/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import NotificationsWidget from "./NotificationsWidget";
import Link from "next/link";

export default function Header() {
  const { data: session } = useSession();

  return (
    <header className="w-full flex justify-between items-center p-4 border-b">
      <div className="text-lg font-bold"><Link href="/">Eventmanager</Link></div>

      {session ? (
        <div className="flex items-center gap-2">
          <NotificationsWidget />
          <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="capitalize">
              {session.user?.name || "User"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            {session.user?.role == "ADMIN" || session.user.role == "MAIN_ADMIN" && (
              <DropdownMenuItem><Link href="/admin" className="w-full">Admin</Link></DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() => {
                signOut();
              }}
            >
              Abmelden
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      ) : (
        <div>
          {/* Optional: Login Button oder leer lassen */}
        </div>
      )}
    </header>
  );
}
