// components/AdminHeader.tsx
"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "next-auth/react";
import NotificationsWidget from "@/components/NotificationsWidget";
import { useEffect, useState } from "react";
import { firApi } from "@/lib/api/fir";
import { CurrentUser } from "@/types/fir";
import { LogOut, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface AdminHeaderProps {
  title: string;
  user: {
    name: string;
    cid: string;
  };
}

export function AdminHeader({ title, user }: AdminHeaderProps) {
    const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

    useEffect(() => {
      firApi.getCurrentUser().then(setCurrentUser).catch(console.error);
    }, []);
  
    return (
    <header className="flex h-18 shrink-0 items-center gap-2 border-b bg-background px-4 lg:px-6">
      <SidebarTrigger className="-ml-1" />
      <div className="flex flex-1 items-center justify-between">
        <h1 className="text-lg font-semibold">{title}</h1>
        <div className="flex items-center gap-2">
          <NotificationsWidget />
          {currentUser && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    <span>{currentUser.name}</span>
                    <Badge variant="secondary">{currentUser.effectiveLevel}</Badge>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>
                    <div className="flex flex-col">
                      <span>{currentUser.name}</span>
                      <span className="text-xs text-muted-foreground">
                        CID: {currentUser.cid}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Rating: {currentUser.rating}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        FIR: {currentUser.fir?.code}
                      </span>
                      
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut()}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Abmelden
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
        </div>
      </div>
    </header>
  );
}