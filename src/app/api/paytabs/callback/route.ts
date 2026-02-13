import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  computePaytabsSignature,
  mapPaytabsResponseStatusToOrderStatus,
  paymentStatusTransitionAllowedFrom,
  safeEqualHex,
} from "@/lib/paytabs";

export const runtime = "nodejs";

function parseCallbackBody(raw: string, contentType: string | null) {
  const type = String(contentType || "").toLowerCase();

  if (type.includes("application/x-www-form-urlencoded")) {
    const form = new URLSearchParams(raw);
    return Object.fromEntries(form.entries());
  }

  try {
    return JSON.parse(raw);
  } catch {
    const form = new URLSearchParams(raw);
    const data = Object.fromEntries(form.entries());
    return Object.keys(data).length ? data : {};
  }
}

function readValue(payload: any, keys: string[]) {
  for (const key of keys) {
    const value = payload?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return "";
}

export async function POST(req: Request) {
  const serverKey = process.env.PAYTABS_SERVER_KEY || "";
  if (!serverKey) {
    return NextResponse.json({ ok: false, error: "Missing PAYTABS_SERVER_KEY" }, { status: 500 });
  }

  const rawBody = await req.text();
  const signatureHeader =
    req.headers.get("signature") ||
    req.headers.get("Signature") ||
    req.headers.get("SIGNATURE") ||
    "";

  const signatureComputed = computePaytabsSignature(rawBody, serverKey);
  const signatureValid = safeEqualHex(signatureComputed, signatureHeader);

  const payload = parseCallbackBody(rawBody, req.headers.get("content-type"));
  const cartId = readValue(payload, ["cart_id", "cartId", "cart"]);
  const tranRef = readValue(payload, ["tran_ref", "tranRef", "transaction_reference"]);
  const responseStatus =
    readValue(payload?.payment_result || {}, ["response_status", "responseStatus"]) ||
    readValue(payload, ["response_status", "respStatus", "resp_status"]);

  await db.query(
    `insert into paytabs_callbacks (
      cart_id, tran_ref, signature_header, signature_computed, signature_valid, raw_body
    ) values ($1,$2,$3,$4,$5,$6)`,
    [cartId || null, tranRef || null, signatureHeader, signatureComputed, signatureValid, rawBody]
  );

  if (!signatureValid) {
    return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });
  }

  let transitioned = false;

  if (cartId) {
    const nextStatus = mapPaytabsResponseStatusToOrderStatus(responseStatus);
    const allowedFrom = paymentStatusTransitionAllowedFrom(nextStatus);

    const result = await db.query(
      `update orders
          set status=case when status = any($6::text[]) then $2 else status end,
              paytabs_tran_ref=coalesce(nullif($3,''), paytabs_tran_ref),
              paytabs_last_payload=$4,
              paytabs_last_signature=$5,
              updated_at=now()
        where cart_id=$1
        returning status`,
      [cartId, nextStatus, tranRef, rawBody, signatureHeader, allowedFrom]
    );

    transitioned = result.rows.length > 0 && result.rows[0].status === nextStatus;
  }

  return NextResponse.json({ ok: true, signatureValid, cartId, tranRef, transitioned });
}
