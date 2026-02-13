import { NextResponse } from "next/server";
import { hmacSha256Hex, timingSafeEqualHex } from "@/lib/paytabs";

export async function POST(req: Request) {
  const serverKey = process.env.PAYTABS_SERVER_KEY || "";
  if (!serverKey) return NextResponse.json({ ok: false, error: "Missing PAYTABS_SERVER_KEY" }, { status: 500 });

  const signature = req.headers.get("signature") || req.headers.get("Signature") || "";
  const raw = await req.text();

  const expected = hmacSha256Hex(serverKey, raw);
  if (!timingSafeEqualHex(signature, expected)) {
    return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(raw);
  return NextResponse.json({ ok: true, received: true, payload });
}
