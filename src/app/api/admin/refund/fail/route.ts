// src/app/api/admin/refund/fail/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/guards";
import { ensureRefundTablesSafe } from "@/lib/refundsSchema";
import { markRefundFailed } from "@/lib/refunds";
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

export async function POST(req: Request) {
  const auth = requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  await ensureRefundTablesSafe();

  const parsed: unknown = await req.json().catch(() => ({}));
  const body = isRecord(parsed) ? parsed : {};

  const refundId = toInt(body["refundId"]);
  const message = toStr(body["message"]) || "Manual refund failed";

  if (!(refundId > 0)) return NextResponse.json({ ok: false, error: "refundId is required" }, { status: 400 });

  try {
    await db.withTransaction(async (trx) => {
      await markRefundFailed(trx, { refundId, message, payload: { manual_fail: true } });
      await logAdminAudit(trx, req, {
        adminId: "admin",
        action: "refund.failed",
        entity: "refund",
        entityId: String(refundId),
        metadata: { message },
      });
    });

    return NextResponse.json({ ok: true, refundId });
  } catch (error: unknown) {
    const err = error instanceof Error ? error.message : "REFUND_FAIL_UPDATE_FAILED";
    if (err === "REFUND_NOT_FOUND") return NextResponse.json({ ok: false, error: err }, { status: 404 });
    if (err.startsWith("REFUND_INVALID_TRANSITION_") || err === "REFUND_TRANSITION_REJECTED") {
      return NextResponse.json({ ok: false, error: err }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: err }, { status: 500 });
  }
}
