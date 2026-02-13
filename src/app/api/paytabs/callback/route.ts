import { NextResponse } from "next/server";
import { verifyPaytabsCallbackSignature } from "@/lib/paytabs";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const rawBody = await req.text();

  const sig =
    req.headers.get("signature") ||
    req.headers.get("Signature") ||
    req.headers.get("x-signature") ||
    req.headers.get("X-Signature");

  const ok = verifyPaytabsCallbackSignature(rawBody, sig);

  if (!ok) {
    return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });
  }

  // Parse after verifying signature
  let payload: any = {};
  try {
    payload = JSON.parse(rawBody);
  } catch {
    payload = { raw: rawBody };
  }

  // MVP: acknowledge receipt. Next step will update order status in DB using payload.
  return NextResponse.json({ ok: true });
}
