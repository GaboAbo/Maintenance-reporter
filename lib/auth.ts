import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import type { SessionUser } from '@/types'

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.tenantId = (user as SessionUser).tenantId
        token.role = (user as SessionUser).role
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        ;(session.user as SessionUser).tenantId = token.tenantId as string
        ;(session.user as SessionUser).role = token.role as SessionUser['role']
      }
      return session
    },
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await db.user.findFirst({
          where: { email: credentials.email as string },
          select: { id: true, tenantId: true, name: true, email: true, role: true, password: true, active: true },
        })

        if (!user || !user.active) return null

        const valid = await verifyPassword(credentials.password as string, user.password)
        if (!valid) return null

        return {
          id: user.id,
          tenantId: user.tenantId,
          name: user.name,
          email: user.email,
          role: user.role,
        }
      },
    }),
  ],
})
