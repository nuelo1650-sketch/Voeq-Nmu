// ---------------------------------------------------------------------------
// Auth.js v5 — Google OAuth ONLY for staff (doc 07 §4.7). No passwords exist
// anywhere in the system. Sign-in is denied unless:
//   1. Google has verified the email, AND
//   2. the email is on exactly one family allowlist (platform or register).
// On first sign-in the StaffAccount row is created with the resolved family.
// The account email is the audit identity for every action the account takes.
// ---------------------------------------------------------------------------

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import type { Provider } from "next-auth/providers";
import type { JWT } from "@auth/core/jwt";
import { prisma } from "@voeq/db";
import { familyForEmail } from "@/lib/allowlist";

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

      const family = familyForEmail(email);
      if (!family) return false; // not allowlisted, or on both lists

      try {
        // Role-based, not person-bound (doc 07 §4.6): the account is created
        // with its family on first sign-in; privileges are separate RoleGrant
        // rows, each grant/revocation itself audited.
        await prisma.staffAccount.upsert({
          where: { email },
          update: { lastLoginAt: new Date(), name: user.name ?? undefined },
          create: {
            email,
            name: user.name ?? null,
            family,
            lastLoginAt: new Date(),
          },
        });
        // TODO(Phase 1): writeAudit("staff.signed_in") once the app role has
        // insert grants (prisma/sql/audit-immutable.sql applies with the DB).
        return true;
      } catch (err) {
        // Database unreachable — fail closed. Never open the admin without
        // being able to record identity.
        console.error("[auth] staff account upsert failed:", err);
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
