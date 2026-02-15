import { getCustomerIdFromRequest } from "@/lib/customerAuth";
import { mergeCartSum, normalizeCartItems, replaceCart } from "@/lib/cartStore";
import { getCart } from "@/lib/cartStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const customerId = await getCustomerIdFromRequest(req);
  if (!customerId) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const incoming = normalizeCartItems(body?.items);

  // Merge rule: SUM quantities (clamped) by slug
  const merged = await mergeCartSum(customerId, incoming);
  await replaceCart(customerId, merged);

  const items = await getCart(customerId);
  return Response.json({ ok: true, customerId, items });
}
