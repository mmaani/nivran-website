// src/app/api/paytabs/callback/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureOrdersTables, commitInventoryForPaidCart } from "@/lib/orders";
import { consumePromotionUsage } from "@/lib/promotions";
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

    // Do not alter financial totals after payment.
    // Mark for admin review.
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

  const cartId = String(payload?.cart_id || payload?.cartId || "").trim() || "";
  const tranRef = String(payload?.tran_ref || "").trim() || "";
  const respStatus = String(payload?.payment_result?.response_status || "").trim();
  const respMessage =
    String(payload?.payment_result?.response_message || payload?.message || "").trim() || "";

  // Always record callback (even invalid signature) for auditability
  try {
    const _hasPayload = await hasPayloadColumn();
    if (_hasPayload) {
      await db.query(
        `insert into paytabs_callbacks
          (cart_id, tran_ref, signature_header, signature_computed, signature_valid, raw_body, payload)
         values
          ($1,$2,$3,$4,$5,$6,$7)`,
        [
          cartId || null,
          tranRef || null,
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
          ($1,$2,$3,$4,$5,$6)`,
        [cartId || null, tranRef || null, sigHeader || null, computed, sigValid, rawBody]
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
    } catch {
      // ignore inventory errors
    }
    try {
      await tryConsumeCodePromoOnPaid(cartId);
    } catch {
      // ignore consume errors
    }
  }

  return NextResponse.json({ ok: true });
}