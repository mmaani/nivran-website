import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureOrdersTables } from "@/lib/orders";
import { requireAdmin } from "@/lib/guards";
import { consumePromotionUsage } from "@/lib/promotions";

export const runtime = "nodejs";

function isAllowedTransition(paymentMethod: string, current: string, next: string) {
  const pm = String(paymentMethod || "").toUpperCase();

  // PayTabs guardrail: can't ship unless PAID
  if (pm === "PAYTABS") {
    if ((next === "SHIPPED" || next === "DELIVERED") && current !== "PAID") return false;
  }

  // COD recommended flow
  if (pm === "COD") {
    const allowed = new Set([
      "PENDING_COD_CONFIRM",
      "PROCESSING",
      "SHIPPED",
      "DELIVERED",
      "PAID_COD",
      "CANCELED",
    ]);
    if (!allowed.has(next)) return false;
  }

  return true;
}


type OrderPromoRow = {
  cart_id: string;
  status: string;
  discount_source: string | null;
  promo_code: string | null;
  promotion_id: string | number | null;
  promo_consumed: boolean | null;
};

function toInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.trunc(value);
  if (typeof value === "string") {
    const n = Number(value.trim());
    if (Number.isFinite(n) && n > 0) return Math.trunc(n);
  }
  return null;
}

async function tryConsumeCodePromoIfPaidById(orderId: number): Promise<void> {
  await db.withTransaction(async (trx) => {
    const { rows } = await trx.query<OrderPromoRow>(
      `select cart_id, status, discount_source, promo_code, promotion_id, promo_consumed
         from orders
        where id = $1
        for update`,
      [orderId]
    );

    const order = rows[0];
    if (!order) return;

    const status = String(order.status || "").toUpperCase();
    const isPaid = status === "PAID" || status === "PAID_COD";
    if (!isPaid) return;

    const source = String(order.discount_source || "").toUpperCase();
    if (source !== "CODE") return;

    if (order.promo_consumed === true) return;

    const promotionId = toInt(order.promotion_id);
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
          and promo_consumed = false`,
      [orderId]
    );
  });
}

export async function POST(req: Request) {
  const auth = requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
  await ensureOrdersTables();
  const body = (await req.json().catch(() => ({}))) as { id?: number | string; status?: string };
  const id = Number(body?.id);
  const nextStatus = String(body?.status || "");

  if (!id || !nextStatus) {
    return NextResponse.json({ ok: false, error: "id and status are required" }, { status: 400 });
  }

  const pool = db;
  const { rows } = await pool.query(
    `select id, status, payment_method from orders where id=$1`,
    [id]
  );
  if (!rows.length) {
    return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });
  }

  const order = rows[0];
  const current = String(order.status || "");
  const pm = String(order.payment_method || "");

  if (!isAllowedTransition(pm, current, nextStatus)) {
    return NextResponse.json(
      { ok: false, error: `Transition not allowed: ${pm} ${current} -> ${nextStatus}` },
      { status: 400 }
    );
  }

  await pool.query(
    `update orders set status=$2, updated_at=now() where id=$1`,
    [id, nextStatus]
  );

  if (nextStatus === "PAID_COD" || nextStatus === "PAID") {
    try {
      await tryConsumeCodePromoIfPaidById(id);
    } catch {
      // ignore
    }
  }

  return NextResponse.json({ ok: true });
}
