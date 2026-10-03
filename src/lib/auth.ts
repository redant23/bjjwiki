import { NextAuthOptions, getServerSession, Session } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider, { GoogleProfile } from 'next-auth/providers/google';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import { findOrCreateGoogleUser } from '@/lib/google-user';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Login',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'admin@example.com' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        await dbConnect();

        const user = await User.findOne({
          email: credentials.email.toLowerCase().trim(),
        }).select('+password');

        if (!user || !user.password) {
          return null;
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) {
          return null;
        }

        return {
          id: user._id.toString(),
          email: user.email,
          name: user.nickname,
          role: user.role,
        };
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== 'google') {
        return true;
      }
      const google = profile as GoogleProfile | undefined;
      if (!google?.email || !google.email_verified) {
        return false;
      }
      const result = await findOrCreateGoogleUser({
        email: google.email,
        name: google.name,
        googleId: google.sub,
      });
      return result.ok;
    },
    async jwt({ token, user, account, trigger, session }) {
      if (account?.provider === 'google' && token.email) {
        await dbConnect();
        const dbUser = await User.findOne({
          email: token.email.toLowerCase(),
        }).select('role nickname');
        if (dbUser) {
          token.id = dbUser._id.toString();
          token.role = dbUser.role;
          token.name = dbUser.nickname;
        }
      } else if (user) {
        token.role = user.role;
        token.id = user.id;
      }
      if (trigger === 'update' && session?.name) {
        token.name = session.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role;
        session.user.id = token.id;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
  },
};

export async function requireAdmin(): Promise<{ session: Session | null; error: NextResponse | null }> {
  const session = await getServerSession(authOptions);

  if (!session) {
    return {
      session: null,
      error: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }),
    };
  }

  if (session.user.role !== 'admin') {
    return {
      session: null,
      error: NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 }),
    };
  }

  return { session, error: null };
}

export async function requireAuth(): Promise<{ session: Session | null; error: NextResponse | null }> {
  const session = await getServerSession(authOptions);

  if (!session) {
    return {
      session: null,
      error: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }),
    };
  }

  return { session, error: null };
}
