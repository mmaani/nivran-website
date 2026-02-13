import { NextResponse } from "next/server";
import { reserveStock } from "@/lib/stock";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });

  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) return NextResponse.json({ ok: false, error: "No items" }, { status: 400 });

  await reserveStock(items.map((i: any) => ({
    skuOrProductId: String(i.skuOrProductId || i.productId || ""),
    qty: Number(i.qty || 0)
  })));

  return NextResponse.json({ ok: true, orderId: `ord_${Date.now()}` });
}
