import crypto from "crypto";

export function getPayTabsConfig() {
  const baseUrl = process.env.PAYTABS_BASE_URL || "https://secure-jordan.paytabs.com";
  const profileId = process.env.PAYTABS_PROFILE_ID || "";
  const serverKey = process.env.PAYTABS_SERVER_KEY || "";
  const appBaseUrl = process.env.APP_BASE_URL || "";

  if (!profileId) throw new Error("Missing PAYTABS_PROFILE_ID");
  if (!serverKey) throw new Error("Missing PAYTABS_SERVER_KEY");
  if (!appBaseUrl) throw new Error("Missing APP_BASE_URL");

  return { baseUrl, profileId, serverKey, appBaseUrl };
}

// PayTabs: Signature header = HMAC-SHA256 of the entire raw request body using Profile ServerKey.
// (We compute hex digest and compare safely.)
export function hmacSha256Hex(rawBody: string, key: string) {
  return crypto.createHmac("sha256", key).update(rawBody, "utf8").digest("hex");
}

export function timingSafeEqualHex(a: string, b: string) {
  const aa = Buffer.from(String(a || "").toLowerCase(), "utf8");
  const bb = Buffer.from(String(b || "").toLowerCase(), "utf8");
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

export function parseMaybeJsonOrForm(raw: string): any {
  const t = (raw || "").trim();
  if (!t) return {};
  if (t.startsWith("{") && t.endsWith("}")) {
    try { return JSON.parse(t); } catch { return {}; }
  }
  try {
    const params = new URLSearchParams(t);
    const obj: any = {};
    for (const [k, v] of params.entries()) obj[k] = v;
    return obj;
  } catch {
    return {};
  }
}

export function extractCartId(p: any): string {
  return String(p?.cart_id || p?.cartId || p?.cartID || p?.cartid || "").trim();
}

export function extractTranRef(p: any): string {
  return String(p?.tran_ref || p?.tranRef || p?.tranref || "").trim();
}

// Callback success commonly: payment_result.response_status === "A"
export function isApprovedPayTabsPayload(p: any): boolean {
  const s = String(p?.payment_result?.response_status || p?.respStatus || p?.resp_status || "").toUpperCase();
  if (s === "A") return true;

  const msg = String(p?.payment_result?.response_message || p?.respMessage || p?.resp_message || "").toLowerCase();
  if (msg.includes("authoris") || msg.includes("authorized") || msg.includes("approved")) return true;

  return false;
}

export async function paytabsInitiateHpp(args: {
  cartId: string;
  amount: number;
  currency: string;
  locale: "en" | "ar";
  description: string;
  customer: { name: string; email?: string; phone?: string };
  shipping?: { city?: string; address?: string; country?: string; zip?: string };
}) {
  const cfg = getPayTabsConfig();

  const returnUrl = `${cfg.appBaseUrl}/${args.locale}/checkout/result?cart_id=${encodeURIComponent(args.cartId)}`;
  const callbackUrl = `${cfg.appBaseUrl}/api/paytabs/callback`;

  const payload: any = {
    profile_id: Number(cfg.profileId),
    tran_type: "sale",
    tran_class: "ecom",
    cart_id: args.cartId,
    cart_currency: args.currency,
    cart_amount: Number(args.amount),
    cart_description: args.description,
    return: returnUrl,
    callback: callbackUrl,

    customer_details: {
      name: args.customer.name,
      email: args.customer.email || "no-reply@nivran.com",
      phone: args.customer.phone || "",
      street1: args.shipping?.address || "N/A",
      city: args.shipping?.city || "Amman",
      state: "",
      country: args.shipping?.country || "JO",
      zip: args.shipping?.zip || "",
    },
    shipping_details: {
      name: args.customer.name,
      email: args.customer.email || "no-reply@nivran.com",
      phone: args.customer.phone || "",
      street1: args.shipping?.address || "N/A",
      city: args.shipping?.city || "Amman",
      state: "",
      country: args.shipping?.country || "JO",
      zip: args.shipping?.zip || "",
    },
  };

  const url = `${cfg.baseUrl.replace(/\/$/, "")}/payment/request`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": cfg.serverKey,
    },
    body: JSON.stringify(payload),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: any = new Error(json?.message || json?.error || "PayTabs initiate failed");
    err.status = res.status;
    err.paytabs = json;
    throw err;
  }

  return json; // includes redirect_url, tran_ref, etc.
}
