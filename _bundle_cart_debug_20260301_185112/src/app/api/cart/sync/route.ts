import { NextResponse } from "next/server";
import {
  ensureCartTables,
  normalizeCartItems,
  mergeCartSum,
  replaceCart,
  getCart,
} from "@/lib/cartStore.server";
import { getCustomerIdFromRequest } from "@/lib/customerAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Mode = "merge" | "replace";

type JsonRecord = Record<string, unknown>;
function isRecord(v: unknown): v is JsonRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseMode(v: unknown): Mode {
  const s = String(v ?? "merge").toLowerCase();
  return s === "replace" ? "replace" : "merge";
}

export async function POST(req: Request) {
  const customerId = await getCustomerIdFromRequest(req);

  const raw: unknown = await req.json().catch(() => null);
  const body: JsonRecord = isRecord(raw) ? raw : {};

  const incoming = normalizeCartItems(body.items);
  const mode = parseMode(body.mode);

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
    const current = await getCart(customerId);
    nextItems = mergeCartSum(current.items, incoming); // ✅ pass CartItem[]
  }

  await replaceCart(customerId, nextItems);

  return NextResponse.json(
    { ok: true, isAuthenticated: true, stored: true, customerId, items: nextItems },
    { status: 200 }
  );
}
