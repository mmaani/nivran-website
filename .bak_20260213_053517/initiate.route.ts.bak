import { NextResponse } from "next/server";
import { paytabsConfig, paytabsInitiate } from "@/lib/paytabs";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { profileId, callbackUrl } = paytabsConfig();
    const input = await req.json();

    const cartId = String(input.cartId || `NIVRAN-${Date.now()}`);
    const amount = Number(input.amount || 0);
    const currency = String(input.currency || "JOD");
    const locale = String(input.locale || "en");

    if (!amount || amount <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid amount" }, { status: 400 });
    }

    // Create pending order
    const origin =
      req.headers.get("origin") ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "http://localhost:3000";

    const orderRes = await fetch(`${origin}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cartId,
        amount,
        currency,
        locale,
        customer: input.customer || {},
      }),
      cache: "no-store",
    });

    const orderData = await orderRes.json();
    if (!orderRes.ok || !orderData.ok) {
      return NextResponse.json(
        { ok: false, error: orderData?.error || "Order create failed" },
        { status: 500 }
      );
    }

    // Locale-aware return URL
    const base = (process.env.NEXT_PUBLIC_SITE_URL || origin).replace(/\/$/, "");
    const returnUrl = `${base}/${locale}/checkout?result=paytabs&cart_id=${encodeURIComponent(cartId)}`;

    // Initiate PayTabs HPP
    const payload = {
      profile_id: profileId,
      tran_type: "sale",
      tran_class: "ecom",
      cart_id: cartId,
      cart_description: input.cartDescription || "NIVRAN Order",
      cart_currency: currency,
      cart_amount: amount,
      callback: callbackUrl,
      return: returnUrl,
      customer_details: input.customer || undefined,
      shipping_details: input.shipping || undefined,
      user_defined: { ud1: locale },
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
