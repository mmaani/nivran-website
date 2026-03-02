import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/guards";
import { ensureRefundTablesSafe } from "@/lib/refundsSchema";
import { createRefundRecord, markRefundFailed, markRefundSucceeded, scheduleRestockAfter48h } from "@/lib/refunds";
import { requestPaytabsRefund } from "@/lib/paytabsRefund";
import { logAdminAudit } from "@/lib/adminAudit";

type JsonRecord = Record<string, unknown>;

function isRecord(v: unknown): v is JsonRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function toNum(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : Number.NaN;
  return Number.isFinite(n) ? n : 0;
}
function toInt(v: unknown): number {
  const n = toNum(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}
function toStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}
function modeToMethod(mode: string): "MANUAL" | "PAYTABS" {
  const s = mode.trim().toUpperCase();
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
  const method = modeToMethod(toStr(body["mode"]));

  if (!(orderId > 0)) return NextResponse.json({ ok: false, error: "orderId is required" }, { status: 400 });
  if (!(amountJod > 0)) return NextResponse.json({ ok: false, error: "amountJod must be > 0" }, { status: 400 });
  if (!idempotencyKey) return NextResponse.json({ ok: false, error: "idempotencyKey is required" }, { status: 400 });

  const prep = await db.withTransaction(async (trx) => {
    const prepared = await createRefundRecord(trx, { orderId, amountJod, reason, method, idempotencyKey });
    if (prepared.created) {
      await logAdminAudit(trx, req, {
        adminId: "admin",
        action: "refund.created",
        entity: "refund",
        entityId: String(prepared.refund.id),
        metadata: { orderId, amountJod, method },
      });
    }
    return prepared;
  });

  if (!prep.created) {
    return NextResponse.json({ ok: true, mode: method, refundId: prep.refund.id, refundStatus: prep.refund.status, reused: true });
  }

  if (method === "MANUAL") {
    return NextResponse.json({ ok: true, mode: "MANUAL", refundId: prep.refund.id, refundStatus: prep.refund.status });
  }

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

  await db.withTransaction(async (trx) => {
    const r = await markRefundSucceeded(trx, {
      refundId: prep.refund.id,
      paytabsRefundReference: null,
      payload: paytabs.payload,
    });
    await scheduleRestockAfter48h(trx, { refundId: prep.refund.id });
    await logAdminAudit(trx, req, {
      adminId: "admin",
      action: "refund.confirmed",
      entity: "refund",
      entityId: String(prep.refund.id),
      metadata: { orderId: r.orderId, mode: "AUTO" },
    });
  });

  return NextResponse.json({ ok: true, mode: "AUTO", refundId: prep.refund.id, paytabs: paytabs.payload });
}
