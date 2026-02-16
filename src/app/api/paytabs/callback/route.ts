import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureOrdersTables } from "@/lib/orders";
import {
  computePaytabsSignature,
  getPaytabsEnv,
  mapPaytabsResponseStatusToOrderStatus,
  paymentStatusTransitionAllowedFrom,
  safeEqualHex,
} from "@/lib/paytabs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PayTabs signature header (common patterns vary by integration)
const SIG_HEADER = "x-paytabs-signature";

type PaytabsCallbackPayload = {
  cart_id?: string;
  cartId?: string;
  tran_ref?: string;
  message?: string;
  payment_result?: {
    response_status?: string;
    response_message?: string;
  };
};

async function hasPayloadColumn(): Promise<boolean> {
  const r = await db.query(
    "select 1 from information_schema.columns where table_name='paytabs_callbacks' and column_name='payload' limit 1"
  );
  return (r.rowCount ?? 0) > 0;
}

export async function POST(req: Request) {
  await ensureOrdersTables();
  const { serverKey } = getPaytabsEnv();

  const rawBody = await req.text();
  const sigHeader = req.headers.get(SIG_HEADER) || "";

  const computed = computePaytabsSignature(rawBody, serverKey);
  const sigValid = !!sigHeader && safeEqualHex(sigHeader, computed);

  let payload: PaytabsCallbackPayload | null = null;
  try {
    payload = rawBody ? (JSON.parse(rawBody) as PaytabsCallbackPayload) : null;
  } catch {
    payload = null;
  }

  const cartId = String(payload?.cart_id || payload?.cartId || "").trim() || null;
  const tranRef = String(payload?.tran_ref || "").trim() || null;
  const respStatus = String(payload?.payment_result?.response_status || "").trim();
  const respMessage =
    String(payload?.payment_result?.response_message || payload?.message || "").trim() || null;

  // Always record callback (even invalid signature) for auditability
  try {
    const _hasPayload = await hasPayloadColumn();
    if (_hasPayload) {
      await db.query(
        `insert into paytabs_callbacks
          (cart_id, tran_ref, signature_header, signature_computed, signature_valid, raw_body, payload)
         values
          ($1,$2,$3,$4,$5,$6,$7)`,
        [cartId, tranRef, sigHeader || null, computed, sigValid, rawBody, payload ? JSON.stringify(payload) : null]
      );
    } else {
      await db.query(
        `insert into paytabs_callbacks
          (cart_id, tran_ref, signature_header, signature_computed, signature_valid, raw_body)
         values
          ($1,$2,$3,$4,$5,$6)`,
        [cartId, tranRef, sigHeader || null, computed, sigValid, rawBody]
      );
    }
  } catch {
    // ignore logging errors (should not block callback)
  }

  if (!sigValid) {
    return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 400 });
  }

  if (!cartId) {
    return NextResponse.json({ ok: false, error: "Missing cart_id" }, { status: 400 });
  }

  const nextStatus = mapPaytabsResponseStatusToOrderStatus(respStatus);
  const allowedFrom = paymentStatusTransitionAllowedFrom(nextStatus);

  await db.query(
    `update orders
        set paytabs_tran_ref = coalesce(nullif($2,''), paytabs_tran_ref),
            paytabs_last_payload = $3,
            paytabs_last_signature = $4,
            paytabs_response_status = $5,
            paytabs_response_message = $6,
            status = case when status = any($7) then $8 else status end,
            updated_at = now()
      where cart_id = $1`,
    [
      cartId,
      tranRef || "",
      rawBody,
      sigHeader || "",
      respStatus,
      respMessage,
      allowedFrom,
      nextStatus,
    ]
  );

  return NextResponse.json({ ok: true });
}
