import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureOrdersTables } from "@/lib/orders";

export const runtime = "nodejs";

export async function GET(req: Request) {
  await ensureOrdersTables();
  const url = new URL(req.url);
  const cartId = String(url.searchParams.get("cartId") || "");
  if (!cartId) return NextResponse.json({ ok: false, error: "cartId is required" }, { status: 400 });

  const pool = db();
  const { rows } = await pool.query(
    `select cart_id, status, amount, currency, locale, payment_method, updated_at
     from orders where cart_id=$1 limit 1`,
    [cartId]
  );

  if (!rows.length) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, order: rows[0] });
}
