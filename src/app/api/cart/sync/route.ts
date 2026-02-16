import { NextResponse } from "next/server";
import { ensureCartTables, normalizeCartItems, mergeCartSum, replaceCart } from "@/lib/cartStore.server";
import { getCustomerIdFromRequest } from "@/lib/customerAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const customerId = await getCustomerIdFromRequest(req);

  const body = await req.json().catch(() => ({} as any));
  const incoming = normalizeCartItems(body?.items);
  const mode = String(body?.mode || "merge").toLowerCase(); // merge | replace

  // Guest: do not store in DB, but return normalized cart (still 200)
  if (!customerId) {
    return NextResponse.json(
      { ok: true, isAuthenticated: false, stored: false, customerId: null, items: incoming },
      { status: 200 }
    );
  }

  await ensureCartTables();

  let nextItems = incoming;
  if (mode !== "replace") {
    nextItems = await mergeCartSum(customerId, incoming);
  }

  await replaceCart(customerId, nextItems);

  return NextResponse.json(
    { ok: true, isAuthenticated: true, stored: true, customerId, items: nextItems },
    { status: 200 }
  );
}
