"use client";

import { usePathname } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");

  return (
    <div className="min-h-screen flex flex-col justify-between">
      <main>
        {!isAdmin && <Header />}
        {children}
      </main>
      <footer>
        <Footer />
      </footer>
    </div>
  );
}
