// src/app/api/paytabs/callback/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureOrdersTables, commitInventoryForPaidCart } from "@/lib/orders";
import { consumePromotionUsage } from "@/lib/promotions";
import { sendOrderThankYouEmail } from "@/lib/email";
import { hasSuccessfulEmailByKindAndMeta } from "@/lib/emailLog";
import {
  computePaytabsSignature,
  getPaytabsEnv,
  mapPaytabsResponseStatusToOrderStatus,
  paymentStatusTransitionAllowedFrom,
  safeEqualHex,
} from "@/lib/paytabs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PayTabs signature header (may be absent depending on account/integration)
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

type PaytabsQueryResponse = {
  tran_ref?: string;
  cart_id?: string;
  cartId?: string;
  payment_result?: {
    response_status?: string;
    response_message?: string;
  };
  response_status?: string;
  response_message?: string;
};

async function hasPayloadColumn(): Promise<boolean> {
  const r = await db.query(
    "select 1 from information_schema.columns where table_name='paytabs_callbacks' and column_name='payload' limit 1"
  );
  return (r.rowCount ?? 0) > 0;
}

type OrderForConsume = {
  cart_id: string;
  status: string;
  discount_source: string | null;
  promo_code: string | null;
  promotion_id: string | number | null;
  promo_consumed: boolean | null;
  promo_consume_failed: boolean | null;
};

function toInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.trunc(value);
  if (typeof value === "string") {
    const n = Number(value.trim());
    if (Number.isFinite(n) && n > 0) return Math.trunc(n);
  }
  return null;
}

async function tryConsumeCodePromoOnPaid(cartId: string): Promise<void> {
  await db.withTransaction(async (trx) => {
    const { rows } = await trx.query<OrderForConsume>(
      `select cart_id, status, discount_source, promo_code, promotion_id,
              promo_consumed, promo_consume_failed
         from orders
        where cart_id = $1
        for update`,
      [cartId]
    );

    const order = rows[0];
    if (!order) return;

    const status = String(order.status || "").toUpperCase();
    const isPaid = status === "PAID" || status === "PAID_COD";
    if (!isPaid) return;

    const source = String(order.discount_source || "").toUpperCase();
    if (source !== "CODE") return;

    if (order.promo_consumed === true) return;

    const promotionId = toInt(order.promotion_id);
    if (!promotionId) return;

    const consumed = await consumePromotionUsage(trx, promotionId);

    if (consumed) {
      await trx.query(
        `update orders
            set promo_consumed = true,
                promo_consumed_at = now(),
                promo_consume_failed = false,
                promo_consume_error = null,
                updated_at = now()
          where cart_id = $1`,
        [cartId]
      );
      return;
    }

    await trx.query(
      `update orders
          set promo_consume_failed = true,
              promo_consume_error = 'PROMO_USAGE_LIMIT',
              promo_consumed_at = coalesce(promo_consumed_at, now()),
              updated_at = now()
        where cart_id = $1
          and coalesce(promo_consumed, false) = false`,
      [cartId]
    );
  });
}

async function tryCommitInventoryOnPaid(cartId: string): Promise<void> {
  await db.withTransaction(async (trx) => {
    await commitInventoryForPaidCart(trx, cartId);
  });
}

type OrderEmailRow = {
  cart_id: string;
  customer_name: string | null;
  customer_email: string | null;
  total_jod: string | null;
  items: unknown;
};

async function trySendPaidOrderThankYouEmail(cartId: string): Promise<void> {
  const orderRes = await db.query<OrderEmailRow>(
    `select cart_id, customer_name, customer_email, total_jod::text, items
       from orders
      where cart_id = $1
      limit 1`,
    [cartId]
  );

  const order = orderRes.rows[0];
  if (!order) return;

  const to = String(order.customer_email || "").trim().toLowerCase();
  if (!to) return;

  const alreadySent = await hasSuccessfulEmailByKindAndMeta({
    kind: "order_thank_you",
    to,
    metaKey: "cartId",
    metaValue: cartId,
  }).catch(() => false);
  if (alreadySent) return;

  const rawItems = Array.isArray(order.items) ? order.items : [];
  const items = rawItems.map((entry) => {
    if (!entry || typeof entry !== "object") return { nameEn: "Item", nameAr: null, qty: 1, totalJod: 0 };
    const row = entry as Record<string, unknown>;
    return {
      nameEn: String(row.name_en || row.nameEn || row.slug || "Item"),
      nameAr: row.name_ar ? String(row.name_ar) : null,
      qty: Math.max(1, Math.trunc(Number(row.requested_qty || row.qty || 1))),
      totalJod: Number(row.line_total_jod || row.lineTotalJod || 0),
    };
  });

  await sendOrderThankYouEmail({
    to,
    customerName: String(order.customer_name || "Customer"),
    items,
    totalJod: Number(order.total_jod || 0),
    accountUrl: "https://www.nivran.com/en/account",
    returningCustomer: true,
    cartId,
  });
}

