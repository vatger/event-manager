import NextAuth from 'next-auth'
import { OAuthConfig } from 'next-auth/providers'

const vatsimHost = process.env.VATSIM_USE_SANDBOX === 'true' ? 'https://auth-dev.vatsim.net' : 'https://auth.vatsim.net'

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
    // Adapt to sandbox response shape: profile.data.*
    const data = profile?.data || profile
    return {
      id: data.cid?.toString() || data.id?.toString(),
      name: data.personal ? `${data.personal.name_first} ${data.personal.name_last}` : data.name,
      rating: data.vatsim?.rating?.id || (data.rating && data.rating.id) || null,
      email: data.personal?.email || null,
    }
  },
} as OAuthConfig<any>

export const authOptions = {
  providers: [VatsimProvider],
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.id = user.id
        token.name = user.name
        token.rating = user.rating
      }
      return token
    },
    async session({ session, token }: any) {
      session.user = session.user || {}
      session.user.id = token.id
      session.user.name = token.name
      session.user.rating = token.rating

  

      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }