import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getPaytabsEnv,
  mapPaytabsResponseStatusToOrderStatus,
  paymentStatusTransitionAllowedFrom,
} from "@/lib/paytabs";

export const runtime = "nodejs";

function readInput(input: Record<string, unknown>) {
  const cartId = String(input?.cartId || input?.cart_id || "").trim();
  const tranRef = String(input?.tranRef || input?.tran_ref || "").trim();
  return { cartId, tranRef };
}

async function handleQuery(input: Record<string, unknown>) {
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

  const data = await res.json().catch(() => ({} as Record<string, unknown>));
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: "PayTabs query failed", paytabs: data }, { status: 502 });
  }

  const responseStatus = String((data as any)?.payment_result?.response_status || "");
  const nextStatus = mapPaytabsResponseStatusToOrderStatus(responseStatus);
  const allowedFrom = paymentStatusTransitionAllowedFrom(nextStatus);
  const resolvedCartId = String((data as any)?.cart_id || cartId || "");
  const resolvedTranRef = String((data as any)?.tran_ref || tranRef || "");

  let transitioned = false;

  if (resolvedCartId) {
    const result = await db.query(
      `update orders
          set status=case when status = any($5::text[]) then $2 else status end,
              paytabs_tran_ref=coalesce(nullif($3,''), paytabs_tran_ref),
              paytabs_last_payload=$4,
              updated_at=now()
        where cart_id=$1
        returning status`,
      [resolvedCartId, nextStatus, resolvedTranRef, JSON.stringify(data), allowedFrom]
    );

    transitioned = result.rows.length > 0 && result.rows[0].status === nextStatus;
  }

  return NextResponse.json({
    ok: true,
    cartId: resolvedCartId,
    tranRef: resolvedTranRef,
    transitioned,
    paytabs: data,
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
