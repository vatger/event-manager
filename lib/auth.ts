// lib/auth.ts
import { User, type NextAuthOptions } from "next-auth";
import { prisma } from "@/lib/prisma";
import { OAuthConfig } from "next-auth/providers/oauth";
import { isMainAdminCid } from "./acl/mainAdmins";

interface VatsimProfile {
  id: number,
  firstname: string,
  lastname: string,
  fullname: string,
  rating_atc: number,
  rating_atc_short: string,
  fir_code: string,
  data?: {
      cid: string | number;
      personal?: {
        name_full?: string;
        name_first?: string;
        name_last?: string;
      };
      vatsim: {
        rating: {
          short: string;
        };
      };
    };
    cid?: string | number;
    personal?: {
      name_full?: string;
      name_first?: string;
      name_last?: string;
    };
    vatsim?: {
      rating: {
        short: string;
      };
    },
  }
  
  const VatgerProvider: OAuthConfig<VatsimProfile> = {
    id: 'vatsim',
    name: 'VATGER',
    type: 'oauth',
    authorization: {
      url: process.env.VATGER_CONNECT_URL,
      params: { scope: 'name rating legacy assignment' },
    },
    token: process.env.VATGER_TOKEN_URL!,
    userinfo: process.env.VATGER_USER_INFO!,
    clientId: process.env.VATGER_CLIENT_ID!,
    clientSecret: process.env.VATGER_CLIENT_SECRET!,
    profile(profile: VatsimProfile) {
      const data = profile?.data || profile;
      const cid = Number(data.cid);
      
      let fullName: string;
      if (data.personal?.name_full) {
        fullName = data.personal.name_full;
      } else if (data.personal?.name_first && data.personal?.name_last) {
        fullName = `${data.personal.name_first} ${data.personal.name_last}`;
      } else {
        fullName = "Unknown User";
      }
  
      const rating = data.vatsim?.rating?.short || "UNKNOWN";
      return {
        id: String(cid),
        cid: String(cid),
        name: fullName,
        rating,
        role: "USER",
        fir: profile.fir_code
      };
    },
  };

  const VatsimSandboxProvider: OAuthConfig<VatsimProfile> = {
    id: 'vatsim-sandbox',
    name: 'VATSIM Sandbox',
    type: 'oauth',
    authorization: {
      url: process.env.VATSIM_SANDBOX_CONNECT_URL!,
      params: { scope: 'full_name vatsim_details' },
    },
    token: process.env.VATSIM_SANDBOX_TOKEN_URL!,
    userinfo: process.env.VATSIM_SANDBOX_USER_INFO!,
    clientId: process.env.VATSIM_SANDBOX_CLIENT_ID!,
    clientSecret: process.env.VATSIM_SANDBOX_CLIENT_SECRET!,
    profile(profile: VatsimProfile) {
      const data = profile?.data || profile;
      const cid = Number(data.cid);
  
      const fullName =
        data.personal?.name_full ||
        `${data.personal?.name_first ?? "Unknown"} ${data.personal?.name_last ?? ""}`.trim();
  
      const rating = data.vatsim?.rating?.short || "UNKNOWN";
  
      return {
        id: String(cid),
        cid: String(cid),
        name: fullName,
        rating,
        role: "USER",
        fir: ""
      };
    },
  };
  
  
// Deine gesamte authOptions Konfiguration hier...
/**
 * Sitzungscookie für eingebettete Ansichten.
 *
 * In einem iframe auf fremder Seite (ATCISS) schickt der Browser ein Cookie
 * mit SameSite=Lax nicht mit – die Sitzung wäre dort nie sichtbar, und der
 * Plan bliebe leer, obwohl man angemeldet ist. SameSite=None behebt das,
 * verlangt aber HTTPS und lockert den Schutz gegen Cross-Site-Requests.
 * Deshalb hängt es an einer ausdrücklichen Einstellung statt am Standard: Wer
 * nicht einbettet, behält das strengere Verhalten.
 */
const crossSiteEmbedding = process.env.EMBED_CROSS_SITE_COOKIES === "true";

const embedCookies: NextAuthOptions["cookies"] = crossSiteEmbedding
  ? {
      sessionToken: {
        name: "__Secure-next-auth.session-token",
        options: {
          httpOnly: true,
          sameSite: "none",
          path: "/",
          secure: true,
        },
      },
    }
  : undefined;

export const authOptions: NextAuthOptions = {
    ...(embedCookies ? { cookies: embedCookies } : {}),
    providers: [
      ...(process.env.DEV_MODE === "true" 
        ? [VatsimSandboxProvider, VatgerProvider] 
        : [VatgerProvider]
      ),
    ],
    pages: {
      signIn: "/auth/signin",
    },
    callbacks: {
      async signIn({ user, account }) {
        if (account?.provider === "vatsim-sandbox" && process.env.DEV_MODE !== "true") {
          console.error("Sandbox login attempted in production");
          return false; // Login verweigern
        }
        const cid = Number(user.cid);
        if (!Number.isFinite(cid)) {
          console.error("Ungültige CID erhalten:", user.cid);
          return false;
        }
  
        try {
          const existingUser = await prisma.user.findUnique({
            where: { cid },
          });
          if (!existingUser) {
            await prisma.user.create({
              data: {
                cid,
                name: user.name!,
                rating: user.rating,
              },
            });
          } else if (existingUser.name !== user.name || existingUser.rating !== user.rating) {
            await prisma.user.update({
              where: { cid },
              data: {
                name: user.name!,
                rating: user.rating,
              },
            });
          }
  
          return true;
        } catch (error) {
          console.error("Fehler bei der Benutzerverwaltung:", error);
          return false;
        }
      },
      async jwt({ token, user }) {
        if (user) {
          token.id = user.id;
          token.cid = user.cid;
          token.name = user.name!;
          token.rating = user.rating;
          token.fir = user.fir
        }
        return token;
      },
      async session({ session, token }) {
        const cid = Number(token.cid);

        // MAIN_ADMIN is exclusively determined by the MAIN_ADMIN_CIDS env variable
        const role = isMainAdminCid(cid) ? 'MAIN_ADMIN' : 'USER';

        session.user = {
          id: token.id,
          cid: token.cid,
          name: token.name,
          rating: token.rating,
          role,
          fir: token.fir
        };
        return session;
      },
    },
    secret: process.env.NEXTAUTH_SECRET!,
    
};

export async function getUser(userId: string) {
  return prisma.user.findUnique({
    where: { cid: Number(userId) },
    select: { id: true, name: true, cid: true, rating: true },
  });
}

export function isMainAdmin(cid: number): boolean {
  return isMainAdminCid(cid);
}
