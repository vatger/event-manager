import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SessionProviderWrapper from "./SessionProviderWrapper";
import Protected from "@/components/Protected";
import { Toaster } from "@/components/ui/sonner";
import ClientLayout from "./ClientLayout";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VATGER Eventmanager",
  description: "VATSIM Germany",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background`}>
        <SessionProviderWrapper>
          <Protected>
            <ClientLayout>{children}</ClientLayout>
          </Protected>
        </SessionProviderWrapper>
        <Toaster />
      </body>
    </html>
  );
}
