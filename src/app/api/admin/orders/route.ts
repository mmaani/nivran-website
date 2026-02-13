import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/guards";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });

  const pool = db();
  const { rows } = await pool.query(
    `select id, cart_id, status, amount, currency, locale,
            customer_name, customer_email,
            paytabs_tran_ref, paytabs_response_status, paytabs_response_message,
            created_at, updated_at
     from orders
     order by id desc
     limit 200`
  );

  return NextResponse.json({ ok: true, orders: rows });
}
