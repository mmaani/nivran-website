import { getCustomerIdFromRequest } from "@/lib/identity";
import { getCart } from "@/lib/cartStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const customerId = await getCustomerIdFromRequest(req);
  if (!customerId) return Response.json({ ok: false, authed: false });

  const items = await getCart(customerId);
  return Response.json({ ok: true, authed: true, customerId, items });
}
