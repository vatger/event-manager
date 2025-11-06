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
import { Menu } from "lucide-react";
import { useUser } from "@/hooks/useUser";

export default function Header() {
  const { data: session } = useSession();
  const { hasAdminAcess } = useUser()

  return (
    <header className="w-full flex justify-between items-center p-4 border-b">
      <Link href="/">
      <div className="flex items-center gap-2 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-900">
            <img src="logo.png" alt="Logo" className="p-1 m-2"/>
          </div>
          <div className="flex flex-col">
            <span className="font-bold">Eventmanager</span>
            <span className="text-xs text-muted-foreground">VATSIM Germany</span>
          </div>
        </div>
        </Link>

      {session && (
        <div>
          {/* Desktop Version */}
          <div className="hidden md:flex items-center gap-2">
          <NotificationsWidget />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="capitalize">
                {session.user?.name || "User N/A"} {'(' + session.user?.rating + ')'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {hasAdminAcess() && (
                <DropdownMenuItem>
                  <Link href="/admin/events" className="w-full">Admin</Link>
                </DropdownMenuItem>
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

        {/* Mobile Version */}
        <div className="flex md:hidden items-center gap-2">
          <NotificationsWidget />
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <div className="px-2 py-1.5 text-sm font-semibold border-b">
                {session.user?.name || "User N/A"} - {session.user?.rating}
              </div>
              
              {(session.user.role == "ADMIN" || session.user.role == "MAIN_ADMIN") && (
                <DropdownMenuItem>
                  <Link href="/admin" className="w-full">Admin</Link>
                </DropdownMenuItem>
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
      </div>
      )}
    </header>
  );
}
