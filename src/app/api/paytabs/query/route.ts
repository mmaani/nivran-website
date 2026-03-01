// src/app/api/paytabs/query/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureOrdersTables } from "@/lib/orders";
import {
  getPaytabsEnv,
  mapPaytabsResponseStatusToOrderStatus,
  paymentStatusTransitionAllowedFrom,
} from "@/lib/paytabs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PaytabsQueryResponse = {
  cart_id?: string;
  cartId?: string;
  tran_ref?: string;
  tranRef?: string;
  payment_result?: {
    response_status?: string;
    response_message?: string;
  };
  response_status?: string;
  response_message?: string;
};

function readInput(input: Record<string, unknown>) {
  const cartId = String(input?.cartId || input?.cart_id || "").trim();
  const tranRef = String(input?.tranRef || input?.tran_ref || "").trim();
  return { cartId, tranRef };
}

function normalizePaytabsPayload(raw: unknown): PaytabsQueryResponse {
  if (Array.isArray(raw)) {
    const first = raw[0];
    if (first && typeof first === "object") return first as PaytabsQueryResponse;
    return {};
  }
  if (raw && typeof raw === "object") return raw as PaytabsQueryResponse;
  return {};
}

async function handleQuery(input: Record<string, unknown>) {
  await ensureOrdersTables();
  const { apiBase, profileId, serverKey } = getPaytabsEnv();
  const { cartId, tranRef } = readInput(input);

  if (!cartId && !tranRef) {
    return NextResponse.json({ ok: false, error: "Provide tranRef or cartId" }, { status: 400 });
  }

  const body: Record<string, string> = { profile_id: profileId };
  if (tranRef) body.tran_ref = tranRef;
  else body.cart_id = cartId;

  const res = await fetch(`${apiBase}/payment/query`, {
    method: "POST",
    headers: { authorization: serverKey, "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const raw = (await res.json().catch(() => ({}))) as unknown;
  const data = normalizePaytabsPayload(raw);

  if (!res.ok) {
    return NextResponse.json({ ok: false, error: "PayTabs query failed", paytabs: raw }, { status: 502 });
  }

  const resolvedCartId = String(data?.cart_id || data?.cartId || cartId || "").trim();
  const resolvedTranRef = String(data?.tran_ref || data?.tranRef || tranRef || "").trim();

  const pr = data?.payment_result || {};
  const responseStatus = String(pr.response_status || data?.response_status || "").trim();
  const responseMessage = String(pr.response_message || data?.response_message || "").trim();

  const nextStatus = mapPaytabsResponseStatusToOrderStatus(responseStatus);
  const allowedFrom = paymentStatusTransitionAllowedFrom(nextStatus);

  let transitioned = false;
  let correctedPaid = false;

  if (resolvedCartId) {
    // We allow correction of PAID => FAILED/CANCELED ONLY if fulfillment did not start.
    // (Avoid auto-downgrading shipped/fulfilled orders.)
    const result = await db.query<{ status: string; inventory_committed_at: string | null }>(
      `update orders
          set status = case
                         when status = any($6::text[]) then $2
                         when status = 'PAID'
                          and $2 in ('FAILED','CANCELED')
                          and inventory_committed_at is null
                          then $2
                         else status
                       end,
              paytabs_tran_ref = coalesce(nullif($3::text,''), paytabs_tran_ref),
              paytabs_last_payload = $4::text,
              paytabs_response_status = $5::text,
              paytabs_response_message = $7::text,
              updated_at = now()
        where cart_id = $1::text
        returning status, inventory_committed_at`,
      [
        resolvedCartId,
        nextStatus,
        resolvedTranRef,
        JSON.stringify(raw), // keep the full original payload (object OR array) for debugging
        responseStatus,
        allowedFrom,
        responseMessage,
      ]
    );

    if (result.rows.length > 0) {
      const newStatus = String(result.rows[0].status || "").toUpperCase();
      transitioned = newStatus === nextStatus;
      correctedPaid = transitioned && (nextStatus === "FAILED" || nextStatus === "CANCELED");
    }
  }

  return NextResponse.json({
    ok: true,
    cartId: resolvedCartId,
    tranRef: resolvedTranRef,
    transitioned,
    correctedPaid,
    responseStatus,
    responseMessage,
    nextStatus,
    paytabs: raw, // return the full raw payload so you see what PayTabs sent
  });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return handleQuery(body);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  return handleQuery({
    cartId: url.searchParams.get("cartId") || url.searchParams.get("cart_id") || "",
    tranRef: url.searchParams.get("tranRef") || url.searchParams.get("tran_ref") || "",
  });
}