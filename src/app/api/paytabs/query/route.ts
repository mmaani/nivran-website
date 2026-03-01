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

type PaytabsQueryItem = {
  cart_id?: string;
  cartId?: string;
  tran_ref?: string;
  tranRef?: string;
  payment_result?: {
    response_status?: string;
    response_message?: string;
    transaction_time?: string;
  };
  response_status?: string;
  response_message?: string;
  transaction_time?: string;
};

type PaytabsQueryResponse = PaytabsQueryItem | PaytabsQueryItem[];

function readInput(input: Record<string, unknown>) {
  return {
    cartId: String((input as Record<string, unknown>)?.cartId || (input as Record<string, unknown>)?.cart_id || "").trim(),
    tranRef: String((input as Record<string, unknown>)?.tranRef || (input as Record<string, unknown>)?.tran_ref || "").trim(),
  };
}

function txMs(item: PaytabsQueryItem): number {
  return Number.isFinite(Date.parse(String(item?.payment_result?.transaction_time || item?.transaction_time || "")))
    ? Date.parse(String(item?.payment_result?.transaction_time || item?.transaction_time || ""))
    : -1;
}

function pickMostRelevant(data: PaytabsQueryResponse): PaytabsQueryItem {
  return Array.isArray(data)
    ? (data
        .slice()
        .sort((a, b) => txMs(a) - txMs(b))
        .at(-1) || data.at(-1) || {})
    : (data || {});
}

async function handleQuery(input: Record<string, unknown>) {
  await ensureOrdersTables();

  if (!readInput(input).cartId && !readInput(input).tranRef) {
    return NextResponse.json({ ok: false, error: "Provide tranRef or cartId" }, { status: 400 });
  }

  if (!readInput(input).cartId && !readInput(input).tranRef) {
    return NextResponse.json({ ok: false, error: "Provide tranRef or cartId" }, { status: 400 });
  }

  return (async () => {
    const env = getPaytabsEnv();

    const res = await fetch(`${env.apiBase}/payment/query`, {
      method: "POST",
      headers: { authorization: env.serverKey, "content-type": "application/json" },
      body: JSON.stringify(
        readInput(input).tranRef
          ? { profile_id: env.profileId, tran_ref: readInput(input).tranRef }
          : { profile_id: env.profileId, cart_id: readInput(input).cartId }
      ),
      cache: "no-store",
    });

    const data = (await res.json().catch(() => ({}))) as PaytabsQueryResponse;

    if (!res.ok) {
      return NextResponse.json({ ok: false, error: "PayTabs query failed", paytabs: data }, { status: 502 });
    }

    const item = pickMostRelevant(data);

    const resolvedCartId = String(item?.cart_id || item?.cartId || readInput(input).cartId || "").trim();
    const resolvedTranRef = String(item?.tran_ref || item?.tranRef || readInput(input).tranRef || "").trim();

    const responseStatus = String(item?.payment_result?.response_status || item?.response_status || "").trim();
    const responseMessage = String(item?.payment_result?.response_message || item?.response_message || "").trim();

    const nextStatus = mapPaytabsResponseStatusToOrderStatus(responseStatus);
    const allowedFrom = paymentStatusTransitionAllowedFrom(nextStatus);

    if (!resolvedCartId) {
      return NextResponse.json({
        ok: true,
        cartId: resolvedCartId,
        tranRef: resolvedTranRef,
        transitioned: false,
        correctedPaid: false,
        responseStatus,
        responseMessage,
        nextStatus,
        paytabs: data,
      });
    }

    const r = await db.query<{ status: string; inventory_committed_at: string | null }>(
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
        JSON.stringify(data),
        responseStatus,
        allowedFrom,
        responseMessage,
      ]
    );

    return NextResponse.json({
      ok: true,
      cartId: resolvedCartId,
      tranRef: resolvedTranRef,
      transitioned: r.rows.length > 0 && String(r.rows[0]?.status || "").toUpperCase() === nextStatus,
      correctedPaid:
        r.rows.length > 0 &&
        String(r.rows[0]?.status || "").toUpperCase() === nextStatus &&
        (nextStatus === "FAILED" || nextStatus === "CANCELED"),
      responseStatus,
      responseMessage,
      nextStatus,
      paytabs: data,
    });
  })();
}

export async function POST(req: Request) {
  return handleQuery(((await req.json().catch(() => ({}))) as Record<string, unknown>) || {});
}

export async function GET(req: Request) {
  return handleQuery({
    cartId: new URL(req.url).searchParams.get("cartId") || new URL(req.url).searchParams.get("cart_id") || "",
    tranRef: new URL(req.url).searchParams.get("tranRef") || new URL(req.url).searchParams.get("tran_ref") || "",
  });
}