async function queryPaytabsByTranRef(tranRef: string): Promise<PaytabsQueryResponse | null> {
  if (!tranRef) return null;

  const { profileId, serverKey, apiBase } = getPaytabsEnv();

  const res = await fetch(`${apiBase}/payment/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: serverKey,
    },
    body: JSON.stringify({
      profile_id: profileId,
      tran_ref: tranRef,
    }),
    cache: "no-store",
  });

  const json = (await res.json().catch(() => null)) as PaytabsQueryResponse | null;
  if (!json) return null;
  return json;
}

export async function POST(req: Request) {
  await ensureOrdersTables();
  const { serverKey } = getPaytabsEnv();

  const rawBody = await req.text();
  const sigHeader = (req.headers.get(SIG_HEADER) || "").trim();

  const computed = computePaytabsSignature(rawBody, serverKey);
  const sigValid = !!sigHeader && safeEqualHex(sigHeader, computed);

  let payload: PaytabsCallbackPayload | null = null;
  try {
    payload = rawBody ? (JSON.parse(rawBody) as PaytabsCallbackPayload) : null;
  } catch {
    payload = null;
  }

  const cartIdFromBody = String(payload?.cart_id || payload?.cartId || "").trim();
  const tranRefFromBody = String(payload?.tran_ref || "").trim();
  const respStatusFromBody = String(payload?.payment_result?.response_status || "").trim();
  const respMessageFromBody =
    String(payload?.payment_result?.response_message || payload?.message || "").trim() || "";

  // Always record callback (even unsigned) for auditability.
  // IMPORTANT: do NOT rely on PayTabs sending a signature header; some accounts don't.
  // We dedupe by (cart_id, tran_ref, raw_body hash-ish) via "best effort": if you want strict dedupe, use a DB unique constraint.
  try {
    const _hasPayload = await hasPayloadColumn();

    // If you created a unique index (recommended) use ON CONFLICT DO NOTHING.
    // NOTE: ON CONFLICT (tran_ref) works ONLY if there is a UNIQUE constraint/index on (tran_ref).
    // If not present, Postgres will throw; we catch and ignore to avoid breaking callbacks.
    const conflict = "on conflict (tran_ref) do nothing";

    if (_hasPayload) {
      await db.query(
        `insert into paytabs_callbacks
          (cart_id, tran_ref, signature_header, signature_computed, signature_valid, raw_body, payload)
         values
          ($1,$2,$3,$4,$5,$6,$7)
         ${conflict}`,
        [
          cartIdFromBody || null,
          tranRefFromBody || null,
          sigHeader || null,
          computed,
          sigValid,
          rawBody,
          payload ? (payload as unknown) : null,
        ]
      );
    } else {
      await db.query(
        `insert into paytabs_callbacks
          (cart_id, tran_ref, signature_header, signature_computed, signature_valid, raw_body)
         values
          ($1,$2,$3,$4,$5,$6)
         ${conflict}`,
        [cartIdFromBody || null, tranRefFromBody || null, sigHeader || null, computed, sigValid, rawBody]
      );
    }
  } catch {
    // ignore logging errors (should not block callback)
  }

  // Decide verification source:
  // - If signature is valid => trust callback payload.
  // - If signature missing/invalid => do NOT trust payload; verify via PayTabs query using tran_ref.
  let cartId = cartIdFromBody;
  const tranRef = tranRefFromBody; // const (lint)
  let respStatus = respStatusFromBody;
  let respMessage = respMessageFromBody;

  let verified = false;

  if (sigValid) {
    verified = true;
  } else {
    if (!tranRef) {
      // Can't verify. ACK to stop retries.
      return NextResponse.json({ ok: true, accepted: true, verified: false }, { status: 200 });
    }

    const q = await queryPaytabsByTranRef(tranRef).catch(() => null);
    if (!q) {
      // Can't verify right now; ACK to stop retries.
      return NextResponse.json({ ok: true, accepted: true, verified: false }, { status: 200 });
    }

    verified = true;
    cartId = String(q.cart_id || q.cartId || cartIdFromBody || "").trim();
    const pr = q.payment_result || {};
    respStatus = String(pr.response_status || q.response_status || "").trim();
    respMessage = String(pr.response_message || q.response_message || "").trim();
  }

  if (!cartId) {
    // ACK to stop retries
    return NextResponse.json({ ok: true, accepted: true, verified }, { status: 200 });
  }

  const nextStatus = mapPaytabsResponseStatusToOrderStatus(respStatus);
  const allowedFrom = paymentStatusTransitionAllowedFrom(nextStatus);

  await db.query(
    `update orders
        set paytabs_tran_ref = coalesce(nullif($2::text,''), paytabs_tran_ref),
            paytabs_last_payload = $3::text,
            paytabs_last_signature = $4::text,
            paytabs_response_status = $5::text,
            paytabs_response_message = $6::text,
            status = case when status = any($7::text[]) then $8::text else status end,
            updated_at = now()
      where cart_id = $1::text`,
    [cartId, tranRef, rawBody, sigHeader, respStatus, respMessage, allowedFrom, nextStatus]
  );

  // If payment succeeded, commit inventory and consume CODE promo usage now (one-time).
  if (nextStatus === "PAID") {
    try {
      await tryCommitInventoryOnPaid(cartId);
    } catch {}

    try {
      await tryConsumeCodePromoOnPaid(cartId);
    } catch {}

    try {
      await trySendPaidOrderThankYouEmail(cartId);
    } catch {}
  }

  // Always ACK 200 so PayTabs stops retrying.
  return NextResponse.json(
    { ok: true, accepted: true, signatureValid: sigValid, verified, nextStatus },
    { status: 200 }
  );
}