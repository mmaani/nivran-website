import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureOrdersTables } from "@/lib/orders";
import { getPaytabsEnv } from "@/lib/paytabs";

type InitiateRequest = {
  cartId?: string;
  locale?: string;
};

type OrderRow = {
  cart_id: string;
  amount: string | number | null;
  currency: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  shipping_city: string | null;
  shipping_address: string | null;
  shipping_country: string | null;
  customer: { email?: string; name?: string; phone?: string } | null;
  shipping: { city?: string; address?: string; country?: string } | null;
  status: string;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  await ensureOrdersTables();

  const { profileId, serverKey, apiBase } = getPaytabsEnv();

  const body = (await req.json().catch(() => ({}))) as InitiateRequest;
  const cartId = String(body?.cartId || "").trim();
  const locale = String(body?.locale || "en") === "ar" ? "ar" : "en";

  if (!cartId) {
    return NextResponse.json({ ok: false, error: "Missing cartId" }, { status: 400 });
  }

  const orderRes = await db.query<OrderRow>(
    `select cart_id,
            amount,
            currency,
            customer_name,
            customer_email,
            customer_phone,
            shipping_city,
            shipping_address,
            shipping_country,
            customer,
            shipping,
            status
       from orders
      where cart_id=$1
      limit 1`,
    [cartId]
  );

  const order = orderRes.rows[0];
  if (!order) {
    return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });
  }

  const origin = req.headers.get("origin") || process.env.APP_BASE_URL || "";
  if (!origin) {
    return NextResponse.json({ ok: false, error: "Missing origin" }, { status: 400 });
  }

  const returnUrl = `${origin}/${locale}/checkout/result?cartId=${encodeURIComponent(cartId)}`;
  const callbackUrl = `${origin}/api/paytabs/callback`;

  const customerEmail =
    order.customer_email || order.customer?.email || "test@example.com";
  const customerName =
    order.customer_name || order.customer?.name || "Customer";

  const city = order.shipping_city || order.shipping?.city || "Amman";
  const countryRaw = order.shipping_country || order.shipping?.country || "JO";
  const line1 = order.shipping_address || order.shipping?.address || "Address";
  const country = countryRaw.length === 2 ? countryRaw : "JO";

  const payload = {
    profile_id: profileId,
    tran_type: "sale",
    tran_class: "ecom",
    cart_id: cartId,
    cart_description: "NIVRAN Order",
    cart_currency: order.currency || "JOD",
    cart_amount: Number(order.amount || 0),
    return: returnUrl,
    callback: callbackUrl,
    customer_details: {
      name: customerName,
      email: customerEmail,
      phone: order.customer_phone || order.customer?.phone || "",
      street1: line1,
      city,
      state: "",
      country,
      zip: "",
    },
    shipping_details: {
      name: customerName,
      email: customerEmail,
      phone: order.customer_phone || order.customer?.phone || "",
      street1: line1,
      city,
      state: "",
      country,
      zip: "",
    },
  };

  const res = await fetch(`${apiBase}/payment/request`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: serverKey,
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const json = (await res.json().catch(() => ({}))) as {
    redirect_url?: string;
    tran_ref?: string;
    message?: string;
    payment_result?: { response_status?: string };
  };

  if (!res.ok || !json?.redirect_url) {
    await db.query(
      "update orders set paytabs_last_payload=$2, paytabs_response_status=$3, paytabs_response_message=$4, updated_at=now() where cart_id=$1",
      [cartId, JSON.stringify(payload), String(json?.payment_result?.response_status || ""), String(json?.message || "")]
    );
    return NextResponse.json({ ok: false, error: "PayTabs request failed", details: json }, { status: 400 });
  }

  await db.query(
    "update orders set paytabs_last_payload=$2, paytabs_tran_ref=$3, paytabs_response_status=$4, paytabs_response_message=$5, updated_at=now() where cart_id=$1",
    [
      cartId,
      JSON.stringify(payload),
      String(json.tran_ref || ""),
      String(json?.payment_result?.response_status || ""),
      String(json?.message || ""),
    ]
  );

  return NextResponse.json({ ok: true, redirectUrl: json.redirect_url, tranRef: json.tran_ref });
}
