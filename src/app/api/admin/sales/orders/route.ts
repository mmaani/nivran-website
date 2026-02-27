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

  const url = new URL(req.url);
  const limitRaw = Number(url.searchParams.get("limit") || "120");
  const limit = Math.max(20, Math.min(400, Number.isFinite(limitRaw) ? Math.trunc(limitRaw) : 120));
  const statusFilter = String(url.searchParams.get("status") || "").trim().toUpperCase();
  const from = String(url.searchParams.get("from") || "").trim();
  const to = String(url.searchParams.get("to") || "").trim();

  const fromIso = /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : "";
  const toIso = /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : "";

  const auditMap = await db
    .query<{ order_id: number }>(
      `select distinct order_id
         from sales_audit_logs
        where action='CREATE_SALE'
          and order_id is not null
          ${auth.role === "sales" ? "and actor_staff_id=$1" : ""}
        order by order_id desc
        limit ${limit}`,
      auth.role === "sales" ? [auth.staffId] : []
    )
    .catch(() => ({ rows: [] as Array<{ order_id: number }> }));

  const ids = auditMap.rows.map((row) => row.order_id).filter((id) => Number.isFinite(id));
  if (!ids.length) return NextResponse.json({ ok: true, orders: [] });

  let where = "";
  const params: Array<string | number[] | number | null> = [ids];

  if (statusFilter) {
    params.push(statusFilter);
    where += ` and o.status = $${params.length}`;
  }
  if (fromIso) {
    params.push(`${fromIso}T00:00:00.000Z`);
    where += ` and o.created_at >= $${params.length}::timestamptz`;
  }
  if (toIso) {
    params.push(`${toIso}T23:59:59.999Z`);
    where += ` and o.created_at <= $${params.length}::timestamptz`;
  }

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
       ${where}
     order by o.created_at desc`,
    params
  );

  return NextResponse.json({ ok: true, orders: orders.rows });
}
