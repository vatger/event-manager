// config/navigation.ts
import { 
    LayoutDashboard, 
    Calendar, 
    Users, 
    Settings,
    Map,
    PlusCircle,
    CheckCheckIcon,
  } from "lucide-react";
  import { LucideIcon } from "lucide-react";
  
  export interface NavItem {
    href: string;
    label: string;
    icon: LucideIcon;
    badge?: string | number | null;
    permission?: string[];
  }
  
  export interface NavGroup {
    title: string;
    items: NavItem[];
    permission?: string[];
    collapsible?: boolean;
  }
  
  export const navigationConfig: NavGroup[] = [
    // Haupt-Navigation
    {
      title: "Main",
      items: [
        { 
          href: "/admin", 
          label: "Dashboard", 
          icon: LayoutDashboard,
        },
        { 
          href: "/admin/events", 
          label: "Events", 
          icon: Calendar,
        },
      ]
    },
    
    // Tools Section
    {
      title: "Tools",
      items: [
        {
          href: "/admin/userinfo",
          label: "Controller Info",
          icon: CheckCheckIcon,
        },
        { 
          href: "/admin/event-calendar", 
          label: "Event Calendar", 
          icon: Calendar,
        },
        { 
          href: "/admin/cpts", 
          label: "CPT Manager", 
          icon: Users,
        },
      ]
    },
    
    // FIR Management (nur für berechtigte User)
    {
      title: "FIR Management",
      permission: ["fir.manage"],
      items: [
        { 
          href: "/admin/firs", 
          label: "FIR Overview", 
          icon: Map,
        },
      ]
    },
    
    // System Administration (nur für Super Admin)
    {
      title: "System Administration",
      permission: ["MAIN_ADMIN"],
      items: [
        { 
          href: "/admin/system/users", 
          label: "User Management", 
          icon: Users,
        },
        { 
          href: "/admin/system/settings", 
          label: "System Settings", 
          icon: Settings,
        },
      ]
    }
  ];