import {
  Calendar,
  Settings,
  Users,
  CheckCheckIcon,
  Image,
  TowerControl,
  ClipboardList,
} from "lucide-react";
  import { LucideIcon } from "lucide-react";
  
  export interface NavItem {
    href: string;
    label: string;
    icon: LucideIcon;
    badge?: string | number | null;
  }

  /**
   * Wer eine Navigationsgruppe sieht:
   *  - teamLead:  Leitung eines FIR-Eventdepartments, VATGER-Eventleitung, Main-Admin
   *  - mainAdmin: nur Main-Admins (Systemadministration)
   */
  export type NavAudience = "teamLead" | "mainAdmin";
  
  export interface NavGroup {
    title: string;
    items: NavItem[];
    audience?: NavAudience;
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
        {
          href: "/admin/tasks",
          label: "Meine Aufgaben",
          icon: ClipboardList,
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
          icon: TowerControl,
        }
      ]
    },
    
    // Team & Rechte (FIR-Leitung, VATGER-Eventleitung, Main-Admin)
    {
      title: "Organisation",
      audience: "teamLead",
      items: [
        {
          href: "/admin/team",
          label: "Team & Rechte",
          icon: Users,
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
      audience: "mainAdmin",
      items: [
        { 
          href: "/admin/system/settings", 
          label: "System Settings", 
          icon: Settings,
        },
      ]
    }
  ];