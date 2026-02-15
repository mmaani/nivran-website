import { getCustomerIdFromRequest } from "@/lib/customerAuth";
import { getCart, normalizeCartItems, replaceCart } from "@/lib/cartStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const customerId = await getCustomerIdFromRequest(req);
  if (!customerId) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const items = await getCart(customerId);
  return Response.json({ ok: true, customerId, items });
}

export async function PUT(req: Request) {
  const customerId = await getCustomerIdFromRequest(req);
  if (!customerId) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const items = normalizeCartItems(body?.items);

  await replaceCart(customerId, items);
  return Response.json({ ok: true, customerId, items });
}
