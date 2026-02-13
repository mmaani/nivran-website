import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const pool = db();

  const apiBase = process.env.PAYTABS_API_BASE_URL || "";
  const serverKey = process.env.PAYTABS_SERVER_KEY || "";
  const profileId = process.env.PAYTABS_PROFILE_ID || "";

  if (!apiBase) return NextResponse.json({ ok: false, error: "Missing PAYTABS_API_BASE_URL" }, { status: 500 });
  if (!serverKey) return NextResponse.json({ ok: false, error: "Missing PAYTABS_SERVER_KEY" }, { status: 500 });
  if (!profileId) return NextResponse.json({ ok: false, error: "Missing PAYTABS_PROFILE_ID" }, { status: 500 });

  const input = await req.json().catch(() => ({} as any));
  const cartId = String(input?.cartId || input?.cart_id || "");
  const tranRef = String(input?.tranRef || input?.tran_ref || "");

  if (!cartId && !tranRef) {
    return NextResponse.json({ ok: false, error: "Provide cartId or tranRef" }, { status: 400 });
  }

  const body: any = { profile_id: profileId };
  if (tranRef) body.tran_ref = tranRef;
  else body.cart_id = cartId;

  const res = await fetch(`${apiBase.replace(/\/$/, "")}/payment/query`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: serverKey },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) return NextResponse.json({ ok: false, error: "PayTabs query failed", paytabs: data }, { status: 502 });

  const ptCartId = String(data?.cart_id || cartId || "");
  const respStatus = String(data?.payment_result?.response_status || "");
  const nextStatus =
    respStatus === "A" ? "PAID" :
    respStatus === "C" ? "CANCELED" :
    respStatus ? "PAYMENT_FAILED" : "PENDING_PAYMENT";

  if (ptCartId) {
    await pool.query(
      `update orders set status = case when status='PENDING_PAYMENT' then $2 else status end,
                         paytabs_last_payload = $3,
                         updated_at = now()
        where cart_id = $1`,
      [ptCartId, nextStatus, JSON.stringify(data)]
    );
  }

  return NextResponse.json({ ok: true, cartId: ptCartId, respStatus, paytabs: data });
}
