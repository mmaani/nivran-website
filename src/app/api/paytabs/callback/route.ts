import { NextResponse } from "next/server";
import { verifyPaytabsCallbackSignature } from "@/lib/paytabs";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const rawBody = await req.text();

  const sig =
    req.headers.get("signature") ||
    req.headers.get("Signature") ||
    req.headers.get("x-signature") ||
    req.headers.get("X-Signature") ||
    "";

  let payload: any = {};
  try { payload = JSON.parse(rawBody); } catch { payload = { raw: rawBody }; }

  const cartId = String(payload?.cart_id || payload?.cartId || "");
  const tranRef = String(payload?.tran_ref || payload?.tranRef || "");

  const pool = db();

  // 1) Log FIRST (even if signature is wrong)
  await pool.query(
    `insert into paytabs_callbacks (signature, verified, cart_id, tran_ref, payload)
     values ($1, $2, $3, $4, $5)`,
    [sig || null, false, cartId || null, tranRef || null, payload]
  );

  // 2) Verify signature (PayTabs sends Signature header hashed using Profile Server Key)
  // Ref: PayTabs Signature Verification docs. :contentReference[oaicite:1]{index=1}
  const ok = verifyPaytabsCallbackSignature(rawBody, sig);
  if (!ok) {
    return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });
  }

  // 3) Mark latest callback row as verified
  await pool.query(
    `update paytabs_callbacks
     set verified=true
     where id = (select id from paytabs_callbacks order by id desc limit 1)`
  );

  // 4) Update order status (basic mapping)
  const responseStatus =
    payload?.payment_result?.response_status ??
    payload?.payment_result?.responseStatus ??
    payload?.response_status ??
    null;

  const responseMessage =
    payload?.payment_result?.response_message ??
    payload?.payment_result?.responseMessage ??
    payload?.response_message ??
    null;

  const s = String(responseStatus || "").toLowerCase();
  const newStatus = (s === "a" || s === "approved") ? "PAID" : "FAILED";

  if (cartId) {
    await pool.query(
      `update orders
       set status=$2,
           paytabs_tran_ref=$3,
           paytabs_response_status=$4,
           paytabs_response_message=$5,
           paytabs_payload=$6,
           updated_at=now()
       where cart_id=$1`,
      [cartId, newStatus, tranRef || null, responseStatus, responseMessage, payload]
    );
  }

  return NextResponse.json({ ok: true });
}
