// src/lib/refunds.ts
import "server-only";
import type { DbTx } from "@/lib/db";

export type RefundStatus =
  | "PREPARED"
  | "REQUESTED"
  | "SUCCEEDED"
  | "FAILED"
  | "MANUAL_REQUIRED";

export type RestockPolicy = "IMMEDIATE" | "DELAYED";

export type CreateRefundInput = {
  orderId: number;
  amountJod: number;
  reason: string;
  idempotencyKey: string;
  refundMethod: "PAYTABS" | "MANUAL";
  restockPolicy: RestockPolicy;
};

export type RefundPrepared = {
  refundId: number;
  orderId: number;
  cartId: string | null;
  paymentMethod: string | null;
  paytabsTranRef: string | null;
  restockPolicy: RestockPolicy;
  restockAt: string | null;
};

type OrderForRefund = {
  id: number;
  cart_id: string | null;
  status: string;
  payment_method: string | null;
  paytabs_tran_ref: string | null;
  refunded_amount_jod: string | number | null;
  amount: string | number | null;
  items: unknown;
  inventory_committed_at: string | null;
};

function toNum(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function addDaysIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

export async function createRefundRecord(trx: DbTx, input: CreateRefundInput): Promise<RefundPrepared> {
  const { orderId, amountJod, reason, idempotencyKey, refundMethod, restockPolicy } = input;

  // Lock the order row
  const orderRes = await trx.query<OrderForRefund>(
    `select id, cart_id, status, payment_method, paytabs_tran_ref,
            refunded_amount_jod, amount, items, inventory_committed_at
       from orders
      where id = $1
      for update`,
    [orderId]
  );

  const order = orderRes.rows[0];
  if (!order) throw new Error("ORDER_NOT_FOUND");

  const orderTotal = toNum(order.amount);
  const alreadyRefunded = toNum(order.refunded_amount_jod);

  if (!(amountJod > 0)) throw new Error("AMOUNT_INVALID");
  if (amountJod + alreadyRefunded > orderTotal + 0.00001) throw new Error("REFUND_EXCEEDS_ORDER_TOTAL");

  // For PayTabs refunds, we require tran_ref
  const paytabsTranRef = (order.paytabs_tran_ref || "").trim() || null;
  if (refundMethod === "PAYTABS" && !paytabsTranRef) {
    throw new Error("MISSING_PAYTABS_TRAN_REF");
  }

  const restockAt =
    restockPolicy === "IMMEDIATE" ? new Date().toISOString() : addDaysIso(2);

  // Insert (idempotent)
  const ins = await trx.query<{ id: string }>(
    `insert into refunds
      (order_id, cart_id, payment_method, refund_method, amount_jod, reason,
       idempotency_key, status, paytabs_tran_ref, restock_policy, restock_at, updated_at)
     values
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now())
     on conflict (order_id, idempotency_key)
     do update set updated_at = now()
     returning id`,
    [
      orderId,
      order.cart_id,
      order.payment_method,
      refundMethod,
      amountJod,
      reason,
      idempotencyKey,
      refundMethod === "MANUAL" ? "MANUAL_REQUIRED" : "PREPARED",
      paytabsTranRef,
      restockPolicy,
      restockAt,
    ]
  );

  const refundId = Number(ins.rows[0]?.id || 0);
  if (!refundId) throw new Error("REFUND_INSERT_FAILED");

  // Mark order refund status (for admin UI)
  await trx.query(
    `update orders
        set refund_status = $2,
            refund_updated_at = now(),
            updated_at = now()
      where id = $1`,
    [orderId, refundMethod === "MANUAL" ? "MANUAL_REQUIRED" : "REFUND_PENDING"]
  );

  return {
    refundId,
    orderId,
    cartId: order.cart_id || null,
    paymentMethod: order.payment_method || null,
    paytabsTranRef,
    restockPolicy,
    restockAt,
  };
}

export async function markRefundRequested(trx: DbTx, refundId: number): Promise<void> {
  await trx.query(
    `update refunds
        set status = 'REQUESTED',
            updated_at = now()
      where id = $1`,
    [refundId]
  );
}

export async function markRefundFailed(trx: DbTx, refundId: number, message: string, payload: unknown): Promise<void> {
  await trx.query(
    `update refunds
        set status = 'FAILED',
            error_message = $2,
            provider_payload = $3::jsonb,
            updated_at = now()
      where id = $1`,
    [refundId, message || "Refund failed", JSON.stringify(payload ?? {})]
  );
}

export async function markRefundSucceeded(trx: DbTx, refundId: number, providerStatus: string, providerMessage: string, payload: unknown): Promise<void> {
  await trx.query(
    `update refunds
        set status = 'SUCCEEDED',
            provider_status = $2,
            provider_message = $3,
            provider_payload = $4::jsonb,
            updated_at = now()
      where id = $1`,
    [refundId, providerStatus || "", providerMessage || "", JSON.stringify(payload ?? {})]
  );
}

type RefundRowForRestock = {
  id: number;
  order_id: number;
  status: string;
  restock_at: string | null;
  restocked_at: string | null;
};

type OrderItemsRow = {
  id: number;
  items: unknown;
};

type ProductRow = {
  id: number;
  inventory_qty: number | null;
};

// Extract deltas from your existing order items format
function extractDeltas(items: unknown): Array<{ productId: number; qty: number }> {
  if (!Array.isArray(items)) return [];
  const out: Array<{ productId: number; qty: number }> = [];
  for (const it of items) {
    if (!it || typeof it !== "object") continue;
    const row = it as Record<string, unknown>;
    const pidRaw = row.productId ?? row.product_id ?? row.id;
    const qtyRaw = row.requested_qty ?? row.qty ?? 1;
    const pid = typeof pidRaw === "number" ? Math.trunc(pidRaw) : typeof pidRaw === "string" ? Math.trunc(Number(pidRaw)) : 0;
    const qty = typeof qtyRaw === "number" ? Math.trunc(qtyRaw) : typeof qtyRaw === "string" ? Math.trunc(Number(qtyRaw)) : 0;
    if (pid > 0 && qty > 0) out.push({ productId: pid, qty });
  }
  return out;
}

// Restock due refunds (run manually or via cron later)
export async function restockDueRefunds(trx: DbTx, nowIso: string): Promise<{ restocked: number }> {
  const due = await trx.query<RefundRowForRestock>(
    `select id, order_id, status, restock_at, restocked_at
       from refunds
      where status = 'SUCCEEDED'
        and restocked_at is null
        and restock_at is not null
        and restock_at <= $1::timestamptz
      order by id asc
      for update`,
    [nowIso]
  );

  let restocked = 0;

  for (const r of due.rows) {
    const orderRes = await trx.query<OrderItemsRow>(
      `select id, items
         from orders
        where id = $1
        for update`,
      [r.order_id]
    );

    const order = orderRes.rows[0];
    if (!order) continue;

    const deltas = extractDeltas(order.items);

    for (const d of deltas) {
      // Lock product row then add back qty
      const p = await trx.query<ProductRow>(
        `select id, inventory_qty
           from products
          where id = $1
          for update`,
        [d.productId]
      );
      if (!p.rows.length) continue;

      await trx.query(
        `update products
            set inventory_qty = coalesce(inventory_qty, 0) + $2
          where id = $1`,
        [d.productId, d.qty]
      );
    }

    await trx.query(
      `update refunds
          set restocked_at = now(),
              updated_at = now()
        where id = $1
          and restocked_at is null`,
      [r.id]
    );

    restocked += 1;
  }

  return { restocked };
}