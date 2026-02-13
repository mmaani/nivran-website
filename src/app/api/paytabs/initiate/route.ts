import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPaytabsEnv } from "@/lib/paytabs";

export const runtime = "nodejs";

function asNum(v: any): number {
  const n = typeof v === "number" ? v : Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : 0;
}

function normalizeLocale(v: any) {
  return String(v || "").toLowerCase() === "ar" ? "ar" : "en";
}

function withVercelBypass(url: string) {
  // Only needed if you keep Vercel Deployment Protection ON.
  // For webhook URLs, Vercel supports query param x-vercel-protection-bypass. :contentReference[oaicite:6]{index=6}
  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET || "";
  if (!secret) return url;
  const u = new URL(url);
  u.searchParams.set("x-vercel-protection-bypass", secret);
  return u.toString();
}

export async function POST(req: Request) {
  try {
    const input = await req.json().catch(() => ({} as any));
    const cartId = String(input?.cartId || "").trim();
    const locale = normalizeLocale(input?.locale);

    if (!cartId) {
      return NextResponse.json({ ok: false, error: "cartId is required" }, { status: 400 });
    }

    const { profileId, serverKey, apiBase } = getPaytabsEnv();

    // Pull order (avoid referencing non-existent columns like total_jod)
    const orderRes = await db.query("select * from orders where cart_id=$1 limit 1", [cartId]);
    const order = orderRes.rows[0];
    if (!order) {
      return NextResponse.json({ ok: false, error: "Order not found for cartId" }, { status: 404 });
    }

    // Try to read pricing JSONB if you have it; fallback to safe MVP default if missing
    const pricing = (order as any).pricing;
    const total =
      asNum(pricing?.total) ||
      asNum(pricing?.total_jod) ||
      asNum((order as any).total) ||
      asNum((order as any).total_jod);

    const amount = total > 0 ? total : 21.5; // MVP fallback: 18 + 3.5 shipping

    const origin = process.env.APP_BASE_URL || new URL(req.url).origin;

    const callbackUrl = withVercelBypass(`${origin}/api/paytabs/callback`);
    const returnUrl = `${origin}/${locale}/checkout?cartId=${encodeURIComponent(cartId)}&paytabs=return`;

    const payload: any = {
      profile_id: profileId,
      tran_type: "sale",
      tran_class: "ecom",
      cart_id: cartId,
      cart_description: "NIVRAN order",
      cart_currency: "JOD",
      cart_amount: Number(amount.toFixed(2)),
      callback: callbackUrl,
      return: returnUrl,
    };

    // Initiate HPP (Payment Request)
    const resp = await fetch(`${apiBase}/payment/request`, {
      method: "POST",
      headers: {
        authorization: serverKey,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await resp.json().catch(() => ({} as any));

    // Persist last payload/signature (signature here is PayTabs response signature if present)
    await db.query(
      "update orders set paytabs_last_payload=$1, updated_at=now() where cart_id=$2",
      [JSON.stringify(data ?? {}), cartId]
    );

    if (!resp.ok) {
      return NextResponse.json(
        { ok: false, error: data?.message || "PayTabs initiate failed", paytabs: data || null },
        { status: 502 }
      );
    }

    const redirectUrl = data?.redirect_url || data?.redirectUrl || "";
    const tranRef = data?.tran_ref || "";

    if (!redirectUrl) {
      return NextResponse.json(
        { ok: false, error: "PayTabs did not return redirect_url", paytabs: data || null },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      cartId,
      tranRef,
      redirectUrl,
      callbackUrl, // helpful for debugging
      returnUrl,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Initiate failed" },
      { status: 500 }
    );
  }
}
