import crypto from "crypto";

export function paytabsEnv() {
  const profileId = process.env.PAYTABS_PROFILE_ID || "";
  const serverKey = process.env.PAYTABS_SERVER_KEY || "";
  const baseUrl = process.env.PAYTABS_BASE_URL || "";
  if (!profileId || !serverKey || !baseUrl) throw new Error("Missing PayTabs env vars");
  return { profileId, serverKey, baseUrl };
}

export function hmacSha256Hex(key: string, rawBody: string) {
  return crypto.createHmac("sha256", key).update(rawBody).digest("hex");
}

export function timingSafeEqualHex(a: string, b: string) {
  const ba = Buffer.from(a || "", "utf8");
  const bb = Buffer.from(b || "", "utf8");
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}
