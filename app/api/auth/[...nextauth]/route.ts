import NextAuth from 'next-auth'
import { OAuthConfig } from 'next-auth/providers'
import { PrismaClient } from '@prisma/client'
import { getEndorsementsForCid } from '@/utils/endorsements'

const prisma = new PrismaClient()

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
      endorsements: null, // später kannst du hier Daten mappen
    }
  }
  ,
} as OAuthConfig<any>

export const authOptions = {
  providers: [VatsimProvider],
  callbacks: {
    async signIn({ user }: any) {
      if (!user?.cid) return false
    
      // CSV-Endorsements laden
      let csvEndorsements: string[] | null = null
      try {
        csvEndorsements = await getEndorsementsForCid(user.cid)
      } catch (e) {
        // Falls CSV fehlt/fehlerhaft, Login nicht blockieren
        console.error('Endorsement / CSV lookup failed:', e)
      }

      // Beste Quelle wählen: CSV > Provider > bestehend
      const existingUser = await prisma.user.findUnique({
        where: { cid: user.cid },
      })

      const endorsementsToPersist =
        csvEndorsements ?? user.endorsements ?? existingUser?.endorsements ?? null

      if (!existingUser) {
        await prisma.user.create({
          data: {
            cid: user.cid,
            name: user.name || 'Unknown',
            endorsements: endorsementsToPersist,
          },
        })
      } else {
        const shouldUpdate =
          (existingUser.name ?? '') !== (user.name || existingUser.name) ||
          JSON.stringify(existingUser.endorsements ?? null) !== JSON.stringify(endorsementsToPersist ?? null)

        if (shouldUpdate) {
          await prisma.user.update({
            where: { id: existingUser.id },
            data: {
              name: user.name || existingUser.name,
              endorsements: endorsementsToPersist,
            },
          })
        }
      }

      return true
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
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
