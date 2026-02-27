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

  params.push(limit + 1);
  const limitParam = `$${params.length}`;
  params.push(offset);
  const offsetParam = `$${params.length}`;

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
       o.created_at::text as created_at
     from sales_audit_logs l
     join orders o on o.id = l.order_id
     ${where}
     order by l.created_at desc
     limit ${limitParam} offset ${offsetParam}`,
    params
  );

  const hasMore = result.rows.length > limit;
  const orders = hasMore ? result.rows.slice(0, limit) : result.rows;

  return NextResponse.json({
    ok: true,
    orders,
    pagination: {
      limit,
      offset,
      hasMore,
      nextOffset: hasMore ? offset + limit : null,
    },
  });
}
