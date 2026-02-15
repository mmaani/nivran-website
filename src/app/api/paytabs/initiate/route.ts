import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureOrdersTables } from "@/lib/orders";
import { getPaytabsEnv } from "@/lib/paytabs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  await ensureOrdersTables();

  const { profileId, serverKey, apiBase } = getPaytabsEnv();

  const body = await req.json().catch(() => ({}));
  const cartId = String(body?.cartId || "").trim();
  const locale = String(body?.locale || "en") === "ar" ? "ar" : "en";

  if (!cartId) {
    return NextResponse.json({ ok: false, error: "Missing cartId" }, { status: 400 });
  }

  const orderRes = await db.query(
    "select cart_id, amount, currency, customer_name, customer_email, customer, shipping, status from orders where cart_id=$1 limit 1",
    [cartId]
  );
  const order = orderRes.rows[0] as any;
  if (!order) {
    return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });
  }

  const origin = req.headers.get("origin") || "";
  if (!origin) {
    return NextResponse.json({ ok: false, error: "Missing origin" }, { status: 400 });
  }

  const returnUrl = `${origin}/${locale}/checkout/result?cartId=${encodeURIComponent(cartId)}`;
  const callbackUrl = `${origin}/api/paytabs/callback`;

  const customerEmail =
    order.customer_email || (order.customer && order.customer.email) || "test@example.com";
  const customerName =
    order.customer_name || (order.customer && order.customer.name) || "Customer";

  // For MVP we keep shipping/country simple, but include what we can.
  const shipping = order.shipping || {};
  const city = shipping.city || "Amman";
  const country = shipping.country || "JO";
  const line1 = shipping.address || "Address";

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
      phone: order.customer?.phone || "",
      street1: line1,
      city,
      state: "",
      country: country.length === 2 ? country : "JO",
      zip: "",
    },
    shipping_details: {
      name: customerName,
      email: customerEmail,
      phone: order.customer?.phone || "",
      street1: line1,
      city,
      state: "",
      country: country.length === 2 ? country : "JO",
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

  const json = await res.json().catch(() => ({}));

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
