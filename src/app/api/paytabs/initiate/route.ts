import { NextResponse } from "next/server";
import { paytabsConfig, paytabsInitiate } from "@/lib/paytabs";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { profileId, callbackUrl, returnUrl } = paytabsConfig();
    const input = await req.json();

    const cartId = String(input.cartId || `NIVRAN-${Date.now()}`);
    const amount = Number(input.amount || 0);
    const currency = String(input.currency || "JOD");

    if (!amount || amount <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid amount" }, { status: 400 });
    }

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
      user_defined: { ud1: input.locale || "en" },
    };

    const pt = await paytabsInitiate(payload);
    const redirectUrl = pt?.redirect_url || pt?.redirectUrl || pt?.redirect;

    if (!redirectUrl) {
      return NextResponse.json({ ok: false, error: "No redirect_url from PayTabs", pt }, { status: 500 });
    }

    return NextResponse.json({ ok: true, redirect_url: redirectUrl, pt });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Initiate failed", paytabs: e?.paytabs || null },
      { status: e?.status || 500 }
    );
  }
}
