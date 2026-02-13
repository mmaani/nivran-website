import { NextResponse } from "next/server";
import { paytabsConfig, paytabsInitiate } from "@/lib/paytabs";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const input = await req.json().catch(() => ({} as any));
    const cartId = String(input?.cartId || "");
    if (!cartId) {
      return NextResponse.json({ ok: false, error: "cartId is required" }, { status: 400 });
    }

    const pool = db();
    const { rows } = await pool.query(
      `select cart_id, status, amount, currency, locale, payment_method
       from orders where cart_id=$1`,
      [cartId]
    );

    if (!rows.length) {
      return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });
    }

    const order = rows[0];
    if (String(order.payment_method || "").toUpperCase() !== "PAYTABS") {
      return NextResponse.json({ ok: false, error: "Order is not PAYTABS" }, { status: 400 });
    }

    if (order.status === "PAID") {
      return NextResponse.json({ ok: false, error: "Order already PAID" }, { status: 400 });
    }

    const { profileId, callbackUrl } = paytabsConfig();
    const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const base = String(origin).replace(/\/$/, "");
    const locale = String(order.locale || "en") === "ar" ? "ar" : "en";
    const returnUrl = `${base}/${locale}/checkout?result=paytabs&cart_id=${encodeURIComponent(cartId)}`;

    const payload = {
      profile_id: profileId,
      tran_type: "sale",
      tran_class: "ecom",
      cart_id: cartId,
      cart_description: "NIVRAN Order",
      cart_currency: String(order.currency || "JOD"),
      cart_amount: Number(order.amount),
      callback: callbackUrl,
      return: returnUrl
    };

    const pt = await paytabsInitiate(payload);
    const redirectUrl = pt?.redirect_url || pt?.redirectUrl || pt?.redirect;

    if (!redirectUrl) {
      return NextResponse.json({ ok: false, error: "No redirect_url from PayTabs", pt }, { status: 500 });
    }

    return NextResponse.json({ ok: true, redirect_url: redirectUrl, cartId });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Initiate failed", paytabs: e?.paytabs || null },
      { status: e?.status || 500 }
    );
  }
}
