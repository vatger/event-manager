"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Users, Bell, UserCheck, BarChart3, Settings, Menu, X } from "lucide-react";
import { useState, useEffect } from "react";
import { useUser } from "@/hooks/useUser";

const eventAdminTabs: {
    id: string;
    label: string;
    href: string;
    icon: any;
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
}

export function EventAdminNav({ signupsCount = 0, candidatesCount = 0 }: EventAdminNavProps) {
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
          "group relative flex items-center gap-2 lg:gap-3 border-b-2 py-3 lg:py-4 px-2 lg:px-3 text-sm font-medium transition-all hover:bg-accent/50",
          isActive
            ? "border-primary text-primary bg-accent/20"
            : "border-transparent text-muted-foreground hover:text-foreground"
        )}
        onClick={() => setIsMobileMenuOpen(false)}
      >
        <Icon className="h-4 w-4 lg:h-5 lg:w-5 flex-shrink-0" />
        <span className="whitespace-nowrap">{tab.label}</span>
        
        {badgeCount !== null && badgeCount > 0 && (
          <span className={cn(
            "flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium flex-shrink-0",
            isActive 
              ? "bg-primary text-primary-foreground" 
              : "bg-muted-foreground text-background"
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
        "sticky top-0 z-40 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 border-b transition-all duration-200 h-18",
        isScrolled && "shadow-sm"
      )}>
        <div className="container mx-auto px-4 lg:px-6">
          {/* Mobile Header */}
          <div className="flex lg:hidden items-center justify-between py-4">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-md hover:bg-accent transition-colors"
              aria-label="Menü öffnen"
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
            
            <div className="text-sm font-medium text-muted-foreground">
              Event Navigation
            </div>
            
            {/* Mobile Badge Summary */}
            <div className="flex gap-1">
              {signupsCount > 0 && (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  {signupsCount}
                </div>
              )}
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex space-x-1 pt-3">
            {visibleTabs.map((tab) => (
              <NavItem key={tab.id} tab={tab} />
            ))}
          </nav>
        </div>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="lg:hidden bg-background/80 backdrop-blur-sm fixed inset-0 z-30 mt-16">
            <div 
              className="bg-card border-b shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="container mx-auto px-4 py-2">
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
                          "flex items-center gap-3 rounded-lg px-3 py-3 text-base font-medium transition-colors",
                          isActive
                            ? "bg-accent text-accent-foreground"
                            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                        )}
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <Icon className="h-5 w-5 flex-shrink-0" />
                        <span className="flex-1">{tab.label}</span>
                        
                        {badgeCount !== null && badgeCount > 0 && (
                          <span className={cn(
                            "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                            isActive 
                              ? "bg-primary text-primary-foreground" 
                              : "bg-muted-foreground text-background"
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