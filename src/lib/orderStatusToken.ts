import crypto from "crypto";

type OrderStatusTokenPayload = {
  cartId: string;
  exp: number;
};

function getOrderStatusSecret(): string {
  return (
    process.env.ORDER_STATUS_SECRET ||
    process.env.ADMIN_SECRET ||
    process.env.ADMIN_SESSION_SECRET ||
    process.env.ADMIN_TOKEN ||
    ""
  ).trim();
}

function signPayload(encodedPayload: string): string {
  const secret = getOrderStatusSecret();
  if (!secret) throw new Error("Missing ORDER_STATUS_SECRET (or ADMIN secret)");
  return crypto.createHmac("sha256", secret).update(encodedPayload).digest("hex");
}

function safeEq(a: string, b: string): boolean {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

export function createOrderStatusToken(cartId: string, ttlSec = 60 * 60 * 24 * 2): string {
  const normalizedCartId = String(cartId || "").trim();
  if (!normalizedCartId) throw new Error("cartId is required");

  const nowSec = Math.floor(Date.now() / 1000);
  const payload: OrderStatusTokenPayload = {
    cartId: normalizedCartId,
    exp: nowSec + Math.max(60, Math.trunc(ttlSec)),
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyOrderStatusToken(cartId: string, token: string): boolean {
  try {
    const normalizedCartId = String(cartId || "").trim();
    const trimmedToken = String(token || "").trim();
    if (!normalizedCartId || !trimmedToken) return false;

    const [encodedPayload, signature] = trimmedToken.split(".");
    if (!encodedPayload || !signature) return false;

    const expected = signPayload(encodedPayload);
    if (!safeEq(signature, expected)) return false;

    const parsed: unknown = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    if (typeof parsed !== "object" || parsed === null) return false;
    const maybe = parsed as Record<string, unknown>;
    if (String(maybe["cartId"] || "") !== normalizedCartId) return false;

    const exp = Number(maybe["exp"]);
    if (!Number.isFinite(exp)) return false;
    const nowSec = Math.floor(Date.now() / 1000);
    return exp > nowSec;
  } catch {
    return false;
  }
}
