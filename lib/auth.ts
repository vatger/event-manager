// lib/auth.ts
import { User, type NextAuthOptions } from "next-auth";
import { prisma } from "@/lib/prisma";
import { OAuthConfig } from "next-auth/providers/oauth";

interface VatsimProfile {
  id: Number,
  firstname: string,
  lastname: string,
  fullname: string,
  email: string,
  rating_atc: Number,
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
    };
  }
  
  const vatsimHost = "https://vatsim-germany.org"
  
  const VatsimProvider: OAuthConfig<VatsimProfile> = {
    id: 'vatsim',
    name: 'VATGER',
    type: 'oauth',
    authorization: {
      url: `${vatsimHost}/oauth/authorize`,
      params: { scope: 'name rating legacy' },
    },
    token: `${vatsimHost}/oauth/token`,
    userinfo: `${vatsimHost}/oauth/userinfo`,
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
      };
    },
  };
  
// Deine gesamte authOptions Konfiguration hier...
export const authOptions: NextAuthOptions = {
    providers: [VatsimProvider],
    callbacks: {
      async signIn({ user }) {
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
          token.role = user.role || "USER";
        }
        return token;
      },
      async session({ session, token }) {
        const dbUser = await prisma.user.findUnique({
          where: { cid: Number(token.cid) },
        });

        session.user = {
          id: token.id,
          cid: token.cid,
          name: token.name,
          rating: token.rating,
          role: dbUser?.role || token.role || "USER",
        };
        return session;
      },
    },
    secret: process.env.NEXTAUTH_SECRET!,
    
};

export async function getUser(userId: string) {
  return prisma.user.findUnique({
    where: { cid: Number(userId) },
    select: { id: true, role: true, name: true, cid: true, rating: true },
  });
}

export function isMainAdmin(user: { role: string }) {
  return user.role === "MAIN_ADMIN";
}

export function isAdmin(user: { role: string }) {
  return user.role === "ADMIN" || user.role === "MAIN_ADMIN";
}