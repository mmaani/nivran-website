// src/lib/refunds.ts
import "server-only";
import type { DbTx } from "@/lib/db";

export type RefundMethod = "PAYTABS" | "MANUAL";
export type RefundStatus = "REQUESTED" | "CONFIRMED" | "RESTOCK_SCHEDULED" | "RESTOCKED" | "FAILED";

export type RefundRow = {
  id: number;
  order_id: number;
  method: RefundMethod;
  amount_jod: string | number;
  currency: string;
  reason: string | null;
  idempotency_key: string;
  status: RefundStatus;
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
  paytabs_tran_ref: string | null;
  total_jod: string | null;
  amount: string | null;
};

type ProductRow = {
  slug: string;
  inventory_qty: number | null;
};

type RestockJobRow = {
  id: number;
  refund_id: number;
  status: string;
  run_at: string;
  attempts: number;
};

const REFUND_TRANSITIONS: Record<RefundStatus, RefundStatus[]> = {
  REQUESTED: ["CONFIRMED", "FAILED"],
  CONFIRMED: ["RESTOCK_SCHEDULED", "FAILED"],
  RESTOCK_SCHEDULED: ["RESTOCKED", "FAILED"],
  RESTOCKED: ["FAILED"],
  FAILED: ["FAILED"],
};

