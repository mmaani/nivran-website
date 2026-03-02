// src/app/api/admin/order-status/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureOrdersTablesSafe, commitInventoryForPaidOrderId } from "@/lib/orders";
import { requireAdmin } from "@/lib/guards";
import { consumePromotionUsage } from "@/lib/promotions";
import { logAdminAudit } from "@/lib/adminAudit";

export const runtime = "nodejs";

/**
 * Strict transition map (admin UI should only offer these)
 */
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  PENDING_PAYMENT: ["PAID", "FAILED", "CANCELED"],
  PAID: ["PROCESSING", "REFUND_REQUESTED", "REFUND_PENDING"],
  PROCESSING: ["SHIPPED", "REFUND_REQUESTED", "REFUND_PENDING"],
  SHIPPED: ["DELIVERED", "REFUND_REQUESTED", "REFUND_PENDING"],
  DELIVERED: ["REFUND_REQUESTED", "REFUND_PENDING"],
  FAILED: [],
  CANCELED: [],

  // COD flow
  PENDING_COD_CONFIRM: ["PAID_COD", "CANCELED"],
  PAID_COD: ["PROCESSING", "REFUND_REQUESTED", "REFUND_PENDING"],

  // Refund flow
  REFUND_REQUESTED: ["REFUND_PENDING", "REFUND_FAILED", "REFUNDED"],
  REFUND_PENDING: ["REFUND_FAILED", "REFUNDED"],
  REFUND_FAILED: [],
  REFUNDED: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.trunc(value);
  if (typeof value === "string") {
    const n = Number(value.trim());
    if (Number.isFinite(n) && n > 0) return Math.trunc(n);
  }
  return null;
}

function normStr(v: unknown): string {
  return typeof v === "string" ? v.trim().toUpperCase() : "";
}

type OrderRow = {
  id: number;
  status: string;
  payment_method: string;
  inventory_committed_at: string | null;
};

type OrderPromoRow = {
  status: string;
  discount_source: string | null;
  promo_code: string | null;
  promotion_id: string | number | null;
  promo_consumed: boolean | null;
};

function isPaidStatus(status: string): boolean {
  const s = normStr(status);
  return s === "PAID" || s === "PAID_COD";
}

function isPaidPipelineStatus(status: string): boolean {
  const s = normStr(status);
  return s === "PAID" || s === "PAID_COD" || s === "PROCESSING" || s === "SHIPPED" || s === "DELIVERED";
}

function isAllowedByMap(current: string, next: string): boolean {
  const cur = normStr(current);
  const nxt = normStr(next);
  const allowed = ALLOWED_TRANSITIONS[cur] || [];
  return allowed.includes(nxt);
}

function extraGuards(paymentMethod: string, current: string, next: string): string | null {
  const pm = normStr(paymentMethod);
  const cur = normStr(current);
  const nxt = normStr(next);

  // Never allow “shipping pipeline” steps unless order is paid (PAYTABS + COD)
  if (nxt === "PROCESSING" || nxt === "SHIPPED" || nxt === "DELIVERED") {
    if (!isPaidStatus(cur)) return "Cannot move to PROCESSING/SHIPPED/DELIVERED unless the order is PAID.";
  }

  // PayTabs additional guardrails (optional but safe)
  if (pm === "PAYTABS") {
    if (nxt === "PAID_COD") return "PAYTABS orders cannot be marked PAID_COD.";
    if (nxt === "PENDING_COD_CONFIRM") return "PAYTABS orders cannot be set to PENDING_COD_CONFIRM.";
  }

  // COD additional guardrails
  if (pm === "COD") {
    if (nxt === "PAID") return "COD orders should be marked PAID_COD (not PAID).";
  }

  // Refund guardrails
  if (nxt === "REFUND_REQUESTED" || nxt === "REFUND_PENDING" || nxt === "REFUNDED" || nxt === "REFUND_FAILED") {
    if (!isPaidStatus(cur) && cur !== "REFUND_REQUESTED" && cur !== "REFUND_PENDING") {
      return "Refund is only allowed for PAID / PAID_COD orders.";
    }
  }

  return null;
}

async function tryCommitInventoryIfPaidById(orderId: number): Promise<void> {
  await db.withTransaction(async (trx) => {
    await commitInventoryForPaidOrderId(trx, orderId);
  });
}

function toIntStrict(value: unknown): number | null {
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
      `select status, discount_source, promo_code, promotion_id, promo_consumed
         from orders
        where id = $1
        for update`,
      [orderId]
    );

    const row = rows[0];
    if (!row) return;

    const status = normStr(row.status);
    if (!(status === "PAID" || status === "PAID_COD")) return;

    const source = normStr(row.discount_source);
    if (source !== "CODE") return;

    if (row.promo_consumed === true) return;

    const promotionId = toIntStrict(row.promotion_id);
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

  await ensureOrdersTablesSafe();

  const parsed: unknown = await req.json().catch(() => ({}));
  const body = isRecord(parsed) ? parsed : {};

  const id = toInt(body["id"]);
  const nextStatus = normStr(body["status"]);

  if (!id || !nextStatus) {
    return NextResponse.json({ ok: false, error: "id and status are required" }, { status: 400 });
  }

  // Transaction: lock the order row, validate transition, update status
  const result = await db.withTransaction(async (trx) => {
    const { rows } = await trx.query<OrderRow>(
      `select id, status, payment_method, inventory_committed_at
         from orders
        where id = $1
        for update`,
      [id]
    );

    if (!rows.length) {
      return { ok: false as const, status: 404, error: "Order not found" };
    }

    const order = rows[0];
    const current = normStr(order.status);
    const pm = normStr(order.payment_method);

    if (!isAllowedByMap(current, nextStatus)) {
      return {
        ok: false as const,
        status: 400,
        error: `Transition not allowed: ${current} -> ${nextStatus}`,
      };
    }

    const guard = extraGuards(pm, current, nextStatus);
    if (guard) {
      return { ok: false as const, status: 400, error: guard };
    }

    // CRITICAL invariant:
    // If inventory was committed, don't allow paid pipeline -> FAILED/CANCELED.
    // Must go through refund flow.
    if (
      order.inventory_committed_at &&
      isPaidPipelineStatus(current) &&
      (nextStatus === "FAILED" || nextStatus === "CANCELED")
    ) {
      return {
        ok: false as const,
        status: 400,
        error: "Inventory already committed. Use refund flow (REFUND_REQUESTED/REFUND_PENDING) instead of FAILED/CANCELED.",
      };
    }

    await trx.query(`update orders set status = $2, updated_at = now() where id = $1`, [id, nextStatus]);

    return { ok: true as const, status: 200 };
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  // Post-update side effects (idempotent, safe to run after):
  if (nextStatus === "PAID" || nextStatus === "PAID_COD") {
    try {
      await tryCommitInventoryIfPaidById(id);
    } catch {
      // keep order status change; inventory commit is idempotent and can be reconciled
    }
    try {
      await tryConsumeCodePromoIfPaidById(id);
    } catch {
      // ignore
    }
  }

  await db.withTransaction(async (trx) => {
    await logAdminAudit(trx, req, {
      adminId: "admin",
      action: "order.status_changed",
      entity: "order",
      entityId: String(id),
      metadata: { status: nextStatus },
    });
  });

  return NextResponse.json({ ok: true });
}