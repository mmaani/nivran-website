import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminOrSales } from "@/lib/guards";

export const runtime = "nodejs";

type SalesOrderRow = {
  id: number;
  cart_id: string;
  status: string;
  payment_method: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  total_jod: string;
  item_lines: number;
  item_qty_total: number;
  created_at: string;
};

export async function GET(req: Request) {
  const auth = requireAdminOrSales(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const auditMap = await db
    .query<{ order_id: number }>(
      `select distinct order_id
         from sales_audit_logs
        where action='CREATE_SALE'
          and order_id is not null
          ${auth.role === "sales" ? "and actor_staff_id=$1" : ""}
        order by order_id desc
        limit 200`,
      auth.role === "sales" ? [auth.staffId] : []
    )
    .catch(() => ({ rows: [] as Array<{ order_id: number }> }));

  const ids = auditMap.rows.map((row) => row.order_id).filter((id) => Number.isFinite(id));
  if (!ids.length) return NextResponse.json({ ok: true, orders: [] });

  const orders = await db.query<SalesOrderRow>(
    `select
       o.id,
       o.cart_id,
       o.status,
       o.payment_method,
       o.customer_name,
       o.customer_phone,
       o.customer_email,
       o.total_jod::text as total_jod,
       coalesce(jsonb_array_length(o.items), 0) as item_lines,
       coalesce((
         select sum(greatest(0, coalesce((entry->>'requested_qty')::int, (entry->>'qty')::int, 0)))
           from jsonb_array_elements(coalesce(o.items, '[]'::jsonb)) as entry
       ), 0)::int as item_qty_total,
       o.created_at::text as created_at
     from orders o
     where o.id = any($1::bigint[])
     order by o.created_at desc`,
    [ids]
  );

  return NextResponse.json({ ok: true, orders: orders.rows });
}
