"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Users, Bell, UserCheck, BarChart3, Settings, Menu, X, LucideIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { useUser } from "@/hooks/useUser";
import { SidebarTrigger } from "@/components/ui/sidebar";

const eventAdminTabs: {
    id: string;
    label: string;
    href: string;
    icon: LucideIcon;
    badge?: "count";
    permission?: string;
  }[] = [
  {
    id: "overview",
    label: "Übersicht",
    href: "",
    icon: BarChart3,
  },
  {
    id: "signups", 
    label: "Anmeldungen",
    href: "/signups",
    icon: Users,
    badge: "count"
  },
  {
    id: "candidates",
    label: "Potenzielle Lotsen",
    href: "/candidates", 
    icon: UserCheck,
    badge: "count"
  },
  {
    id: "notify",
    label: "Benachrichtigungen",
    href: "/notify",
    icon: Bell,
    permission: "user.notif"
  },
  {
    id: "edit",
    label: "Bearbeiten",
    href: "/edit",
    icon: Settings,
    permission: "event.edit"
  }
];

interface EventAdminNavProps {
  signupsCount?: number;
  candidatesCount?: number;
  eventName?: string;
  user?: {
    name: string;
    rating: string;
  };
}

export function EventAdminNav({ signupsCount = 0, candidatesCount = 0, eventName, user }: EventAdminNavProps) {
  const params = useParams();
  const pathname = usePathname();
  const eventId = params.id as string;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  
  const { canInOwnFIR } = useUser();
  
  const basePath = `/admin/events/${eventId}`;

  // Scroll-Listener für Shadow-Effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Mobile Menu schließen bei Route-Change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const getBadgeCount = (tabId: string) => {
    switch (tabId) {
      case "signups":
        return signupsCount;
      case "candidates":
        return candidatesCount;
      default:
        return null;
    }
  };

  const visibleTabs = eventAdminTabs.filter((tab) => {
    if (!tab.permission) return true;
    return canInOwnFIR(tab.permission);
  });

  const NavItem = ({ tab }: { tab: typeof eventAdminTabs[0] }) => {
    const href = `${basePath}${tab.href}`;
    const isActive = pathname === href || 
                   (tab.href !== "" && pathname.startsWith(`${basePath}${tab.href}`));
    
    const badgeCount = getBadgeCount(tab.id);
    const Icon = tab.icon;

    return (
      <Link
        href={href}
        className={cn(
          "group relative flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200",
          isActive
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground hover:bg-accent"
        )}
        onClick={() => setIsMobileMenuOpen(false)}
      >
        <Icon className={cn(
          "h-4 w-4 flex-shrink-0",
          isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
        )} />
        <span className="whitespace-nowrap">{tab.label}</span>
        
        {badgeCount !== null && badgeCount > 0 && (
          <span className={cn(
            "flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium flex-shrink-0",
            isActive 
              ? "bg-primary-foreground text-primary" 
              : "bg-muted text-muted-foreground group-hover:bg-muted"
          )}>
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        )}
      </Link>
    );
  };

  return (
    <>
      {/* Sticky Navigation Header */}
      <div className={cn(
        "sticky top-0 z-40 bg-background border-b transition-all duration-200 h-18 pt-2",
        isScrolled && "shadow-sm"
      )}>
        <div className="w-full px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            {/* Left Section - Sidebar Trigger & Navigation */}
            <div className="flex items-center gap-4">
              {/* Sidebar Trigger */}
              <SidebarTrigger className="-ml-2" />
              
              {/* Event Name */}
              {eventName && (
                <div className="hidden lg:block border-r pr-4">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-foreground">
                      {eventName}
                    </span>
                    <span className="text-xs text-muted-foreground">Event Administration</span>
                  </div>
                </div>
              )}

              {/* Desktop Navigation */}
              <nav className="hidden lg:flex items-center gap-1">
                {visibleTabs.map((tab) => (
                  <NavItem key={tab.id} tab={tab} />
                ))}
              </nav>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden p-2 rounded-md hover:bg-accent transition-colors duration-200"
                aria-label="Menü öffnen"
              >
                {isMobileMenuOpen ? (
                  <X className="h-5 w-5 text-foreground" />
                ) : (
                  <Menu className="h-5 w-5 text-foreground" />
                )}
              </button>
            </div>

            {/* Right Section - User Info */}
            <div className="flex items-center gap-3">
              {/* User Info */}
              {user && (
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-sm font-medium text-foreground">
                    {user.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {user.rating}
                  </span>
                </div>
              )}
              
              {/* Badge Summary */}
              <div className="flex gap-1">
                {signupsCount > 0 && (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
                    {signupsCount > 99 ? "99+" : signupsCount}
                  </div>
                )}
                {candidatesCount > 0 && (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-secondary-foreground text-xs font-medium">
                    {candidatesCount > 99 ? "99+" : candidatesCount}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="lg:hidden bg-black/10 backdrop-blur-sm fixed inset-0 z-30 mt-14">
            <div 
              className="bg-background border-b shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="max-w-7xl mx-auto px-4 py-3">
                {/* Mobile Event Info */}
                {eventName && (
                  <div className="px-3 py-2 mb-3 border-b">
                    <h3 className="font-semibold text-foreground text-sm">{eventName}</h3>
                    <p className="text-xs text-muted-foreground">Event Administration</p>
                  </div>
                )}

                <nav className="flex flex-col space-y-1">
                  {visibleTabs.map((tab) => {
                    const href = `${basePath}${tab.href}`;
                    const isActive = pathname === href || 
                                   (tab.href !== "" && pathname.startsWith(`${basePath}${tab.href}`));
                    const badgeCount = getBadgeCount(tab.id);
                    const Icon = tab.icon;

                    return (
                      <Link
                        key={tab.id}
                        href={href}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors duration-200",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground"
                        )}
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <Icon className={cn(
                          "h-4 w-4 flex-shrink-0",
                          isActive ? "text-primary-foreground" : "text-muted-foreground"
                        )} />
                        <span className="flex-1">{tab.label}</span>
                        
                        {badgeCount !== null && badgeCount > 0 && (
                          <span className={cn(
                            "flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium",
                            isActive 
                              ? "bg-primary-foreground text-primary" 
                              : "bg-muted text-muted-foreground"
                          )}>
                            {badgeCount > 99 ? "99+" : badgeCount}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            </div>
            
            {/* Click Outside to Close */}
            <div 
              className="flex-1"
              onClick={() => setIsMobileMenuOpen(false)}
            />
          </div>
        )}
      </div>
    </>
  );
}