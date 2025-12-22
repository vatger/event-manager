"use client";

import { usePathname } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");
  const isSignup = pathname.startsWith("/auth/signin");

  return (
    <div className="flex flex-col min-h-screen overflow-hidden">
      {/* Header (nur auf Nicht-Admin-Seiten) */}
      {!isAdmin && !isSignup && (
        <header className="sticky top-0 z-50 bg-background border-b">
          <Header />
        </header>
      )}

      {/* Hauptinhalt mit internem Scrollen */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>

      {/* Footer (ebenfalls sticky unten) */}
      {!isAdmin && !isSignup && (
        <footer className="flex-shrink-0 bg-background">
          <Footer />
        </footer>
      )}
    </div>
  );
}
