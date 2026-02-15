import { getCustomerIdFromRequest } from "@/lib/identity";
import { upsertCart, CartItem } from "@/lib/cartStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const customerId = await getCustomerIdFromRequest(req);
  if (!customerId) return Response.json({ ok: false, authed: false }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const items = Array.isArray(body?.items) ? (body.items as CartItem[]) : [];
  const merged = await upsertCart(customerId, items);

  return Response.json({ ok: true, authed: true, items: merged });
}
