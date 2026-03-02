// src/app/api/admin/refund/confirm/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminOrSales } from "@/lib/guards";
import { ensureRefundTablesSafe } from "@/lib/refundsSchema";
import { markRefundSucceeded, scheduleRestockAfter48h } from "@/lib/refunds";
import { logAdminAudit } from "@/lib/adminAudit";

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


function actorIdFromAuth(auth: { role: "admin" | "sales"; staffId: number | null; username: string | null }): string {
  if (auth.role === "admin") return "admin";
  const sid = typeof auth.staffId === "number" && auth.staffId > 0 ? String(auth.staffId) : "unknown";
  const user = auth.username || "sales";
  return `sales:${sid}:${user}`;
}

export async function POST(req: Request) {
  const auth = requireAdminOrSales(req);
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
    await scheduleRestockAfter48h(trx, { refundId });
    await logAdminAudit(trx, req, { adminId: actorIdFromAuth(auth), action: "refund.confirmed", entity: "refund", entityId: String(refundId), metadata: { orderId: r.orderId } });
    return r;
  });

  return NextResponse.json({ ok: true, orderId: result.orderId, refundId });
}