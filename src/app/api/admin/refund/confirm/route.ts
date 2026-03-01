// src/app/api/admin/refund/confirm/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/guards";
import { ensureRefundTablesSafe } from "@/lib/refundsSchema";
import { markRefundSucceeded, scheduleRestockAfter48h } from "@/lib/refunds";

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
function toStr(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  await ensureRefundTablesSafe();

  const parsed: unknown = await req.json().catch(() => ({}));
  const body = isRecord(parsed) ? parsed : {};

  const refundId = toInt(body["refundId"]);
  const note = toStr(body["note"]);

  if (!(refundId > 0)) return NextResponse.json({ ok: false, error: "refundId is required" }, { status: 400 });

  const result = await db.withTransaction(async (trx) => {
    const r = await markRefundSucceeded(trx, {
      refundId,
      paytabsRefundReference: null,
      payload: { manual_note: note },
    });
    await scheduleRestockAfter48h(trx, { orderId: r.orderId, refundId });
    return r;
  });

  return NextResponse.json({ ok: true, orderId: result.orderId, refundId });
}