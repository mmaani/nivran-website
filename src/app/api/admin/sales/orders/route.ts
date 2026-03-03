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
  items: unknown;
  last_refund_id: number | null;
  last_refund_status: string | null;
  created_at: string;
};

export async function GET(req: Request) {
  const auth = requireAdminOrSales(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const url = new URL(req.url);
  const limitRaw = Number(url.searchParams.get("limit") || "10");
  const limit = Math.max(5, Math.min(50, Number.isFinite(limitRaw) ? Math.trunc(limitRaw) : 10));
  const offsetRaw = Number(url.searchParams.get("offset") || "0");
  const offset = Math.max(0, Number.isFinite(offsetRaw) ? Math.trunc(offsetRaw) : 0);
  const statusFilter = String(url.searchParams.get("status") || "").trim().toUpperCase();
  const from = String(url.searchParams.get("from") || "").trim();
  const to = String(url.searchParams.get("to") || "").trim();

  const fromIso = /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : "";
  const toIso = /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : "";

  const params: Array<string | number | null> = [];
  let where = `where l.action='CREATE_SALE' and l.order_id is not null`;

  if (auth.role === "sales") {
    params.push(auth.staffId ?? null);
    where += ` and l.actor_staff_id = $${params.length}`;
  }

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

  const paramsForBase = [...params];
  const whereForBase = where;

  const pageParams = [...paramsForBase, limit + 1, offset];
  const limitParam = `$${pageParams.length - 1}`;
  const offsetParam = `$${pageParams.length}`;

  const result = await db.query<SalesOrderRow>(
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
       coalesce(o.items, '[]'::jsonb) as items,
       r.id::int as last_refund_id,
       r.status::text as last_refund_status,
       o.created_at::text as created_at
     from sales_audit_logs l
     join orders o on o.id = l.order_id
     left join lateral (
       select id, status
         from refunds
        where order_id = o.id
        order by id desc
        limit 1
     ) r on true
     ${whereForBase}
     order by l.created_at desc
     limit ${limitParam} offset ${offsetParam}`,
    pageParams
  );

  const hasMore = result.rows.length > limit;
  const orders = hasMore ? result.rows.slice(0, limit) : result.rows;

  const summaryRes = await db.query<{ transactions_count: string; gross_sales_jod: string; refunded_sales_jod: string; net_sales_jod: string }>(
    `select
       count(*)::text as transactions_count,
       coalesce(sum(coalesce(o.total_jod, o.amount::numeric)), 0)::text as gross_sales_jod,
       coalesce(
         sum(
           coalesce((
             select sum(r.amount_jod)
               from refunds r
              where r.order_id = o.id
                and r.status in ('CONFIRMED','RESTOCK_SCHEDULED','RESTOCKED')
           ), 0)
         ),
         0
       )::text as refunded_sales_jod,
       (
         coalesce(sum(coalesce(o.total_jod, o.amount::numeric)), 0)
         - coalesce(
             sum(
               coalesce((
                 select sum(r.amount_jod)
                   from refunds r
                  where r.order_id = o.id
                    and r.status in ('CONFIRMED','RESTOCK_SCHEDULED','RESTOCKED')
               ), 0)
             ),
             0
           )
       )::text as net_sales_jod
     from sales_audit_logs l
     join orders o on o.id = l.order_id
     ${whereForBase}`,
    paramsForBase
  );
  const summary = summaryRes.rows[0] || { transactions_count: "0", gross_sales_jod: "0", refunded_sales_jod: "0", net_sales_jod: "0" };

  return NextResponse.json({
    ok: true,
    viewer: {
      role: auth.role,
      username: auth.username,
      staffId: auth.staffId,
    },
    summary: {
      transactionsCount: Number(summary.transactions_count || "0"),
      totalSalesJod: Number(summary.net_sales_jod || "0"),
      grossSalesJod: Number(summary.gross_sales_jod || "0"),
      refundedSalesJod: Number(summary.refunded_sales_jod || "0"),
    },
    orders,
    pagination: {
      limit,
      offset,
      hasMore,
      nextOffset: hasMore ? offset + limit : null,
    },
  });
}
