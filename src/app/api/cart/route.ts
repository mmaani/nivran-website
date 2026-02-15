import { NextRequest, NextResponse } from "next/server";
import { getCustomerIdFromRequest } from "@/lib/identity";
import { ensureCartTables, getCart } from "@/lib/cartStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const customerId = await getCustomerIdFromRequest(req);

    // ✅ Guest-safe: never 401 here (prevents Vercel log spam)
    if (!customerId) {
      return NextResponse.json({ ok: true, customerId: null, items: [] }, { status: 200 });
    }

    await ensureCartTables();
    const cart = await getCart(Number(customerId));

    return NextResponse.json(
      { ok: true, customerId: Number(customerId), items: cart.items, updatedAt: cart.updatedAt },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Cart fetch failed" }, { status: 500 });
  }
}
