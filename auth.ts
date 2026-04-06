import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { connectToDatabase, User } from '@/lib/db'

export const { auth, signIn, signOut, handlers } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email:    { label: 'Email',    type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        await connectToDatabase()

        const user = await User.findOne({
          email: (credentials.email as string).toLowerCase().trim(),
        })

        if (!user) return null

        const passwordValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash,
        )

        if (!passwordValid) return null

        return {
          id:    user._id.toString(),
          email: user.email,
          name:  `${user.firstName} ${user.lastName}`,
        }
      },
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge:   30 * 24 * 60 * 60,
  },

  callbacks: {
    jwt({ token, user }) {
      if (user) token.userId = user.id
      return token
    },
    session({ session, token }) {
      if (token.userId) session.user.id = token.userId as string
      return session
    },
  },

  pages: {
    signIn:  '/login',
    signOut: '/login',
    error:   '/login',
  },
})
