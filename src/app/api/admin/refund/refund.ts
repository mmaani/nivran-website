// src/app/api/admin/refund/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/guards";
import { ensureRefundTablesSafe } from "@/lib/refundsSchema";
import {
  createRefundRecord,
  markRefundFailed,
  markRefundRequested,
  markRefundSucceeded,
  restockDueRefunds,
  type RestockPolicy,
} from "@/lib/refunds";
import { requestPaytabsRefund } from "@/lib/paytabsRefund";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toInt(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return Math.trunc(v);
  if (typeof v === "string") {
    const n = Number(v.trim());
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
  }
  return null;
}

function toNum(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : 0;
}

function toStr(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function toRestockPolicy(v: unknown): RestockPolicy {
  const s = toStr(v).trim().toUpperCase();
  return s === "IMMEDIATE" ? "IMMEDIATE" : "DELAYED";
}

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  await ensureRefundTablesSafe();

  const parsed: unknown = await req.json().catch(() => ({}));
  const body = isRecord(parsed) ? parsed : {};

  const orderId = toInt(body["orderId"] ?? body["id"]);
  const amountJod = toNum(body["amountJod"] ?? body["amount"]);
  const reason = toStr(body["reason"]);
  const idempotencyKey = toStr(body["idempotencyKey"] ?? body["idemKey"] ?? "admin_manual");
  const refundMethod = toStr(body["refundMethod"] ?? "PAYTABS").trim().toUpperCase() === "MANUAL" ? "MANUAL" : "PAYTABS";
  const restockPolicy = toRestockPolicy(body["restockPolicy"] ?? "DELAYED");

  if (!orderId) return NextResponse.json({ ok: false, error: "orderId is required" }, { status: 400 });
  if (!(amountJod > 0)) return NextResponse.json({ ok: false, error: "amountJod must be > 0" }, { status: 400 });
  if (!idempotencyKey) return NextResponse.json({ ok: false, error: "idempotencyKey is required" }, { status: 400 });

  // Phase 1: prepare refund record (idempotent)
  const prep = await db.withTransaction(async (trx) => {
    return createRefundRecord(trx, {
      orderId,
      amountJod,
      reason,
      idempotencyKey,
      refundMethod,
      restockPolicy,
    });
  });

  // Manual refunds: no PayTabs call
  if (refundMethod === "MANUAL") {
    return NextResponse.json({
      ok: true,
      refundId: prep.refundId,
      mode: "MANUAL_REQUIRED",
      restockPolicy: prep.restockPolicy,
      restockAt: prep.restockAt,
    });
  }

  // Phase 2: PayTabs refund request
  const paytabs = await requestPaytabsRefund({
    tranRef: prep.paytabsTranRef || "",
    amountJod,
    reason,
  });

  if (!paytabs.ok) {
    await db.withTransaction(async (trx) => {
      await markRefundFailed(trx, prep.refundId, paytabs.message || "Refund failed", paytabs.payload);
    });
    return NextResponse.json(
      { ok: false, error: paytabs.message || "Refund failed", refundId: prep.refundId, paytabs: paytabs.payload },
      { status: 502 }
    );
  }

  // Mark requested + succeeded (some PayTabs accounts return success synchronously)
  await db.withTransaction(async (trx) => {
    await markRefundRequested(trx, prep.refundId);
    await markRefundSucceeded(trx, prep.refundId, paytabs.status, paytabs.message, paytabs.payload);
  });

  return NextResponse.json({
    ok: true,
    refundId: prep.refundId,
    restockPolicy: prep.restockPolicy,
    restockAt: prep.restockAt,
    paytabs: paytabs.payload,
  });
}

// Optional helper endpoint to run restocks manually from admin tools
export async function PUT(req: Request) {
  const auth = requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  await ensureRefundTablesSafe();

  const nowIso = new Date().toISOString();
  const result = await db.withTransaction(async (trx) => restockDueRefunds(trx, nowIso));

  return NextResponse.json({ ok: true, ...result });
}