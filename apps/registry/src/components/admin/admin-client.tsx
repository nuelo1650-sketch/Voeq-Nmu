"use client";

// Shared primitives for the super-admin screens. Grammar rules from the
// workbench carry over: status is WORDS in mono uppercase — never pills;
// blocks are ruled, not shadowed; buttons are sharp rectangles.

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

export type AdminActionInput = Record<string, unknown> & { op: string };

export function useAdminAction(dev: boolean) {
  const router = useRouter();
  const [busyOp, setBusyOp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  async function run(action: AdminActionInput, okMessage?: string): Promise<boolean> {
    setBusyOp(action.op);
    setError(null);
    setFlash(null);
    try {
      const res = await fetch(dev ? "/api/dev/admin/action" : "/api/admin/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error ?? "The action failed");
      if (okMessage) setFlash(okMessage);
      router.refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      return false;
    } finally {
      setBusyOp(null);
    }
  }

  return { run, busyOp, error, flash, setError };
}

export function ActionFeedback({
  error,
  flash,
}: {
  error: string | null;
  flash: string | null;
}) {
  if (!error && !flash) return null;
  return error ? (
    <p className="mt-2 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
  ) : (
    <p className="mt-2 border border-vq-forest/20 bg-white px-3 py-2 text-sm text-vq-forest">{flash}</p>
  );
}

export function MonoButton({
  onClick,
  disabled,
  children,
  tone = "default",
  title,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
  tone?: "default" | "danger" | "confirm";
  title?: string;
}) {
  const toneCls =
    tone === "danger"
      ? "border-red-300 text-red-800 hover:border-red-600"
      : tone === "confirm"
        ? "border-vq-forest bg-vq-forest text-white hover:bg-vq-forest-dark"
        : "border-vq-forest/25 text-vq-forest hover:border-vq-forest";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`border bg-white px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] transition enabled:cursor-pointer disabled:opacity-40 ${toneCls}`}
    >
      {children}
    </button>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  mono,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full border border-vq-forest/20 bg-white px-3 py-1.5 text-sm text-vq-ink placeholder:text-vq-ink-subtle focus:border-vq-forest focus:outline-none ${
        mono ? "font-mono text-xs" : ""
      }`}
    />
  );
}

export function SectionHeading({ children, note }: { children: ReactNode; note?: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-vq-ink-subtle">
        {children}
      </h3>
      {note && <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-vq-ink-subtle">{note}</p>}
    </div>
  );
}

export function StatusWord({ status }: { status: string }) {
  const cls =
    status === "active" || status === "synced"
      ? "text-vq-forest"
      : status === "suspended" || status === "pending"
        ? "text-vq-amber-dark"
        : status === "failed"
          ? "text-red-700"
          : "text-neutral-400";
  return (
    <span className={`font-mono text-[11px] font-semibold uppercase tracking-[0.14em] ${cls}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
