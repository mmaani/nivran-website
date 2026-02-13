import crypto from "crypto";

type PayTabsRequest = Record<string, any>;

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export function paytabsConfig() {
  return {
    profileId: mustEnv("PAYTABS_PROFILE_ID"),
    serverKey: mustEnv("PAYTABS_SERVER_KEY"),
    baseUrl: (process.env.PAYTABS_BASE_URL || "https://secure-jordan.paytabs.com").replace(/\/$/, ""),
    callbackUrl: mustEnv("PAYTABS_CALLBACK_URL"),
    returnUrl: mustEnv("PAYTABS_RETURN_URL"),
  };
}

// HPP initiate request: POST {domain}/payment/request
export async function paytabsInitiate(body: PayTabsRequest) {
  const { baseUrl, serverKey } = paytabsConfig();
  const url = `${baseUrl}/payment/request`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // PayTabs requires server key in the authorization header for /payment/request
      // Example shown by PayTabs docs: --header 'authorization: <server_key>'
      authorization: serverKey,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!res.ok) {
    const msg =
      data?.message ||
      data?.response_message ||
      data?.responseMessage ||
      `PayTabs error (${res.status})`;
    const err: any = new Error(msg);
    err.paytabs = data;
    err.status = res.status;
    throw err;
  }

  return data;
}

// Callback/IPN signature verification:
// signature = HMAC-SHA256(raw_body, serverKey) compared to Header "Signature"
export function verifyPaytabsCallbackSignature(rawBody: string, signatureHeader: string | null) {
  if (!signatureHeader) return false;
  const { serverKey } = paytabsConfig();

  const computed = crypto
    .createHmac("sha256", serverKey)
    .update(rawBody, "utf8")
    .digest("hex");

  const a = Buffer.from(computed, "utf8");
  const b = Buffer.from(signatureHeader, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
