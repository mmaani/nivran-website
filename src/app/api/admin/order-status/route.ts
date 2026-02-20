// src/app/api/admin/order-status/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureOrdersTables, commitInventoryForPaidOrderId } from "@/lib/orders";
import { requireAdmin } from "@/lib/guards";
import { consumePromotionUsage } from "@/lib/promotions";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.trunc(value);
  if (typeof value === "string") {
    const n = Number(value.trim());
    if (Number.isFinite(n) && n > 0) return Math.trunc(n);
  }
  return null;
}

function normalizeStatus(value: unknown): string {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function normalizePaymentMethod(value: unknown): string {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function isAllowedTransition(paymentMethod: string, current: string, next: string): boolean {
  const pm = String(paymentMethod || "").toUpperCase();
  const cur = String(current || "").toUpperCase();
  const nxt = String(next || "").toUpperCase();

  // Always allow cancel
  if (nxt === "CANCELED") return true;

  // PayTabs guardrail: can't ship/deliver unless PAID
  if (pm === "PAYTABS") {
    if ((nxt === "SHIPPED" || nxt === "DELIVERED") && cur !== "PAID") return false;
  }

  // COD flow
  if (pm === "COD") {
    const allowed = new Set([
      "PENDING_COD_CONFIRM",
      "PROCESSING",
      "SHIPPED",
      "DELIVERED",
      "PAID_COD",
      "CANCELED",
    ]);
    if (!allowed.has(nxt)) return false;
  }

  return true;
}

type OrderRow = {
  id: number;
  status: string;
  payment_method: string;
};

type OrderPromoRow = {
  status: string;
  discount_source: string | null;
  promo_code: string | null;
  promotion_id: string | number | null;
  promo_consumed: boolean | null;
};

async function tryCommitInventoryIfPaidById(orderId: number): Promise<void> {
  await db.withTransaction(async (trx) => {
    await commitInventoryForPaidOrderId(trx, orderId);
  });
}

async function tryConsumeCodePromoIfPaidById(orderId: number): Promise<void> {
  await db.withTransaction(async (trx) => {
    const { rows } = await trx.query<OrderPromoRow>(
      `select status, discount_source, promo_code, promotion_id, promo_consumed
         from orders
        where id = $1
        for update`,
      [orderId]
    );

    const row = rows[0];
    if (!row) return;

    const status = String(row.status || "").toUpperCase();
    const isPaid = status === "PAID" || status === "PAID_COD";
    if (!isPaid) return;

    const source = String(row.discount_source || "").toUpperCase();
    if (source !== "CODE") return;

    if (row.promo_consumed === true) return;

    const promotionId = toInt(row.promotion_id);
    if (!promotionId) return;

    const consumed = await consumePromotionUsage(trx, promotionId);

    if (consumed) {
      await trx.query(
        `update orders
            set promo_consumed = true,
                promo_consumed_at = now(),
                promo_consume_failed = false,
                promo_consume_error = null,
                updated_at = now()
          where id = $1`,
        [orderId]
      );
      return;
    }

    await trx.query(
      `update orders
          set promo_consume_failed = true,
              promo_consume_error = 'PROMO_USAGE_LIMIT',
              promo_consumed_at = coalesce(promo_consumed_at, now()),
              updated_at = now()
        where id = $1
          and coalesce(promo_consumed, false) = false`,
      [orderId]
    );
  });
}

export async function POST(req: Request) {
  const auth = requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });

  await ensureOrdersTables();

  const parsed: unknown = await req.json().catch(() => ({}));
  const body = isRecord(parsed) ? parsed : {};

  const id = toInt(body["id"]);
  const nextStatus = normalizeStatus(body["status"]);

  if (!id || !nextStatus) {
    return NextResponse.json({ ok: false, error: "id and status are required" }, { status: 400 });
  }

  const { rows } = await db.query<OrderRow>(
    `select id, status, payment_method
       from orders
      where id = $1`,
    [id]
  );

  if (!rows.length) {
    return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });
  }

  const order = rows[0];
  const current = normalizeStatus(order.status);
  const pm = normalizePaymentMethod(order.payment_method);

  if (!isAllowedTransition(pm, current, nextStatus)) {
    return NextResponse.json(
      { ok: false, error: `Transition not allowed: ${pm} ${current} -> ${nextStatus}` },
      { status: 400 }
    );
  }

  await db.query(`update orders set status = $2, updated_at = now() where id = $1`, [id, nextStatus]);

  if (nextStatus === "PAID" || nextStatus === "PAID_COD") {
    try {
      await tryCommitInventoryIfPaidById(id);
    } catch {
      // ignore
    }
    try {
      await tryConsumeCodePromoIfPaidById(id);
    } catch {
      // ignore
    }
  }

  return NextResponse.json({ ok: true });
}