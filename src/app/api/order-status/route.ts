import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const cartId = url.searchParams.get("cart_id") || "";
  if (!cartId) {
    return NextResponse.json({ ok: false, error: "Missing cart_id" }, { status: 400 });
  }

  const pool = db;
  const { rows } = await pool.query(
    `select cart_id, status, amount, currency,
            paytabs_tran_ref, paytabs_response_status, paytabs_response_message,
            updated_at
     from orders
     where cart_id=$1
     limit 1`,
    [cartId]
  );

  if (!rows.length) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, order: rows[0] });
}
