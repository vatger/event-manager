import NextAuth from "next-auth";
import { prisma } from "@/lib/prisma";
import { OAuthConfig } from "next-auth/providers/oauth";

const vatsimHost =
  process.env.VATSIM_USE_SANDBOX === 'true'
    ? 'https://auth-dev.vatsim.net'
    : 'https://auth.vatsim.net'

const VatsimProvider = {
  id: 'vatsim',
  name: 'VATSIM',
  type: 'oauth',
  authorization: {
    url: `${vatsimHost}/oauth/authorize`,
    params: { scope: 'full_name vatsim_details' },
  },
  token: `${vatsimHost}/oauth/token`,
  userinfo: `${vatsimHost}/api/user`,
  clientId: process.env.VATSIM_CLIENT_ID,
  clientSecret: process.env.VATSIM_CLIENT_SECRET,
  profile(profile: any) {
    const data = profile?.data || profile
    return {
      id: data.cid?.toString(),
      cid: data.cid?.toString(),
      name: data.personal?.name_full || `${data.personal?.name_first} ${data.personal?.name_last}`,
      rating: data.vatsim.rating.short,
    }
  }
  ,
} as OAuthConfig<any>

export const authOptions = {
  providers: [VatsimProvider],
  callbacks: {
    async signIn({ user }: any) {
      //check if user exists in the database
      const existingUser = await prisma.user.findUnique({
        where: { cid: user.cid },
      });

      if (!existingUser) {
        // If user does not exist, create a new user
        await prisma.user.create({
          data: {
            cid: user.cid,
            name: user.name,
            rating: user.rating,
          },
        });
      } else {
        // Update falls sich Name oder Rating geändert haben
        if (existingUser.name !== user.name || existingUser.rating !== user.rating) {
          await prisma.user.update({
            where: { cid: user.cid },
            data: {
              name: user.name,
              rating: user.rating,
            },
          });
        }
      }

      return true;
    },
    async jwt({ token, user }: any) {
      if (user) {
        token.id = user.id
        token.cid = user.cid
        token.name = user.name
        token.rating = user.rating
      }
      return token
    },
    async session({ session, token }: any) {
      session.user = session.user || {}
      session.user.id = token.id
      session.user.cid = token.cid
      session.user.name = token.name
      session.user.rating = token.rating
      session.user.role = "ADMIN"
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
}


const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };