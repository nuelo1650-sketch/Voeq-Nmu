"use client";

// ---------------------------------------------------------------------------
// Cloudflare Turnstile client widget.
//
// Deliberately quiet: `appearance: "interaction-only"` means a normal
// applicant sees NOTHING — no checkbox, no puzzle — while suspicious traffic
// gets the challenge. If NEXT_PUBLIC_TURNSTILE_SITE_KEY is unset the
// component renders nothing and reports an empty token (dev stays smooth).
//
// Tokens are SINGLE-USE. After a failed submit the server has consumed the
// token, so the caller bumps `resetSignal` and this widget issues a fresh
// one before the next attempt.
// ---------------------------------------------------------------------------

import { useEffect, useRef } from "react";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (id: string) => void;
  reset: (id?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const el = document.createElement("script");
      el.src = SCRIPT_SRC;
      el.async = true;
      el.defer = true;
      el.onload = () => resolve();
      el.onerror = () => {
        scriptPromise = null;
        reject(new Error("turnstile-script-failed"));
      };
      document.head.appendChild(el);
    });
  }
  return scriptPromise;
}

export function TurnstileGate({
  onToken,
  resetSignal,
}: {
  onToken: (token: string) => void;
  resetSignal?: number;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const cb = useRef(onToken);
  cb.current = onToken;

  useEffect(() => {
    if (!SITE_KEY) {
      cb.current("");
      return;
    }
    let cancelled = false;
    loadTurnstileScript()
      .then(() => {
        if (cancelled || !holder.current || !window.turnstile) return;
        widgetId.current = window.turnstile.render(holder.current, {
          sitekey: SITE_KEY,
          appearance: "interaction-only",
          callback: (token: string) => cb.current(token),
          "expired-callback": () => cb.current(""),
          "error-callback": () => cb.current(""),
        });
      })
      .catch(() => cb.current(""));

    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, []);

  // Token reset: a failed submit consumes the old token; request a fresh one.
  useEffect(() => {
    if (resetSignal !== undefined && widgetId.current && window.turnstile) {
      window.turnstile.reset(widgetId.current);
      cb.current("");
    }
  }, [resetSignal]);

  if (!SITE_KEY) return null;

  return (
    <div className="my-3">
      <div ref={holder} />
      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-vq-ink-subtle">
        Protected by Cloudflare Turnstile
      </p>
    </div>
  );
}

export const turnstileClientEnforced = Boolean(SITE_KEY);
