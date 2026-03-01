// src/lib/refunds.ts
import "server-only";
import type { DbTx } from "@/lib/db";

export type OrderRefundStatus =
  | "REFUND_REQUESTED"
  | "REFUND_PENDING"
  | "REFUNDED"
  | "REFUND_FAILED";

export type RefundMethod = "PAYTABS" | "MANUAL";

export type RefundRow = {
  id: number;
  order_id: number;
  method: RefundMethod;
  amount_jod: string | number;
  currency: string;
  reason: string | null;
  idempotency_key: string;
  status: "PENDING" | "SUCCEEDED" | "FAILED";
  paytabs_tran_ref: string | null;
  paytabs_refund_reference: string | null;
  requested_at: string;
  succeeded_at: string | null;
  failed_at: string | null;
  last_error: string | null;
  payload: unknown;
};

type OrderForRefund = {
  id: number;
  status: string;
  payment_method: string;
  paytabs_tran_ref: string | null;
  items: unknown;
  inventory_committed_at: string | null;
};

type RestockJobRow = {
  id: number;
  order_id: number;
  refund_id: number;
  status: string;
  run_at: string;
  attempts: number;
};

type ProductRow = {
  id: number;
  slug: string;
  inventory_qty: number | null;
};

type JsonRecord = Record<string, unknown>;

