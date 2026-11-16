"use client";

import { signIn } from "next-auth/react";

export default function StaffSignInPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <div className="rounded-2xl border border-vq-forest/10 bg-white p-8 shadow-sm">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-vq-amber-dark">
          Staff access
        </p>
        <h1 className="mt-3 font-display text-2xl text-vq-forest-dark">
          Sign in to the register desk
        </h1>
        <p className="mt-3 text-sm text-vq-ink-muted">
          Staff sign in with Google only. Your account must be on the
          University&apos;s allowlist — there are no passwords here, on purpose.
        </p>
        <button
          onClick={() => signIn("google", { callbackUrl: "/staff" })}
          className="mt-6 w-full bg-vq-forest px-5 py-3 text-sm font-semibold text-vq-glass shadow-md transition hover:bg-vq-forest-mid"
        >
          Continue with Google
        </button>
        <p className="mt-4 text-xs text-vq-ink-subtle">
          Every sign-in and every action inside is recorded against your Google
          account email. The log cannot be deleted.
        </p>
      </div>
    </main>
  );
}
