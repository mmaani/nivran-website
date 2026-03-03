// src/app/api/admin/refund/confirm/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/guards";
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
function clampMoneyJod(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.round(v * 100) / 100;
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
  const amountRaw = toNum(body["amountJod"]);
  const amountJod = clampMoneyJod(amountRaw);
  const refundKind = toStr(body["refundKind"]).trim().toUpperCase() || "FULL";
  const amountInputMode = toStr(body["amountInputMode"]).trim().toUpperCase() || "AMOUNT";
  const amountInputValue = toNum(body["amountInputValue"]);

  if (!(refundId > 0)) return NextResponse.json({ ok: false, error: "refundId is required" }, { status: 400 });
  if (!(amountJod > 0)) return NextResponse.json({ ok: false, error: "amountJod must be > 0" }, { status: 400 });

  try {
    const result = await db.withTransaction(async (trx) => {
      const meta = await trx.query<{ order_id: number; order_total_jod: string }>(
        `select r.order_id, coalesce(o.total_jod, o.amount::numeric)::text as order_total_jod
           from refunds r
           join orders o on o.id = r.order_id
          where r.id = $1
          for update`,
        [refundId]
      );
      const row = meta.rows[0];
      if (!row) throw new Error("REFUND_NOT_FOUND");
      const orderTotal = clampMoneyJod(Number(row.order_total_jod || "0"));
      if (!(orderTotal > 0)) throw new Error("ORDER_TOTAL_INVALID");
      if (amountJod > orderTotal) throw new Error("REFUND_AMOUNT_EXCEEDS_ORDER_TOTAL");

      await trx.query(`update refunds set amount_jod = $2 where id = $1`, [refundId, amountJod]);
      const r = await markRefundSucceeded(trx, {
        refundId,
        paytabsRefundReference: null,
        payload: {
          manual_note: note,
          amount_jod: amountJod,
          refund_kind: refundKind,
          amount_input_mode: amountInputMode,
          amount_input_value: amountInputValue,
        },
      });
      await scheduleRestockAfter48h(trx, { refundId });
      await logAdminAudit(trx, req, {
        adminId: "admin",
        action: "refund.confirmed",
        entity: "refund",
        entityId: String(refundId),
        metadata: { orderId: r.orderId, amountJod, refundKind, amountInputMode, amountInputValue },
      });
      return r;
    });

    return NextResponse.json({ ok: true, orderId: result.orderId, refundId, amountJod, refundKind });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "REFUND_CONFIRM_FAILED";
    if (message === "REFUND_NOT_FOUND") {
      return NextResponse.json({ ok: false, error: message }, { status: 404 });
    }
    if (message === "REFUND_AMOUNT_EXCEEDS_ORDER_TOTAL" || message === "ORDER_TOTAL_INVALID") {
      return NextResponse.json({ ok: false, error: message }, { status: 409 });
    }
    if (message.startsWith("REFUND_INVALID_TRANSITION_") || message === "REFUND_TRANSITION_REJECTED") {
      return NextResponse.json({ ok: false, error: message }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
