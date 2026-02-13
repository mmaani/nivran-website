import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { paytabsInitiateHpp } from "@/lib/paytabs";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const input = await req.json().catch(() => ({} as any));
    const cartId = String(input?.cartId || "");
    if (!cartId) return NextResponse.json({ ok: false, error: "cartId is required" }, { status: 400 });

    const pool = db();
    const { rows } = await pool.query(
      `select cart_id, status, amount, currency, locale, payment_method, customer, shipping
       from orders
       where cart_id = $1
       limit 1`,
      [cartId]
    );

    const o = rows?.[0];
    if (!o) return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });

    const status = String(o.status || "");
    if (status === "PAID") {
      return NextResponse.json({ ok: true, alreadyPaid: true, cartId }, { status: 200 });
    }

    const locale: "en" | "ar" = String(o.locale || "en") === "ar" ? "ar" : "en";
    const customer = (o.customer || {}) as any;
    const shipping = (o.shipping || {}) as any;

    const resp = await paytabsInitiateHpp({
      cartId: String(o.cart_id),
      amount: Number(o.amount),
      currency: String(o.currency || "JOD"),
      locale,
      description: "NIVRAN / نيفـران — Eau de Parfum 100ml (MVP)",
      customer: {
        name: String(customer.name || "Customer"),
        email: customer.email ? String(customer.email) : "no-reply@nivran.com",
        phone: customer.phone ? String(customer.phone) : "",
      },
      shipping: {
        city: shipping.city ? String(shipping.city) : "Amman",
        address: shipping.address ? String(shipping.address) : "N/A",
        country: "JO",
      },
    });

    // Keep DB minimal: store initiate response for auditing + set pending payment
    await pool.query(
      `update orders
       set status = 'PENDING_PAYMENT',
           payment_method = 'PAYTABS',
           paytabs_last_payload = $2,
           updated_at = now()
       where cart_id = $1`,
      [cartId, JSON.stringify({ initiate: resp })]
    );

    return NextResponse.json({
      ok: true,
      cartId,
      redirect_url: resp?.redirect_url,
      tran_ref: resp?.tran_ref || null,
      paytabs: resp,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Initiate failed", paytabs: e?.paytabs || null },
      { status: e?.status || 500 }
    );
  }
}