function nowPlusHoursIso(hours: number): string {
  const d = new Date();
  d.setUTCHours(d.getUTCHours() + hours);
  return d.toISOString();
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function extractRestockDeltas(items: unknown): Array<{ slug: string; qty: number }> {
  if (!Array.isArray(items)) return [];
  const out: Array<{ slug: string; qty: number }> = [];
  for (const it of items) {
    if (!isRecord(it)) continue;
    const slugRaw = it["slug"];
    const qtyRaw = it["qty"];
    const slug = typeof slugRaw === "string" ? slugRaw.trim() : "";
    const qtyNum = typeof qtyRaw === "number" ? qtyRaw : typeof qtyRaw === "string" ? Number(qtyRaw) : 1;
    const qty = Number.isFinite(qtyNum) ? Math.max(0, Math.trunc(qtyNum)) : 1;
    if (slug && qty > 0) out.push({ slug, qty });
  }
  return out;
}

function normalizeStatus(v: string): string {
  return String(v || "").trim().toUpperCase();
}

function isRefundableOrderStatus(status: string): boolean {
  const s = normalizeStatus(status);
  return s === "PAID" || s === "PAID_COD" || s === "PROCESSING" || s === "SHIPPED" || s === "DELIVERED";
}

function toSafeNumber(v: string | number | null | undefined): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function canTransition(from: RefundStatus, to: RefundStatus): boolean {
  return REFUND_TRANSITIONS[from]?.includes(to) ?? false;
}

export async function transitionRefundStatus(
  trx: DbTx,
  input: { refundId: number; from: RefundStatus; to: RefundStatus; payload?: unknown; errorMessage?: string | null; paytabsRef?: string | null }
): Promise<void> {
  if (!canTransition(input.from, input.to) && input.to !== "FAILED") {
    throw new Error(`REFUND_INVALID_TRANSITION_${input.from}_TO_${input.to}`);
  }

  const updateRes = await trx.query<{ id: number }>(
    `update refunds
        set status = $3,
            succeeded_at = case when $3 in ('CONFIRMED','RESTOCKED') then now() else succeeded_at end,
            failed_at = case when $3 = 'FAILED' then now() else failed_at end,
            paytabs_refund_reference = coalesce($4, paytabs_refund_reference),
            last_error = case when $3 = 'FAILED' then $5 else null end,
            payload = case when $6::jsonb is null then payload else $6::jsonb end
      where id = $1
        and status = $2
      returning id`,
    [input.refundId, input.from, input.to, input.paytabsRef || null, input.errorMessage || null, input.payload ? JSON.stringify(input.payload) : null]
  );

  if (!updateRes.rows[0]) {
    throw new Error("REFUND_TRANSITION_REJECTED");
  }
}

export async function createRefundRecord(
  trx: DbTx,
  input: { orderId: number; amountJod: number; reason: string; method: RefundMethod; idempotencyKey: string }
): Promise<{ refund: RefundRow; order: OrderForRefund; created: boolean }> {
  const orderRes = await trx.query<OrderForRefund>(
    `select id, status, payment_method, paytabs_tran_ref, total_jod::text as total_jod, amount::text as amount
       from orders
      where id = $1
      for update`,
    [input.orderId]
  );
  const order = orderRes.rows[0];
  if (!order) throw new Error("ORDER_NOT_FOUND");
  if (!isRefundableOrderStatus(order.status)) throw new Error("ORDER_NOT_REFUNDABLE_STATUS");
  const orderTotal = Math.max(0, toSafeNumber(order.total_jod) || toSafeNumber(order.amount));
  if (!(orderTotal > 0)) throw new Error("ORDER_TOTAL_INVALID");
  if (input.amountJod > orderTotal) throw new Error("REFUND_AMOUNT_EXCEEDS_ORDER_TOTAL");
  if (input.method === "PAYTABS" && !(order.paytabs_tran_ref || "").trim()) throw new Error("MISSING_PAYTABS_TRAN_REF");

  const existing = await trx.query<RefundRow>(`select * from refunds where idempotency_key = $1 limit 1`, [input.idempotencyKey]);
  if (existing.rows[0]) {
    return { refund: existing.rows[0], order, created: false };
  }

  const ins = await trx.query<RefundRow>(
    `insert into refunds
      (order_id, method, amount_jod, currency, reason, idempotency_key, status, paytabs_tran_ref, requested_at)
     values
      ($1,$2,$3,'JOD',$4,$5,'REQUESTED',$6, now())
     on conflict (idempotency_key)
     do nothing
     returning *`,
    [input.orderId, input.method, input.amountJod, input.reason || null, input.idempotencyKey, order.paytabs_tran_ref || null]
  );

  const created = ins.rows[0];
  if (!created) {
    const ref = await trx.query<RefundRow>(`select * from refunds where idempotency_key = $1 limit 1`, [input.idempotencyKey]);
    if (!ref.rows[0]) throw new Error("REFUND_INSERT_FAILED");
    return { refund: ref.rows[0], order, created: false };
  }

  await trx.query(`update orders set status = 'REFUND_PENDING', updated_at = now() where id = $1`, [input.orderId]);
  return { refund: created, order, created: true };
}

export async function markRefundFailed(trx: DbTx, input: { refundId: number; message: string; payload: unknown }): Promise<void> {
  const row = await trx.query<{ status: RefundStatus }>(`select status from refunds where id = $1 for update`, [input.refundId]);
  const current = row.rows[0]?.status;
  if (!current) throw new Error("REFUND_NOT_FOUND");
  if (current === "FAILED") return;
  await transitionRefundStatus(trx, {
    refundId: input.refundId,
    from: current,
    to: "FAILED",
    payload: input.payload,
    errorMessage: input.message,
  });
}

export async function markRefundSucceeded(
  trx: DbTx,
  input: { refundId: number; paytabsRefundReference: string | null; payload: unknown }
): Promise<{ orderId: number }> {
  const currentRes = await trx.query<{ status: RefundStatus; order_id: number }>(
    `select status, order_id from refunds where id = $1 for update`,
    [input.refundId]
  );
  const current = currentRes.rows[0];
  if (!current) throw new Error("REFUND_NOT_FOUND");

  // Idempotent confirm: allow repeated confirms without throwing transition errors.
  if (current.status === "CONFIRMED" || current.status === "RESTOCK_SCHEDULED" || current.status === "RESTOCKED") {
    await trx.query(`update orders set status = 'REFUNDED', updated_at = now() where id = $1`, [current.order_id]);
    return { orderId: current.order_id };
  }

  await transitionRefundStatus(trx, {
    refundId: input.refundId,
    from: current.status,
    to: "CONFIRMED",
    paytabsRef: input.paytabsRefundReference,
    payload: input.payload,
  });

  await trx.query(`update orders set status = 'REFUNDED', updated_at = now() where id = $1`, [current.order_id]);
  return { orderId: current.order_id };
}

export async function scheduleRestockAfter48h(trx: DbTx, input: { refundId: number }): Promise<void> {
  const row = await trx.query<{ status: RefundStatus }>(`select status from refunds where id = $1 for update`, [input.refundId]);
  const current = row.rows[0]?.status;
  if (!current) throw new Error("REFUND_NOT_FOUND");

  if (current === "RESTOCKED") return;
  if (current !== "RESTOCK_SCHEDULED") {
    await transitionRefundStatus(trx, { refundId: input.refundId, from: current, to: "RESTOCK_SCHEDULED" });
  }

  await trx.query(
    `insert into restock_jobs (refund_id, status, run_at, created_at, updated_at)
     values ($1, 'SCHEDULED', $2::timestamptz, now(), now())
     on conflict (refund_id)
     do update set status = 'SCHEDULED', run_at = excluded.run_at, updated_at = now()`,
    [input.refundId, nowPlusHoursIso(48)]
  );
}

export async function runDueRestocks(
  trx: DbTx,
  input: { limit: number }
): Promise<{ ok: true; processed: number; done: number; failed: number; restockedRefundIds: number[] }> {
  const limit = Math.max(1, Math.min(200, Math.trunc(input.limit || 50)));
  const jobsRes = await trx.query<RestockJobRow>(
    `select *
       from restock_jobs
      where status = 'SCHEDULED'
        and run_at <= now()
      for update skip locked
      limit $1`,
    [limit]
  );

  let done = 0;
  let failed = 0;
  const restockedRefundIds: number[] = [];

  for (const job of jobsRes.rows) {
    try {
      const refundRes = await trx.query<{ order_id: number; status: RefundStatus }>(
        `select order_id, status from refunds where id = $1 for update`,
        [job.refund_id]
      );
      const refund = refundRes.rows[0];
      if (!refund) throw new Error("REFUND_NOT_FOUND");

      const orderRes = await trx.query<{ items: unknown }>(`select items from orders where id = $1 for update`, [refund.order_id]);
      const deltas = extractRestockDeltas(orderRes.rows[0]?.items);

      for (const d of deltas) {
        const p = await trx.query<ProductRow>(`select slug, inventory_qty from products where slug = $1 for update`, [d.slug]);
        if (!p.rows[0]) continue;
        await trx.query(
          `update products set inventory_qty = coalesce(inventory_qty, 0) + $2::int, updated_at = now() where slug = $1`,
          [d.slug, d.qty]
        );
      }

      await transitionRefundStatus(trx, { refundId: job.refund_id, from: refund.status, to: "RESTOCKED" });
      await trx.query(`update refunds set restocked = true where id = $1`, [job.refund_id]);
      await trx.query(`update restock_jobs set status = 'RESTOCKED', updated_at = now() where id = $1`, [job.id]);
      done += 1;
      restockedRefundIds.push(job.refund_id);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "RESTOCK_FAILED";
      await trx.query(
        `update restock_jobs
            set attempts = attempts + 1,
                status = 'FAILED',
                last_error = $2,
                updated_at = now()
          where id = $1`,
        [job.id, message]
      );
      failed += 1;
    }
  }

  return { ok: true, processed: jobsRes.rows.length, done, failed, restockedRefundIds };
}
