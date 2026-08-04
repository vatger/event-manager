import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import SessionProviderWrapper from "./SessionProviderWrapper";
import Protected from "@/components/Protected";
import { Toaster } from "@/components/ui/sonner";
import ClientLayout from "./ClientLayout";
import { ThemeProvider } from "@/components/theme-provider";

// Hausschrift laut VATGER-Brandbook. Selbst gehostet, damit die App ohne
// externe Requests auskommt; weitere Schnitte lassen sich jederzeit
// aus dem VATGER-CDN ergänzen.
const vatger = localFont({
  variable: "--font-vatger",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
  src: [
    { path: "../public/fonts/vatger/Vatger-Regular.woff2", weight: "400", style: "normal" },
    { path: "../public/fonts/vatger/Vatger-Medium.woff2", weight: "500", style: "normal" },
    { path: "../public/fonts/vatger/Vatger-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "../public/fonts/vatger/Vatger-Bold.woff2", weight: "700", style: "normal" },
  ],
});

export const metadata: Metadata = {
  title: "VATGER Eventmanager",
  description: "VATGER",
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Die Schrift-Variable liegt auf <html>, damit Tailwinds Preflight
    // (font-family auf html) sie auflösen kann; font-sans auf <body> setzt
    // sie zusätzlich explizit für alles, was in den Body portalisiert wird.
    <html lang="de" suppressHydrationWarning className={vatger.variable}>
      <body className="font-sans antialiased bg-background">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SessionProviderWrapper>
            <Protected>
              <ClientLayout>{children}</ClientLayout>
            </Protected>
          </SessionProviderWrapper>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
