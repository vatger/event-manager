"use client";

import { useSession, signOut } from "next-auth/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import NotificationsWidget from "./notifs/NotificationsWidget";
import Link from "next/link";
import Image from "next/image";
import { LogOut, Shield, ChevronDown, CalendarRange } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { getAvatarColor } from "@/utils/getAvatarColor";

export default function Header() {
  const { data: session } = useSession();
  const { hasAdminAcess } = useUser();

  // Avatar mit Initialen erstellen
  const getInitials = () => {
    if (!session?.user?.name) return "N";
    const names = session.user.name.split(' ');
    const firstInitial = names[0]?.charAt(0) || '';
    const lastInitial = names[1]?.charAt(0) || '';
    return `${firstInitial}${lastInitial}`.toUpperCase();
  };

  
  return (
    <header className="w-full border-b bg-white/95 backdrop-blur-sm supports-[backdrop-filter]:bg-white/60">
      <div className="px-4 sm:px-6">
        <div className="flex justify-between items-center h-16">
          {/* Logo Bereich - unverändert */}
          <Link href="/">
            <div className="flex items-center gap-3 px-2 hover:bg-gray-50 rounded-lg transition-colors duration-200">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-900 shadow-sm">
              <Image
                src="/logo.png"
                alt="Logo"
                width={40}
                height={40}
                className="p-1 m-2 rounded-lg"
              />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-gray-900 tracking-tight">Eventmanager</span>
                <span className="text-xs text-gray-500">VATSIM Germany</span>
              </div>
            </div>
          </Link>

          {session && (
            <div className="flex items-center gap-4">
              {/* Desktop Version */}
              <div className="hidden md:flex items-center gap-3">
                {/* Notifications */}
                <div className="relative">
                  <NotificationsWidget />
                </div>
                
                {/* User Profile Dropdown mit Avatar */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      className="h-10 px-3 rounded-full hover:bg-gray-100 transition-colors duration-200 group"
                    >
                      <div className="flex items-center gap-3">
                        {/* Avatar Circle */}
                        <div className={`flex items-center justify-center h-8 w-8 rounded-full ${getAvatarColor(session.user.name)} text-white font-semibold text-sm shadow-sm`}>
                          {getInitials()}
                        </div>
                        
                        {/* User Info */}
                        <div className="flex flex-col items-start max-w-32">
                          <span className="text-sm font-medium text-gray-900 leading-none truncate">
                            {session.user?.name?.split(' ')[0] || "User"}
                          </span>
                          <span className="text-xs text-gray-500 leading-none mt-0.5 truncate">
                            {session.user?.rating}
                          </span>
                        </div>
                        
                        {/* Chevron Icon */}
                        <ChevronDown className="w-4 h-4 text-gray-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    align="end" 
                    className="w-64 rounded-xl shadow-lg border border-gray-200 p-2"
                  >
                    {/* User Info Section */}
                    <div className="flex items-center gap-3 px-3 py-3 rounded-lg bg-gray-50 mb-2">
                      <div className={`flex items-center justify-center h-10 w-10 rounded-full ${getAvatarColor(session.user.name)} text-white font-semibold text-sm shadow-sm`}>
                        {getInitials()}
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 truncate capitalize">
                          {session.user?.name || "User N/A"}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                        {session.user?.rating} • {session.user.fir ? ("FIR: " + session.user.fir) : "VATSIM Germany"}
                        </p>
                      </div>
                    </div>

                    <DropdownMenuSeparator />

                    {/* Admin Link */}
                    {hasAdminAcess() && (
                      <DropdownMenuItem asChild className="px-3 py-2.5 rounded-lg cursor-pointer mb-1">
                        <Link href="/admin/events" className="flex items-center w-full">
                          <CalendarRange className="w-4 h-4 mr-3 text-blue-900" />
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">Admin Bereich</span>
                          </div>
                        </Link>
                      </DropdownMenuItem>
                    )}

                    {/* Sign Out */}
                    <DropdownMenuItem 
                      onClick={() => signOut()}
                      className="px-3 py-2.5 rounded-lg cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                    >
                      <LogOut className="w-4 h-4 mr-3" />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">Abmelden</span>
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Mobile Version */}
              <div className="flex md:hidden items-center gap-2">
                {/* Notifications */}
                <div className="relative">
                  <NotificationsWidget />
                </div>
                
                {/* Mobile Menu mit Avatar */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="h-10 w-10 rounded-full hover:bg-gray-100"
                    >
                      <div className={`flex items-center justify-center h-8 w-8 rounded-full ${getAvatarColor(session.user.name)} text-white font-semibold text-sm shadow-sm`}>
                        {getInitials()}
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    align="end" 
                    className="w-64 rounded-xl shadow-lg border border-gray-200 p-2"
                  >
                    {/* User Info Section */}
                    <div className="flex items-center gap-3 px-3 py-3 rounded-lg bg-gray-50 mb-2">
                      <div className={`flex items-center justify-center h-10 w-10 rounded-full ${getAvatarColor(session.user.name)} text-white font-semibold text-sm shadow-sm`}>
                        {getInitials()}
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 truncate capitalize">
                          {session.user?.name || "User N/A"}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {session.user?.rating} • {session.user.fir ? ("FIR: " + session.user.fir) : "VATSIM Germany"}
                        </p>
                      </div>
                    </div>

                    <DropdownMenuSeparator />

                    {/* Admin Link */}
                    {hasAdminAcess() && (
                      <DropdownMenuItem asChild className="px-3 py-2.5 rounded-lg cursor-pointer mb-1">
                        <Link href="/admin" className="flex items-center w-full">
                          <Shield className="w-4 h-4 mr-3 text-blue-600" />
                          <span className="text-sm font-medium">Admin Bereich</span>
                        </Link>
                      </DropdownMenuItem>
                    )}

                    {/* Sign Out */}
                    <DropdownMenuItem 
                      onClick={() => signOut()}
                      className="px-3 py-2.5 rounded-lg cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                    >
                      <LogOut className="w-4 h-4 mr-3" />
                      <span className="text-sm font-medium">Abmelden</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}