function isRecord(v: unknown): v is JsonRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function toNum(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function toInt(v: unknown): number {
  const n = toNum(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function nowPlusHoursIso(hours: number): string {
  const d = new Date();
  d.setUTCHours(d.getUTCHours() + hours);
  return d.toISOString();
}

function normalizeStatus(s: unknown): string {
  return String(s || "").trim().toUpperCase();
}

function isRefundableOrderStatus(status: string): boolean {
  const s = normalizeStatus(status);
  return s === "PAID" || s === "PAID_COD" || s === "PROCESSING" || s === "SHIPPED" || s === "DELIVERED";
}

/**
 * Order items format (based on your codebase):
 * - stored in orders.items jsonb
 * - each item usually includes { slug, qty } (slug is used elsewhere for inventory commit)
 */
function extractRestockDeltas(items: unknown): Array<{ slug: string; qty: number }> {
  if (!Array.isArray(items)) return [];

  const out: Array<{ slug: string; qty: number }> = [];

  for (const it of items) {
    if (!isRecord(it)) continue;

    const slugRaw = it["slug"];
    const qtyRaw = it["qty"] ?? it["requested_qty"] ?? 1;

    const slug = typeof slugRaw === "string" ? slugRaw.trim() : "";
    const qty = Math.max(0, toInt(qtyRaw));

    if (slug && qty > 0) out.push({ slug, qty });
  }

  return out;
}

export async function createRefundRecord(
  trx: DbTx,
  input: {
    orderId: number;
    amountJod: number;
    reason: string;
    method: RefundMethod;
    idempotencyKey: string;
  }
): Promise<{ refund: RefundRow; order: OrderForRefund }> {
  const orderId = input.orderId;
  const amountJod = input.amountJod;
  const reason = input.reason;
  const method = input.method;
  const idem = input.idempotencyKey;

  if (!(orderId > 0)) throw new Error("ORDER_ID_INVALID");
  if (!(amountJod > 0)) throw new Error("AMOUNT_INVALID");
  if (!idem) throw new Error("IDEMPOTENCY_KEY_REQUIRED");

  const orderRes = await trx.query<OrderForRefund>(
    `select id, status, payment_method, paytabs_tran_ref, items, inventory_committed_at
       from orders
      where id = $1
      for update`,
    [orderId]
  );

  const order = orderRes.rows[0];
  if (!order) throw new Error("ORDER_NOT_FOUND");

  if (!isRefundableOrderStatus(order.status)) throw new Error("ORDER_NOT_REFUNDABLE_STATUS");

  const paytabsTranRef = (order.paytabs_tran_ref || "").trim() || null;
  if (method === "PAYTABS" && !paytabsTranRef) throw new Error("MISSING_PAYTABS_TRAN_REF");

  // Insert idempotently (status starts PENDING)
  const ins = await trx.query<RefundRow>(
    `insert into refunds
      (order_id, method, amount_jod, currency, reason, idempotency_key, status, paytabs_tran_ref, requested_at)
     values
      ($1,$2,$3,'JOD',$4,$5,'PENDING',$6, now())
     on conflict (order_id, idempotency_key)
     do update set
       reason = excluded.reason,
       updated_at = now()
     returning
       id, order_id, method, amount_jod, currency, reason, idempotency_key, status,
       paytabs_tran_ref, paytabs_refund_reference,
       requested_at, succeeded_at, failed_at, last_error, payload`,
    [orderId, method, amountJod, reason || null, idem, paytabsTranRef]
  );

  const refund = ins.rows[0];
  if (!refund) throw new Error("REFUND_INSERT_FAILED");

  // Move order into refund flow immediately
  await trx.query(
    `update orders
        set status = $2,
            updated_at = now()
      where id = $1`,
    [orderId, "REFUND_PENDING"]
  );

  return { refund, order };
}

export async function markRefundFailed(
  trx: DbTx,
  input: { refundId: number; message: string; payload: unknown }
): Promise<void> {
  const refundId = input.refundId;
  const message = input.message || "Refund failed";

  await trx.query(
    `update refunds
        set status = 'FAILED',
            failed_at = now(),
            last_error = $2,
            payload = $3::jsonb
      where id = $1`,
    [refundId, message, JSON.stringify(input.payload ?? {})]
  );

  // reflect in order status (best-effort)
  await trx.query(
    `update orders
        set status = 'REFUND_FAILED',
            updated_at = now()
      where id = (select order_id from refunds where id=$1)`,
    [refundId]
  );
}

export async function markRefundSucceeded(
  trx: DbTx,
  input: { refundId: number; paytabsRefundReference: string | null; payload: unknown }
): Promise<{ orderId: number }> {
  const refundId = input.refundId;

  const upd = await trx.query<{ order_id: number }>(
    `update refunds
        set status = 'SUCCEEDED',
            succeeded_at = now(),
            paytabs_refund_reference = $2,
            payload = $3::jsonb
      where id = $1
      returning order_id`,
    [refundId, input.paytabsRefundReference, JSON.stringify(input.payload ?? {})]
  );

  const orderId = Number(upd.rows[0]?.order_id || 0);
  if (!(orderId > 0)) throw new Error("REFUND_UPDATE_FAILED");

  await trx.query(
    `update orders
        set status = 'REFUNDED',
            updated_at = now()
      where id = $1`,
    [orderId]
  );

  return { orderId };
}

export async function scheduleRestockAfter48h(
  trx: DbTx,
  input: { orderId: number; refundId: number }
): Promise<void> {
  const runAt = nowPlusHoursIso(48);

  await trx.query(
    `insert into restock_jobs (order_id, refund_id, status, run_at, updated_at)
     values ($1,$2,'SCHEDULED',$3::timestamptz, now())
     on conflict (refund_id)
     do update set
       run_at = excluded.run_at,
       status = case when restock_jobs.status in ('DONE','CANCELED') then restock_jobs.status else 'SCHEDULED' end,
       updated_at = now()`,
    [input.orderId, input.refundId, runAt]
  );
}

export async function runDueRestocks(
  trx: DbTx,
  input: { limit: number }
): Promise<{ ok: true; processed: number; done: number; failed: number }> {
  const limit = Math.max(1, Math.min(200, Math.trunc(input.limit || 50)));

  // Lock jobs safely (skip locked for concurrency)
  const jobsRes = await trx.query<RestockJobRow>(
    `select id, order_id, refund_id, status, run_at, attempts
       from restock_jobs
      where status = 'SCHEDULED'
        and run_at <= now()
      order by run_at asc, id asc
      for update skip locked
      limit $1`,
    [limit]
  );

  let done = 0;
  let failed = 0;

  for (const job of jobsRes.rows) {
    try {
      // Lock related order to read items safely
      const orderRes = await trx.query<{ items: unknown }>(
        `select items
           from orders
          where id = $1
          for update`,
        [job.order_id]
      );

      const items = orderRes.rows[0]?.items;
      const deltas = extractRestockDeltas(items);

      // If no deltas, treat as done (idempotent)
      if (deltas.length > 0) {
        for (const d of deltas) {
          const p = await trx.query<ProductRow>(
            `select id, slug, inventory_qty
               from products
              where slug = $1
              for update`,
            [d.slug]
          );

          if (!p.rows.length) continue;

          await trx.query(
            `update products
                set inventory_qty = coalesce(inventory_qty, 0) + $2::int,
                    updated_at = now()
              where slug = $1`,
            [d.slug, d.qty]
          );
        }
      }

      // Mark refund as restocked (best-effort; not required for correctness)
      await trx.query(
        `update refunds
            set restocked = true
          where id = $1`,
        [job.refund_id]
      );

      await trx.query(
        `update restock_jobs
            set status = 'DONE',
                done_at = now(),
                updated_at = now()
          where id = $1`,
        [job.id]
      );

      done += 1;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err || "RESTOCK_FAILED");

      await trx.query(
        `update restock_jobs
            set status = 'FAILED',
                attempts = attempts + 1,
                last_error = $2,
                updated_at = now()
          where id = $1`,
        [job.id, msg]
      );

      failed += 1;
    }
  }

  return { ok: true, processed: jobsRes.rows.length, done, failed };
}