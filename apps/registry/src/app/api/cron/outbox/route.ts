// Secret-protected outbox sweep — the backstop for the inline after() drains
// (see lib/outbox-drain.ts). Vercel Cron hits this on a schedule (vercel.json)
// and automatically sends `Authorization: Bearer $CRON_SECRET` when the env
// var is set. Auth fails CLOSED: without CRON_SECRET configured this is 401 —
// never an open email pump.

import { NextResponse } from "next/server";
import { drainOutbox } from "@/lib/outbox-drain";

export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  const header = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  return key === secret || header === secret;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await drainOutbox();
  return NextResponse.json({ ok: true });
}
