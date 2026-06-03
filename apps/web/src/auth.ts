import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { pool } from '@lumino/db';
import bcrypt from 'bcrypt';

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
    }
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        try {
          // Fetch tenant from database
          const res = await pool.query(
            'SELECT id, name, email, password FROM tenants WHERE email = $1',
            [email]
          );

          if (res.rows.length === 0) {
            return null;
          }

          const tenant = res.rows[0];
          
          // Verify bcrypt hashed password
          const isValid = await bcrypt.compare(password, tenant.password);
          if (!isValid) {
            return null;
          }

          return {
            id: tenant.id,
            name: tenant.name,
            email: tenant.email,
          };
        } catch (err) {
          console.error('[Auth] Error in authorize credentials provider:', err);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
});
