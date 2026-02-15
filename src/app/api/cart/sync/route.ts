import { NextRequest, NextResponse } from "next/server";
import { getCustomerIdFromRequest } from "@/lib/identity";
import { ensureCartTables, mergeCart, overwriteCart, clearCart } from "@/lib/cartStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type IncomingItem = { slug?: string; name?: string; priceJod?: number; price_jod?: number; qty?: number };

function normalize(items: any): IncomingItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((x: any) => ({
      slug: String(x?.slug || "").trim(),
      name: String(x?.name || "").trim(),
      priceJod: Number(x?.priceJod ?? x?.price_jod ?? 0),
      qty: Math.max(1, Math.min(99, Number(x?.qty || 1))),
    }))
    .filter((x: any) => !!x.slug);
}

export async function POST(req: NextRequest) {
  try {
    const customerId = await getCustomerIdFromRequest(req);

    // ✅ Guest-safe: never 401 here either
    if (!customerId) {
      return NextResponse.json({ ok: true, customerId: null, items: [] }, { status: 200 });
    }

    const body = await req.json().catch(() => ({} as any));
    const mode = String(body?.mode || "merge").toLowerCase();
    const items = normalize(body?.items);

    await ensureCartTables();

    if (mode === "clear") {
      await clearCart(Number(customerId));
      return NextResponse.json({ ok: true, customerId: Number(customerId), items: [] }, { status: 200 });
    }

    const cart =
      mode === "replace" ? await overwriteCart(Number(customerId), items) : await mergeCart(Number(customerId), items);

    return NextResponse.json({ ok: true, customerId: Number(customerId), items: cart.items }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Cart sync failed" }, { status: 500 });
  }
}
