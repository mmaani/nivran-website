import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureOrdersTables } from "@/lib/orders";
import { getPaytabsEnv } from "@/lib/paytabs";

export const runtime = "nodejs";

function normalizeLocale(v: unknown) {
  return String(v || "").toLowerCase() === "ar" ? "ar" : "en";
}

function withVercelBypass(url: string) {
  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET || "";
  if (!secret) return url;
  const u = new URL(url);
  u.searchParams.set("x-vercel-protection-bypass", secret);
  return u.toString();
}

export async function POST(req: Request) {
  await ensureOrdersTables();
  try {
    const input = await req.json().catch(() => ({} as Record<string, unknown>));
    const cartId = String(input?.cartId || "").trim();
    const locale = normalizeLocale(input?.locale);

    if (!cartId) {
      return NextResponse.json({ ok: false, error: "cartId is required" }, { status: 400 });
    }

    const { profileId, serverKey, apiBase } = getPaytabsEnv();
    const orderRes = await db.query("select * from orders where cart_id=$1 limit 1", [cartId]);
    const order = orderRes.rows[0] as Record<string, any> | undefined;

    if (!order) {
      return NextResponse.json({ ok: false, error: "Order not found for cartId" }, { status: 404 });
    }

    const amount = Number(order.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ ok: false, error: "Order amount is invalid" }, { status: 400 });
    }

    const origin = process.env.APP_BASE_URL || new URL(req.url).origin;
    const callbackUrl = withVercelBypass(`${origin}/api/paytabs/callback`);
    const returnUrl = `${origin}/${locale}/checkout?cartId=${encodeURIComponent(cartId)}&paytabs=return`;

    const payload = {
      profile_id: profileId,
      tran_type: "sale",
      tran_class: "ecom",
      cart_id: cartId,
      cart_description: "NIVRAN order",
      cart_currency: "JOD",
      cart_amount: Number(amount.toFixed(2)),
      callback: callbackUrl,
      return: returnUrl,
      customer_details: {
        name: order.customer_name || undefined,
        email: order.customer_email || undefined,
      },
    };

    const resp = await fetch(`${apiBase}/payment/request`, {
      method: "POST",
      headers: {
        authorization: serverKey,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const data = await resp.json().catch(() => ({} as Record<string, unknown>));
    const tranRef = String((data as any)?.tran_ref || "");
    const redirectUrl = String((data as any)?.redirect_url || (data as any)?.redirectUrl || "");

    await db.query(
      `update orders
          set status='PENDING_PAYMENT',
              paytabs_tran_ref=coalesce(nullif($1,''), paytabs_tran_ref),
              paytabs_last_payload=$2,
              updated_at=now()
        where cart_id=$3`,
      [tranRef, JSON.stringify(data ?? {}), cartId]
    );

    if (!resp.ok || !redirectUrl) {
      return NextResponse.json(
        {
          ok: false,
          error: (data as any)?.message || "PayTabs initiate failed",
          paytabs: data || null,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, redirectUrl, tranRef, callbackUrl, returnUrl });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Initiate failed" }, { status: 500 });
  }
}
