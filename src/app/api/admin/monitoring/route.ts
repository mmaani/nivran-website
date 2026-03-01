// src/app/api/admin/monitoring/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/guards";
import { ensureOrdersTablesSafe } from "@/lib/orders";
import { ensureRefundTablesSafe } from "@/lib/refundsSchema";

export const runtime = "nodejs";

export async function GET(req: Request) {
  await ensureOrdersTablesSafe();
  await ensureRefundTablesSafe();

  const auth = requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const ordersByStatus = await db.query(
    `select status, count(*)::int as count
       from orders
      where created_at > now() - interval '30 days'
      group by status
      order by count desc`
  );

  const paidButNotCommitted = await db.query(
    `select id, cart_id, created_at, updated_at
       from orders
      where status in ('PAID','PAID_COD')
        and inventory_committed_at is null
      order by updated_at desc
      limit 50`
  );

  const refundFunnel = await db.query(
    `select status, count(*)::int as count
       from refunds
      where requested_at > now() - interval '30 days'
      group by status
      order by count desc`
  );

  const restockBacklog = await db.query(
    `select status, count(*)::int as count
       from restock_jobs
      group by status
      order by count desc`
  );

  const stuckPaytabsPending = await db.query(
    `select cart_id, status, paytabs_tran_ref, updated_at
       from orders
      where status='PENDING_PAYMENT'
        and payment_method='PAYTABS'
        and updated_at < now() - interval '30 minutes'
      order by updated_at asc
      limit 100`
  );

  return NextResponse.json({
    ok: true,
    ordersByStatus: ordersByStatus.rows,
    paidButNotCommitted: paidButNotCommitted.rows,
    refundFunnel: refundFunnel.rows,
    restockBacklog: restockBacklog.rows,
    stuckPaytabsPending: stuckPaytabsPending.rows,
  });
}