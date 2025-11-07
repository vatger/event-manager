"use client";

import { usePathname } from "next/navigation";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { FIRNavbar } from "./firs/_components/FIRnavbar";
import { AdminSidebar } from "./_components/sidebar/AdminSidebar";
import { AdminHeader } from "./_components/AdminHeader";
import { EventAdminNav } from "./events/[id]/_components/EventAdminNav";
import { navigationConfig } from "./_components/sidebar/sidebar-nav";

type User = {
  name: string;
  cid: string;
};
export default function AdminShell({ children, user }: { children: React.ReactNode; user: User }) {
  const pathname = usePathname();

  const isFIRPage = pathname.includes("/firs");
  const isEventpage = pathname.includes("/events/") && !pathname.includes("/events/create");
  const pageTitle = getPageTitle(pathname);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full overflow-hidden">
        <AdminSidebar user={user} />

        <SidebarInset>
          {/* Sticky Header je nach Seite */}
          {!isEventpage ? (
            <div className="sticky top-0 z-50 bg-background border-b">
              <AdminHeader title={pageTitle} user={user} />
            </div>
          ) : (
            <div className="sticky top-0 z-50 bg-background border-b">
              <EventAdminNav />
            </div>
          )}

          {/* Scrollbarer Inhalt */}
          <div className="flex-1 overflow-y-auto p-4">
            {children}
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function getPageTitle(pathname: string): string {
  for (const group of navigationConfig) {
    for (const item of group.items) {
      if (pathname === item.href || pathname.startsWith(item.href + "/admin")) {
        return item.label;
      }
    }
  }
  return "Dashboard";
}
