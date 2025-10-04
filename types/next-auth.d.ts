import { DefaultSession } from "next-auth";

// Module Augmentation für NextAuth, damit TS zusätzliche Felder wie `id` und `cid` kennt

declare module "next-auth" {
  interface Session {
    user: {
      id: string; // aus JWT/Provider (hier: VATSIM CID als String)
      cid: string;
      name: string;
      rating: string;
      role: "ADMIN" | "USER" | "MAIN_ADMIN";
      fir_code: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    id: string; // vom Provider
    cid: string;
    name: string;
    rating: string;
    role: "ADMIN" | "USER" | "MAIN_ADMIN";
    fir_code: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    cid: string;
    rating: string;
    name: string;
    role: "ADMIN" | "USER" | "MAIN_ADMIN";
    fir_code: string | null;
  }
}
