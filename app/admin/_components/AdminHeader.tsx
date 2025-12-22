"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "next-auth/react";
import NotificationsWidget from "@/components/notifs/NotificationsWidget";
import { useEffect, useState } from "react";
import { firApi } from "@/lib/api/fir";
import { CurrentUser } from "@/types/fir";
import { LogOut, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getAvatarColor } from "@/utils/getAvatarColor";

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

  // Avatar mit Initialen erstellen
  const getInitials = () => {
    if (!currentUser?.name) return "A";
    const names = currentUser.name.split(' ');
    const firstInitial = names[0]?.charAt(0) || '';
    const lastInitial = names[1]?.charAt(0) || '';
    return `${firstInitial}${lastInitial}`.toUpperCase();
  };

  // Badge Color basierend auf User Level
  const getLevelBadgeColor = (level: string) => {
    const levelColors: Record<string, string> = {
      'FIR_EVENTLEITER': 'bg-purple-100 text-purple-800 border-purple-200',
      'MAIN_ADMIN': 'bg-red-100 text-red-800 border-red-200',
      'VATGER_LEITUNG': 'bg-blue-100 text-blue-800 border-blue-200',
      'USER': 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return levelColors[level] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  return (
    <header className="flex h-18 shrink-0 items-center gap-2 border-b bg-background px-4 lg:px-6">
      <SidebarTrigger className="-ml-1" />
      <div className="flex flex-1 items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        <div className="flex items-center gap-3">
          <NotificationsWidget />
          {currentUser && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="h-10 px-3 rounded-full hover:bg-accent transition-colors duration-200 group"
                >
                  <div className="flex items-center gap-3">
                    {/* Avatar Circle */}
                    <div className={`flex items-center justify-center h-8 w-8 rounded-full ${getAvatarColor(currentUser.name)} text-white font-semibold text-sm shadow-sm`}>
                      {getInitials()}
                    </div>
                    
                    {/* User Info - nur auf Desktop */}
                    <div className="hidden md:flex flex-col items-start max-w-32">
                      <span className="text-sm font-medium text-foreground leading-none truncate">
                        {currentUser.name?.split(' ')[0] || "Admin"}
                      </span>
                      <span className="text-xs text-muted-foreground leading-none mt-0.5 truncate">
                      {currentUser.effectiveLevel == "USER" ? "EVENTLER" : currentUser.effectiveLevel}
                      </span>
                    </div>
                    
                    {/* Chevron Icon */}
                    <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="end" 
                className="w-72 rounded-xl shadow-lg border p-2"
              >
                {/* User Info Section */}
                <div className="flex items-center gap-3 px-3 py-3 rounded-lg bg-muted mb-2">
                  <div className={`flex items-center justify-center h-12 w-12 rounded-full ${getAvatarColor(currentUser.name)} text-white font-semibold text-base shadow-sm`}>
                    {getInitials()}
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate capitalize">
                        {currentUser.name || "User N/A"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {currentUser.rating} • {currentUser.fir ? ("FIR: " + currentUser.fir.code) : "VATSIM Germany"}
                      </p>
                      <Badge 
                        variant="secondary" 
                        className={`mt-2 text-xs ${getLevelBadgeColor(currentUser.effectiveLevel)}`}
                      >
                        {currentUser.effectiveLevel == "USER" ? "EVENTLER" : currentUser.effectiveLevel}
                      </Badge>
                  </div>
                </div>

                <DropdownMenuSeparator />

                {/* Sign Out */}
                <DropdownMenuItem 
                  onClick={() => signOut()}
                  className="px-3 py-2.5 rounded-lg cursor-pointer text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400 focus:bg-red-50 dark:focus:bg-red-950"
                >
                  <LogOut className="w-4 h-4 mr-3" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">Abmelden</span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}