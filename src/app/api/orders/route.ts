import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureOrdersTables } from "@/lib/orders";
import { getCustomerIdFromRequest } from "@/lib/identity";

export const runtime = "nodejs";

const SHIPPING_FEE_JOD = 3.5;
const DEFAULT_ITEM_PRICE_JOD = 18.0; // MVP placeholder: 100ml

export async function GET() {
  return NextResponse.json({ ok: false, error: "Method Not Allowed" }, { status: 405 });
}

export async function POST(req: Request) {
  try {
    const customerId = await getCustomerIdFromRequest(req);
    const input = await req.json().catch(() => ({} as any));

    const modeRaw = String(input?.mode || "PAYTABS").toUpperCase();
    const mode = modeRaw === "COD" ? "COD" : "PAYTABS"; // allow only COD | PAYTABS
    const locale = String(input?.locale || "en") === "ar" ? "ar" : "en";
    const qty = Math.max(1, Number(input?.qty || 1));

    const customer = input?.customer || {};
    const shipping = input?.shipping || {};

    const cartId = String(input?.cartId || `NIVRAN-${Date.now()}`);
    const subtotal = DEFAULT_ITEM_PRICE_JOD * qty;
    const total = Number((subtotal + SHIPPING_FEE_JOD).toFixed(2));

    const status = mode === "COD" ? "PENDING_COD_CONFIRM" : "PENDING_PAYMENT";

    const pool = db();
    await pool.query(
      `insert into orders (
          cart_id, status, amount, currency, locale,
          payment_method, customer, shipping,
          customer_email, customer_name, customer_id
       )
       values ($1,$2,$3,'JOD',$4,$5,$6,$7,$8,$9,$10)
       on conflict (cart_id) do update
         set status=excluded.status,
             amount=excluded.amount,
             locale=excluded.locale,
             payment_method=excluded.payment_method,
             customer=excluded.customer,
             shipping=excluded.shipping,
             customer_email=excluded.customer_email,
             customer_name=excluded.customer_name,
             customer_id=excluded.customer_id,
             updated_at=now()`,
      [
        cartId,
        status,
        total,
        locale,
        mode,
        customer,
        shipping,
        customer.email || null,
        customer.name || null,
        customerId,
      ]
    );

    return NextResponse.json({
      ok: true,
      cartId,
      status,
      pricing: { subtotal, shipping: SHIPPING_FEE_JOD, total, currency: "JOD" },
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Order create failed" },
      { status: 500 }
    );
  }
}

