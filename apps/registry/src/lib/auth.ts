// ---------------------------------------------------------------------------
// Auth.js v5 — Google OAuth ONLY for staff (doc 07 §4.7). No passwords exist
// anywhere in the system.
//
// The DOOR is the StaffAccount row, not an env allowlist (Kai, 2026-11-19:
// adding a staff member required editing env vars on Vercel — unacceptable
// friction, and the accounts console already mints accounts). Sign-in flow:
//   1. Google verifies the email (identity).
//   2. If a StaffAccount row exists for that email, its family rides the
//      session and lastLogin is recorded.
//   3. If no row exists, sign-in still succeeds but the session carries NO
//      family and NO account id — every desk gate refuses, and the staff
//      pages say honestly: "ask a super admin to create your account".
// Privileges come from RoleGrant rows; activation is the admin's switch.
// ---------------------------------------------------------------------------

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import type { Provider } from "next-auth/providers";
import type { JWT } from "@auth/core/jwt";
import { prisma } from "@voeq/db";

import type { AdminFamily } from "@voeq/core";

declare module "next-auth" {
  interface Session {
    user: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      family?: AdminFamily;
      staffAccountId?: string;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    family?: AdminFamily;
    staffAccountId?: string;
  }
}

// Auth.js v5's Google provider defaults to AUTH_GOOGLE_ID/AUTH_GOOGLE_SECRET.
// Our credentials live in GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET (one canonical
// place, used by dev and Vercel) — pass them explicitly or Google sees an
// empty client_id and answers 401 invalid_client. (Found at first real sign-in.)
const providers: Provider[] = [
  Google({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  }),
];

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user }) {
      const email = user.email?.trim().toLowerCase();
      if (!email) return false;

      // Deny only when Google explicitly says the address is unverified.
      const verified = (user as { emailVerified?: unknown }).emailVerified;
      if (verified === false) return false;

      try {
        // The account row is the door (see header note). No row → the session
        // carries no authority and the desks explain what to do. An existing
        // row gets its lastLogin recorded; nothing is auto-created.
        await prisma.staffAccount.updateMany({
          where: { email },
          data: { lastLoginAt: new Date() },
        });
        return true;
      } catch (err) {
        // Database unreachable — fail closed. Never open the admin without
        // being able to record identity.
        console.error("[auth] staff account lookup failed:", err);
        return false;
      }
    },

    async jwt({ token, user }): Promise<JWT> {
      if (user?.email) {
        const account = await prisma.staffAccount
          .findUnique({ where: { email: user.email.toLowerCase() } })
          .catch(() => null);
        if (account) {
          token.family = account.family;
          token.staffAccountId = account.id;
        }
      }
      return token;
    },

    async session({ session, token }) {
      session.user.family = token.family;
      session.user.staffAccountId = token.staffAccountId;
      return session;
    },
  },
});
