// Gate /staff behind the Auth.js session cookie (edge-safe: cookie presence
// only — family resolution happens server-side in the staff pages, never in
// middleware, because Prisma cannot run on the edge).
//
// Doc 07 build standard: staff sign-in lives at an unlinked /staff route. No
// public page links here, ever.

import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE_PREFIX = "authjs.session-token";
const SECURE_AUTH_COOKIE_PREFIX = "__Secure-authjs.session-token";

function hasSessionCookie(req: NextRequest): boolean {
  return req.cookies
    .getAll()
    .some((c) => c.name.startsWith(SECURE_AUTH_COOKIE_PREFIX) || c.name.startsWith(AUTH_COOKIE_PREFIX));
}

export function middleware(req: NextRequest) {
  if (!hasSessionCookie(req)) {
    const signInUrl = new URL("/staff/signin", req.url);
    return NextResponse.redirect(signInUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/staff/((?!signin).*)"],
};
