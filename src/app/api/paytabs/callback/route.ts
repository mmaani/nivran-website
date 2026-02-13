import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getPayTabsConfig,
  hmacSha256Hex,
  timingSafeEqualHex,
  parseMaybeJsonOrForm,
  extractCartId,
  extractTranRef,
  isApprovedPayTabsPayload,
} from "@/lib/paytabs";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const cfg = getPayTabsConfig();

  // Verify signature using RAW body
  const raw = await req.text();
  const sigHeader =
    req.headers.get("signature") ||
    req.headers.get("Signature") ||
    req.headers.get("x-signature") ||
    "";

  const computed = hmacSha256Hex(raw, cfg.serverKey);
  const sigValid = sigHeader ? timingSafeEqualHex(computed, sigHeader) : false;

  const payload = parseMaybeJsonOrForm(raw);
  const cartId = extractCartId(payload);
  const tranRef = extractTranRef(payload);

  const pool = db();

  // Always log callback (even invalid)
  try {
    await pool.query(
      `insert into paytabs_callbacks (received_at, cart_id, tran_ref, signature_header, signature_computed, signature_valid, raw_body)
       values (now(), $1, $2, $3, $4, $5, $6)`,
      [cartId || null, tranRef || null, sigHeader || null, computed, sigValid, raw]
    );
  } catch {
    // ignore if table not present
  }

  if (!sigValid) {
    return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });
  }

  const approved = isApprovedPayTabsPayload(payload);

  if (cartId) {
    if (approved) {
      await pool.query(
        `update orders
         set status = 'PAID',
             payment_method = 'PAYTABS',
             paytabs_last_payload = $2,
             paytabs_last_signature = $3,
             updated_at = now()
         where cart_id = $1`,
        [cartId, raw, sigHeader]
      );
    } else {
      await pool.query(
        `update orders
         set status = 'FAILED',
             payment_method = 'PAYTABS',
             paytabs_last_payload = $2,
             paytabs_last_signature = $3,
             updated_at = now()
         where cart_id = $1`,
        [cartId, raw, sigHeader]
      );
    }
  }

  return NextResponse.json({ ok: true, cartId, tranRef, approved });
}
