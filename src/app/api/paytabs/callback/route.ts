import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";

export const runtime = "nodejs";

function hmacSha256Hex(raw: string, key: string) {
  return crypto.createHmac("sha256", key).update(raw, "utf8").digest("hex");
}

function safeTimingEqual(a: string, b: string) {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

function tryJson(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function tryForm(raw: string) {
  try {
    const usp = new URLSearchParams(raw);
    const obj: Record<string, any> = {};
    for (const [k, v] of usp.entries()) obj[k] = v;
    return Object.keys(obj).length ? obj : null;
  } catch {
    return null;
  }
}

function pick(obj: any, keys: string[]) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).length) return String(v);
  }
  return "";
}

function extractResponseStatus(payload: any) {
  // PayTabs commonly uses payment_result.response_status
  const s =
    payload?.payment_result?.response_status ??
    payload?.payment_result?.responseStatus ??
    payload?.response_status ??
    payload?.respStatus ??
    payload?.resp_status;
  return s ? String(s) : "";
}

export async function POST(req: Request) {
  const pool = db();

  const serverKey = process.env.PAYTABS_SERVER_KEY || "";
  if (!serverKey) {
    return NextResponse.json({ ok: false, error: "Missing PAYTABS_SERVER_KEY" }, { status: 500 });
  }

  const raw = await req.text();

  const sigHeader =
    req.headers.get("signature") ||
    req.headers.get("Signature") ||
    req.headers.get("SIGNATURE") ||
    "";

  const sigComputed = hmacSha256Hex(raw, serverKey);
  const sigValid = safeTimingEqual(sigComputed, sigHeader);

  // Parse as JSON first, then as form-encoded
  const parsedJson = tryJson(raw);
  const parsedForm = parsedJson ? null : tryForm(raw);
  const payload = parsedJson || parsedForm || {};

  const cartId = pick(payload, ["cart_id", "cartId", "cartID", "cart"]);
  const tranRef = pick(payload, ["tran_ref", "tranRef", "transaction_reference", "transactionRef"]);
  const respStatus = extractResponseStatus(payload);

  // Always log callback attempt
  try {
    await pool.query(
      `insert into paytabs_callbacks (cart_id, tran_ref, signature_header, signature_computed, signature_valid, raw_body)
       values ($1,$2,$3,$4,$5,$6)`,
      [cartId, tranRef, sigHeader, sigComputed, sigValid, raw]
    );
  } catch {
    // If your table has different columns, we still don't want to crash the webhook:
  }

  // Only update order on valid signature + known cart id
  if (sigValid && cartId) {
    // Response status: "A" is commonly Authorised (success).
    // Map success to PAID (then your ops/admin can move to PROCESSING/SHIPPED later).
    const nextStatus =
      respStatus === "A" ? "PAID" :
      respStatus === "C" ? "CANCELED" :
      respStatus ? "PAYMENT_FAILED" : "PENDING_PAYMENT";

    try {
      await pool.query(
        `
        update orders
           set status = case
                          when status = 'PENDING_PAYMENT' then $2
                          else status
                        end,
               paytabs_tran_ref = coalesce(nullif($3,''), paytabs_tran_ref),
               paytabs_last_payload = $4,
               paytabs_last_signature = $5,
               updated_at = now()
         where cart_id = $1
        `,
        [cartId, nextStatus, tranRef, raw, sigHeader]
      );
    } catch {}

    return NextResponse.json({ ok: true, cartId, tranRef, sigValid, respStatus });
  }

  return NextResponse.json({ ok: false, cartId, tranRef, sigValid }, { status: sigValid ? 200 : 401 });
}
