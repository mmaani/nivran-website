import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  computePaytabsSignature,
  getPaytabsEnv,
  mapPaytabsResponseStatusToOrderStatus,
  safeEqualHex,
} from "@/lib/paytabs";

export const runtime = "nodejs";

// cache this check in-memory (per lambda warm instance)
let _hasPayloadCol: boolean | null = null;

async function hasPayloadColumn(): Promise<boolean> {
  if (_hasPayloadCol !== null) return _hasPayloadCol;
  const r = await db.query(
    "select 1 from information_schema.columns where table_name='paytabs_callbacks' and column_name='payload' limit 1"
  );
  _hasPayloadCol = r.rowCount > 0;
  return _hasPayloadCol;
}

export async function POST(req: Request) {
  const { serverKey } = getPaytabsEnv();

  const rawBody = await req.text(); // IMPORTANT for signature verification :contentReference[oaicite:8]{index=8}
  const headerSig =
    req.headers.get("signature") ||
    req.headers.get("Signature") ||
    req.headers.get("x-paytabs-signature") ||
    "";

  const computedSig = computePaytabsSignature(rawBody, serverKey);
  const sigValid = headerSig ? safeEqualHex(headerSig, computedSig) : false;

  let data: any = null;
  try {
    data = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    data = null;
  }

  const cartId = String(data?.cart_id || data?.cartId || "").trim();
  const tranRef = String(data?.tran_ref || data?.tranRef || "").trim();
  const respStatus = String(data?.payment_result?.response_status || "").trim();

  // Log callback (even if invalid signature) so you can debug
  try {
    const cols = await hasPayloadColumn();
    if (cols) {
      await db.query(
        `insert into paytabs_callbacks (cart_id, tran_ref, signature_header, signature_computed, signature_valid, raw_body, payload)
         values ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
        [cartId, tranRef, headerSig, computedSig, sigValid, rawBody, JSON.stringify(data ?? {})]
      );
    } else {
      await db.query(
        `insert into paytabs_callbacks (cart_id, tran_ref, signature_header, signature_computed, signature_valid, raw_body)
         values ($1,$2,$3,$4,$5,$6)`,
        [cartId, tranRef, headerSig, computedSig, sigValid, rawBody]
      );
    }
  } catch {
    // do not fail callback due to logging
  }

  if (!sigValid) {
    // PayTabs recommends verifying signature for callbacks :contentReference[oaicite:9]{index=9}
    return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });
  }

  if (!cartId) {
    return NextResponse.json({ ok: false, error: "Missing cart_id" }, { status: 400 });
  }

  const newStatus = mapPaytabsResponseStatusToOrderStatus(respStatus);

  // Update order
  await db.query(
    `update orders
       set status=$1,
           paytabs_last_payload=$2,
           paytabs_last_signature=$3,
           updated_at=now()
     where cart_id=$4`,
    [newStatus, JSON.stringify(data ?? {}), headerSig, cartId]
  );

  return NextResponse.json({ ok: true });
}
