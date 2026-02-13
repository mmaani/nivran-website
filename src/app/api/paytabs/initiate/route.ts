import { NextResponse } from "next/server";
import { paytabsEnv } from "@/lib/paytabs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });

  const { profileId, serverKey, baseUrl } = paytabsEnv();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const payload = {
    profile_id: profileId,
    tran_type: "sale",
    tran_class: "ecom",
    cart_id: body.orderId || `cart_${Date.now()}`,
    cart_description: "NIVRAN Order",
    cart_currency: "JOD",
    cart_amount: body.amountJod || 0,
    callback: `${siteUrl}/api/paytabs/callback`,
    return: `${siteUrl}/en/checkout?result=paytabs`,
    customer_details: body.customer || {}
  };

  const res = await fetch(`${baseUrl}/payment/request`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: serverKey },
    body: JSON.stringify(payload)
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json({ ok: res.ok, data }, { status: res.ok ? 200 : 400 });
}
