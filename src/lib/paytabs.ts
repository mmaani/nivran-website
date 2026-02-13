import crypto from "crypto";

export function getPaytabsEnv() {
  const profileId = process.env.PAYTABS_PROFILE_ID || "";
  const serverKey = process.env.PAYTABS_SERVER_KEY || "";
  const apiBase = process.env.PAYTABS_API_BASE_URL || ""; // e.g. https://secure.paytabs.com  (region-specific)
  if (!profileId) throw new Error("Missing PAYTABS_PROFILE_ID");
  if (!serverKey) throw new Error("Missing PAYTABS_SERVER_KEY");
  if (!apiBase) throw new Error("Missing PAYTABS_API_BASE_URL");
  return { profileId, serverKey, apiBase: apiBase.replace(/\/+$/, "") };
}

export function computePaytabsSignature(rawBody: string, serverKey: string): string {
  return crypto.createHmac("sha256", serverKey).update(rawBody, "utf8").digest("hex");
}

export function safeEqualHex(a: string, b: string): boolean {
  const aa = Buffer.from(String(a || "").trim().toLowerCase(), "utf8");
  const bb = Buffer.from(String(b || "").trim().toLowerCase(), "utf8");
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

export function mapPaytabsResponseStatusToOrderStatus(respStatus: string): string {
  // PayTabs commonly uses payment_result.response_status values like A/H/P/D/E... (A = approved)
  const s = String(respStatus || "").trim().toUpperCase();
  if (s === "A") return "PAID";
  if (s === "H") return "PENDING_REVIEW";
  if (s === "P") return "PENDING_PAYMENT";
  return "PAYMENT_FAILED";
}
