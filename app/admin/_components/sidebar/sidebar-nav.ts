import { 
    LayoutDashboard, 
    Calendar, 
    Users, 
    Settings,
    Map,
    PlusCircle,
    CheckCheckIcon,
    Image,
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
    firRestriction?: string; // Restrict to specific FIR code
  }
  
  export const navigationConfig: NavGroup[] = [
    // Haupt-Navigation
    {
      title: "Main",
      items: [
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
      ]
    },
    
    // FIR Management (nur für berechtigte User)
    {
      title: "FIR Management",
      permission: ["FIR_EVENTLEITER"],
      items: [
        { 
          href: "/admin/firs", 
          label: "FIR Overview", 
          icon: Map,
        },
      ]
    },
    
    // FIR Internal Tools (nur für FIR München)
    {
      title: "EDMM Intern",
      firRestriction: "EDMM",
      items: [
        { 
          href: "/admin/edmm/cpt-banner", 
          label: "CPT Banner Generator", 
          icon: Image,
        },
      ]
    },
    
    // System Administration (nur für Super Admin)
    {
      title: "System Administration",
      permission: ["MAIN_ADMIN"],
      items: [
        { 
          href: "/admin/system/settings", 
          label: "System Settings", 
          icon: Settings,
        },
      ]
    }
  ];