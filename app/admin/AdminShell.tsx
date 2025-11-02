// components/AdminShell.tsx
"use client";

import { usePathname } from "next/navigation";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { FIRNavbar } from "./firs/_components/FIRnavbar";
import { AdminSidebar } from "./_components/sidebar/AdminSidebar";
import { AdminHeader } from "./_components/AdminHeader";
import { navigationConfig } from "./_components/sidebar/sidebar-nav";

export type AdminShellUser = {
  name: string;
  cid: string;
  permissions?: string[];
};

interface AdminShellProps {
  children: React.ReactNode;
  user: AdminShellUser;
}

export default function AdminShell({ children, user }: AdminShellProps) {
  const pathname = usePathname();
  
  const isFIRPage = pathname.includes("/firs");
  const pageTitle = getPageTitle(pathname);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AdminSidebar user={user} />
        <SidebarInset>
          {!isFIRPage ? (
            <AdminHeader 
              title={pageTitle} 
              user={user}
            />
          ) : (
            <FIRNavbar />
          )}
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
  for (const group of navigationConfig) {
    for (const item of group.items) {
      if (pathname === item.href || pathname.startsWith(item.href + '/admin')) {
        return item.label;
      }
    }
  }
  return "Dashboard";
}