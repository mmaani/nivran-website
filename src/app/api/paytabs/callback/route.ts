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
    req.headers.get("X-Signature");

  const ok = verifyPaytabsCallbackSignature(rawBody, sig);
  if (!ok) return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });

  let payload: any = {};
  try { payload = JSON.parse(rawBody); } catch { payload = { raw: rawBody }; }

  const cartId = payload?.cart_id || payload?.cartId;
  const tranRef = payload?.tran_ref || payload?.tranRef;

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

  // PayTabs commonly uses "A" for approved in some payloads; keep mapping simple for MVP.
  const s = String(responseStatus || "").toLowerCase();
  const newStatus = (s === "a" || s === "approved") ? "PAID" : "FAILED";

  if (cartId) {
    const pool = db();
    await pool.query(
      `update orders
       set status=$2,
           paytabs_tran_ref=$3,
           paytabs_response_status=$4,
           paytabs_response_message=$5,
           paytabs_payload=$6,
           updated_at=now()
       where cart_id=$1`,
      [String(cartId), newStatus, tranRef || null, responseStatus, responseMessage, payload]
    );
  }

  return NextResponse.json({ ok: true });
}
