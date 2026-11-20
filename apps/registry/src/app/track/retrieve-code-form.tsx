"use client";

// The registration-number retrieval form (Kai: "easily retrievable if
// lost"). Same honest silence as the access-link form: whether or not the
// reference+email pair matches a registered business, the page says the same
// thing — the number itself only ever travels by email, to the address on
// record.

import { useState } from "react";
import { TurnstileGate, turnstileClientEnforced } from "@/components/turnstile-widget";

export function RetrieveCodeForm() {
  const [reference, setReference] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);

  async function request() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/track/retrieve-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference,
          email,
          turnstileToken: turnstileToken || undefined,
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Something went wrong");
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setTurnstileToken("");
      setTurnstileReset((n) => n + 1);
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="py-2 text-center">
        <p className="font-display text-xl text-vq-forest-dark">Check your email.</p>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-vq-ink-muted">
          If the reference and email match a registered business, the
          registration number is on its way to the address on record.
        </p>
        <button
          onClick={() => {
            setSent(false);
            setReference("");
            setEmail("");
            setTurnstileToken("");
            setTurnstileReset((n) => n + 1);
          }}
          className="mt-4 border border-vq-forest/25 bg-white/60 px-4 py-2 text-xs font-semibold text-vq-forest transition hover:bg-white"
        >
          Request it again
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (reference.trim() && email.trim()) void request();
      }}
    >
      <label className="mb-1.5 block text-sm font-semibold text-vq-forest-dark">
        Your reference
      </label>
      <input
        value={reference}
        onChange={(e) => setReference(e.target.value.toUpperCase())}
        placeholder="NMU-2026-0001"
        className="w-full border border-vq-forest/20 bg-white px-4 py-3 font-mono text-[15px] tracking-wide text-vq-ink placeholder:text-vq-ink-subtle focus:border-vq-forest focus:outline-none"
      />
      <label className="mb-1.5 mt-4 block text-sm font-semibold text-vq-forest-dark">
        The email you applied with
      </label>
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        type="email"
        inputMode="email"
        placeholder="you@example.com"
        className="w-full border border-vq-forest/20 bg-white px-4 py-3 text-[15px] text-vq-ink placeholder:text-vq-ink-subtle focus:border-vq-forest focus:outline-none"
      />
      {turnstileClientEnforced && (
        <TurnstileGate onToken={setTurnstileToken} resetSignal={turnstileReset} />
      )}
      {error && (
        <p className="mt-3 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={!reference.trim() || !email.includes("@") || busy || (turnstileClientEnforced && !turnstileToken)}
        className="mt-5 w-full bg-vq-forest px-5 py-3.5 text-sm font-semibold text-white shadow-md transition enabled:cursor-pointer enabled:hover:bg-vq-forest-mid disabled:opacity-40"
      >
        {busy ? "Sending…" : "Email me my registration number"}
      </button>
      <p className="mt-2 text-xs text-vq-ink-subtle">
        The number is only sent to the email already on record — never shown on
        this page, and never to anyone else.
      </p>
    </form>
  );
}
