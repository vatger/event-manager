"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ChevronDown, LogOut } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { navigationConfig, type NavGroup } from "./sidebar-nav";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { useUser } from "@/hooks/useUser";
import { getAvatarColor } from "@/utils/getAvatarColor";

interface AdminSidebarProps {
  user: {
    name: string;
    cid: string;
  };
}


// Navigation Item Komponente
const NavItem = ({ 
  item, 
  isActive 
}: { 
  item: NavGroup['items'][0]; 
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
      <div className="flex-1 min-w-0">
        <div className="truncate">{item.label}</div>
      </div>
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

// Navigation Group Komponente
const NavGroup = ({ group }: { group: NavGroup }) => {
  const pathname = usePathname();
  const { user, can, isMainAdmin, canInOwnFIR } = useUser();
  const [isOpen, setIsOpen] = useState(true);

  const hasPermission = (requiredPermissions?: string[]): boolean => {
    if (!requiredPermissions || requiredPermissions.length === 0) return true;
    
    // MAIN_ADMIN hat immer alle Berechtigungen
    if (isMainAdmin()) return true;
    
    // Permission entspricht dem effektiven Level des Users
    if(requiredPermissions[0] === user?.effectiveLevel) return true;

    return requiredPermissions.some(permission => can(permission) || canInOwnFIR(permission));
  };

  // Permission check für diese Gruppe
  if (group.permission && !hasPermission(group.permission)) {
    return null;
  }

  // Filter items based on permissions
  const visibleItems = group.items.filter(item => 
    !item.permission || hasPermission(item.permission)
  );

  if (visibleItems.length === 0) return null;

  if (group.collapsible) {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className="group/collapsible">
        <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-all hover:bg-accent hover:text-accent-foreground [&[data-state=open]>svg]:rotate-180">
          <div className="flex-1 text-left font-semibold text-xs uppercase tracking-wider text-muted-foreground">
            {group.title}
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
        </CollapsibleTrigger>
        <CollapsibleContent className="CollapsibleContent">
          <div className="mt-1 space-y-1">
            {visibleItems.map((item) => {
              const isActive = pathname === item.href || 
              (item.href !== "/admin" && pathname.startsWith(item.href));
              return (
                <NavItem key={item.href} item={item} isActive={isActive} />
              );
            })}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <div className="space-y-2">
      {group.title && (
        <div className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {group.title}
        </div>
      )}
      <div className="space-y-1">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || 
          (item.href !== "/admin" && pathname.startsWith(item.href));
          return (
            <NavItem key={item.href} item={item} isActive={isActive} />
          );
        })}
      </div>
    </div>
  );
};

export function AdminSidebar({ user }: AdminSidebarProps) {
  const pathname = usePathname();

  const getInitials = () => {
    if (!user?.name) return "N";
    const names = user?.name.split(' ');
    const firstInitial = names[0]?.charAt(0) || '';
    const lastInitial = names[1]?.charAt(0) || '';
    return `${firstInitial}${lastInitial}`.toUpperCase();
  };
  
  return (
    <Sidebar className="border-r bg-background">
      <SidebarHeader className="border-b p-4">
      <Link href="/">
        <div className="flex items-center gap-2 px-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-900">
                <img src="../logo.png" alt="Logo" className="p-1 m-2"/>
            </div>
            <div className="flex flex-col">
                <span className="font-bold">Eventmanager</span>
                <span className="text-xs text-muted-foreground">Adminpanel</span>
            </div>
        </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <nav className="flex flex-col gap-4 p-4">
          {navigationConfig.map((group, index) => (
            <NavGroup key={`${group.title}-${index}`} group={group} />
          ))}
        </nav>
      </SidebarContent>

      <SidebarFooter className="border-t p-4">
        <div className="flex items-center gap-3">
          {/* Avatar Circle */}
          <div className={`flex items-center justify-center h-8 w-8 rounded-full ${getAvatarColor(user.name)} text-white font-semibold text-sm shadow-sm`}>
            {getInitials()}
          </div>
          <div className="flex flex-1 flex-col min-w-0">
            <span className="text-sm font-medium truncate">{user?.name}</span>
            <span className="text-xs text-muted-foreground truncate">CID {user?.cid}</span>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 flex-shrink-0" 
            onClick={() => signOut()}
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}