import { NextResponse } from "next/server";
import { ensureCartTables, getCart } from "@/lib/cartStore.server";
import { getCustomerIdFromRequest } from "@/lib/customerAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const customerId = await getCustomerIdFromRequest(req);

  // Guest: return 200 (no 401 spam), but mark as not authenticated
  if (!customerId) {
    return NextResponse.json({ ok: true, isAuthenticated: false, customerId: null, items: [] }, { status: 200 });
  }

  await ensureCartTables();
  const items = await getCart(customerId);

  return NextResponse.json({ ok: true, isAuthenticated: true, customerId, items }, { status: 200 });
}
