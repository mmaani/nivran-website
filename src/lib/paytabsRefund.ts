// src/lib/paytabsRefund.ts
import "server-only";
import { getPaytabsEnv } from "@/lib/paytabs";

type PaytabsRefundApiResponse = {
  tran_ref?: string;
  tran_type?: string;
  payment_result?: {
    response_status?: string; // PayTabs uses codes; treat non-error as success per account behavior
    response_message?: string;
  };
  response_status?: string;
  response_message?: string;
};

export type PaytabsRefundResult = {
  ok: boolean;
  status: string;
  message: string;
  payload: PaytabsRefundApiResponse;
};

export async function requestPaytabsRefund(input: {
  tranRef: string;
  amountJod: number;
  reason: string;
}): Promise<PaytabsRefundResult> {
  const { apiBase, profileId, serverKey } = getPaytabsEnv();

  const tranRef = String(input.tranRef || "").trim();
  const amount = Number(input.amountJod);

  if (!tranRef) {
    return { ok: false, status: "E", message: "Missing tranRef", payload: {} };
  }
  if (!(amount > 0)) {
    return { ok: false, status: "E", message: "Invalid amount", payload: {} };
  }

  // PayTabs docs: refund is done via payment request with tran_type=refund. :contentReference[oaicite:2]{index=2}
  const body = {
    profile_id: profileId,
    tran_type: "refund",
    tran_ref: tranRef,
    cart_currency: "JOD",
    cart_amount: amount.toFixed(3),
    cart_description: input.reason ? String(input.reason).slice(0, 240) : "Refund",
  };

  const res = await fetch(`${apiBase}/payment/request`, {
    method: "POST",
    headers: {
      authorization: serverKey,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const payload = (await res.json().catch(() => ({}))) as PaytabsRefundApiResponse;

  const pr = payload.payment_result || {};
  const status = String(pr.response_status || payload.response_status || "").trim();
  const message = String(pr.response_message || payload.response_message || "").trim();

  // Success heuristics (PayTabs accounts vary). Keep it conservative:
  // - HTTP must be ok
  // - status must not be "E" or empty
  const ok = res.ok && !!status && status !== "E";

  return { ok, status, message, payload };
}