import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const input = await req.json();

  const cartId = String(input.cartId || `NIVRAN-${Date.now()}`);
  const amount = Number(input.amount || 0);
  const currency = String(input.currency || "JOD");
  const locale = String(input.locale || "en");

  if (!amount || amount <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid amount" }, { status: 400 });
  }

  const customer = input.customer || {};
  const customerEmail = customer.email || null;
  const customerName = customer.name || null;

  const pool = db();
  await pool.query(
    `insert into orders (cart_id, status, amount, currency, locale, customer_email, customer_name)
     values ($1, 'PENDING_PAYMENT', $2, $3, $4, $5, $6)
     on conflict (cart_id) do nothing`,
    [cartId, amount, currency, locale, customerEmail, customerName]
  );

  return NextResponse.json({ ok: true, cartId });
}
