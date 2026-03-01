// src/app/api/admin/orders/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureOrdersTablesSafe } from "@/lib/orders";
import { ensureRefundTablesSafe } from "@/lib/refundsSchema";
import { requireAdmin } from "@/lib/guards";

export const runtime = "nodejs";

export async function GET(req: Request) {
  await ensureOrdersTablesSafe();
  await ensureRefundTablesSafe();

  const auth = requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });

  const { rows } = await db.query(
    `select
        o.id, o.cart_id, o.status, o.amount, o.currency, o.locale,
        o.payment_method,
        o.customer_name, o.customer_email,
        o.paytabs_tran_ref, o.paytabs_response_status, o.paytabs_response_message,
        o.created_at, o.updated_at,

        r.id as last_refund_id,
        r.status as last_refund_status,
        r.method as last_refund_method,
        r.amount_jod as last_refund_amount_jod,
        r.requested_at as last_refund_requested_at,
        r.succeeded_at as last_refund_succeeded_at,
        r.failed_at as last_refund_failed_at,
        r.last_error as last_refund_error
     from orders o
     left join lateral (
       select *
         from refunds
        where order_id = o.id
        order by id desc
        limit 1
     ) r on true
     order by o.id desc
     limit 200`
  );

  return NextResponse.json({ ok: true, orders: rows });
}