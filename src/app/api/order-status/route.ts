import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyOrderStatusToken } from "@/lib/orderStatusToken";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const cartId = String(url.searchParams.get("cart_id") || "").trim();
  const statusToken = String(url.searchParams.get("st") || url.searchParams.get("statusToken") || "").trim();
  if (!cartId) {
    return NextResponse.json({ ok: false, error: "Missing cart_id" }, { status: 400 });
  }
  if (!statusToken) {
    return NextResponse.json({ ok: false, error: "Missing st" }, { status: 400 });
  }
  if (!verifyOrderStatusToken(cartId, statusToken)) {
    return NextResponse.json({ ok: false, error: "Invalid status token" }, { status: 401 });
  }

  const pool = db;
  const { rows } = await pool.query(
    `select cart_id, status, amount, currency,
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
