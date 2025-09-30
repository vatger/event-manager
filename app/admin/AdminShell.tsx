"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Calendar,
  Users,
  Settings,
  LogOut,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import NotificationsWidget from "@/components/NotificationsWidget";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "next-auth/react";
import React from "react";

const sidebarItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, badge: null },
  { href: "/admin/team", label: "Members", icon: Users, badge: null },
  { href: "/admin/settings", label: "Settings", icon: Settings, badge: null },
];

// Navigation Item Komponente
const NavItem = ({ 
  item, 
  isActive 
}: { 
  item: typeof sidebarItems[0]; 
  isActive: boolean; 
}) => {
  const Icon = item.icon;
  
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all hover:bg-accent group",
        isActive 
          ? "bg-accent text-accent-foreground font-medium" 
          : "text-muted-foreground"
      )}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge && (
        <Badge 
          variant="secondary" 
          className="ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full p-0 text-xs"
        >
          {item.badge}
        </Badge>
      )}
    </Link>
  );
};

export type AdminShellUser = {
  name: string;
  cid: string;
  role: "USER" | "ADMIN" | "MAIN_ADMIN";
};

function AppSidebar({ user }: { user: AdminShellUser }) {
  const pathname = usePathname();
  return (
    <Sidebar className="border-r bg-background">
      <SidebarHeader className="border-b p-4">
        <div className="flex items-center gap-2 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <span className="text-sm font-bold text-primary-foreground">YS</span>
          </div>
          <div className="flex flex-col">
            <span className="font-semibold">Eventmanager</span>
            <span className="text-xs text-muted-foreground">Adminpanel</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <nav className="flex flex-col gap-1 p-2">
          {sidebarItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <NavItem 
                key={item.href} 
                item={item} 
                isActive={isActive} 
              />
            );
          })}
        </nav>
      </SidebarContent>

      <SidebarFooter className="border-t p-4">
        <div className="flex items-center gap-3 px-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary text-primary-foreground">
              {user?.name ? user.name.charAt(0) : "Y"}
              {user?.name && user.name.split(" ").length > 1 ? user.name.split(" ")[1].charAt(0) : ""}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-1 flex-col min-w-0">
            <span className="text-sm font-medium truncate">{user?.name}</span>
            <span className="text-xs text-muted-foreground truncate">{user?.cid}</span>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" 
                  onClick={() => {
                    signOut();
                  }}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

export default function AdminShell({ children, user }: { children: React.ReactNode; user: AdminShellUser }) {
  const pathname = usePathname();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar user={user} />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4 lg:px-6">
            <SidebarTrigger className="-ml-1" />
            <div className="flex flex-1 items-center justify-between">
              <h1 className="text-lg font-semibold">
                {getPageTitle(pathname)}
              </h1>
              <div className="flex items-center gap-2">
                <NotificationsWidget />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="capitalize">
                      {user?.name || "User"}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem><Link href="/admin" className="w-full">Admin</Link></DropdownMenuItem>
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
          </header>
          <main className="flex-1 p-4 lg:p-6">
            <div className="mx-auto max-w-7xl">
              {children}
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

// Hilfsfunktion für Seitentitel
function getPageTitle(pathname: string): string {
  const item = sidebarItems.find(item => 
    pathname === item.href || pathname.startsWith(item.href + '/')
  );
  return item?.label || "Dashboard";
}
