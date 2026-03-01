// src/app/api/admin/refund/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/guards";
import { ensureRefundTablesSafe } from "@/lib/refundsSchema";
import { createRefundRecord, markRefundFailed, markRefundSucceeded, scheduleRestockAfter48h } from "@/lib/refunds";
import { requestPaytabsRefund } from "@/lib/paytabsRefund";

type JsonRecord = Record<string, unknown>;
function isRecord(v: unknown): v is JsonRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function toStr(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function toNum(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : 0;
}

function toInt(v: unknown): number {
  const n = toNum(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function modeToMethod(modeRaw: unknown): "PAYTABS" | "MANUAL" {
  const s = toStr(modeRaw).trim().toUpperCase();
  return s === "MANUAL" ? "MANUAL" : "PAYTABS";
}

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  await ensureRefundTablesSafe();

  const parsed: unknown = await req.json().catch(() => ({}));
  const body = isRecord(parsed) ? parsed : {};

  const orderId = toInt(body["orderId"]);
  const amountJod = toNum(body["amountJod"]);
  const reason = toStr(body["reason"]);
  const idempotencyKey = toStr(body["idempotencyKey"]);
  const mode = toStr(body["mode"]);
  const method = modeToMethod(mode);

  if (!(orderId > 0)) return NextResponse.json({ ok: false, error: "orderId is required" }, { status: 400 });
  if (!(amountJod > 0)) return NextResponse.json({ ok: false, error: "amountJod must be > 0" }, { status: 400 });
  if (!idempotencyKey) return NextResponse.json({ ok: false, error: "idempotencyKey is required" }, { status: 400 });

  // Phase 1: create refund row idempotently + move order to REFUND_PENDING
  const prep = await db.withTransaction(async (trx) => {
    return createRefundRecord(trx, {
      orderId,
      amountJod,
      reason,
      method,
      idempotencyKey,
    });
  });

  // Manual: no PayTabs call. Keep refund PENDING until confirm endpoint.
  if (method === "MANUAL") {
    return NextResponse.json({
      ok: true,
      mode: "MANUAL",
      refundId: prep.refund.id,
      refundStatus: prep.refund.status,
    });
  }

  // Auto PayTabs refund
  const tranRef = prep.refund.paytabs_tran_ref || "";
  const paytabs = await requestPaytabsRefund({ tranRef, amountJod, reason });

  if (!paytabs.ok) {
    await db.withTransaction(async (trx) => {
      await markRefundFailed(trx, {
        refundId: prep.refund.id,
        message: paytabs.message || "PayTabs refund failed",
        payload: paytabs.payload,
      });
    });

    return NextResponse.json(
      { ok: false, error: paytabs.message || "PayTabs refund failed", refundId: prep.refund.id, paytabs: paytabs.payload },
      { status: 502 }
    );
  }

  // Success: mark SUCCEEDED + order REFUNDED + schedule restock +48h
  await db.withTransaction(async (trx) => {
    const r = await markRefundSucceeded(trx, {
      refundId: prep.refund.id,
      paytabsRefundReference: null,
      payload: paytabs.payload,
    });
    await scheduleRestockAfter48h(trx, { orderId: r.orderId, refundId: prep.refund.id });
  });

  return NextResponse.json({
    ok: true,
    mode: "AUTO",
    refundId: prep.refund.id,
    paytabs: paytabs.payload,
  });
}