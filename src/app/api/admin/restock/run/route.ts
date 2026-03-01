// src/app/api/admin/restock/run/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/guards";
import { ensureRefundTablesSafe } from "@/lib/refundsSchema";
import { runDueRestocks } from "@/lib/refunds";

type JsonRecord = Record<string, unknown>;
function isRecord(v: unknown): v is JsonRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function toNum(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : 0;
}
function toInt(v: unknown): number {
  const n = toNum(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  await ensureRefundTablesSafe();

  const parsed: unknown = await req.json().catch(() => ({}));
  const body = isRecord(parsed) ? parsed : {};
  const limit = Math.max(1, Math.min(200, toInt(body["limit"] ?? 50)));

  const result = await db.withTransaction(async (trx) => runDueRestocks(trx, { limit }));

  return NextResponse.json(result);
}