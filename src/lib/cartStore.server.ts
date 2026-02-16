import "server-only";
import { db } from "@/lib/db";
import { CartItem, normalizeCartItems, cartQty, cartSubtotalJod } from "@/lib/cartStore";

export type CartSnapshot = {
  cartId: string;
  items: CartItem[];
  qty: number;
  subtotalJod: number;
};

function pickCartId(input: unknown): string {
  if (typeof input === "string") return input;
  if (input && typeof input === "object") {
    const obj = input as Record<string, unknown>;
    const v = obj.cartId ?? obj.cart_id ?? obj.id ?? obj.token;
    if (typeof v === "string") return v;
  }
  return "";
}

export async function ensureCartTables(): Promise<void> {
  await db.query(`
    create table if not exists carts (
      cart_id text primary key,
      items jsonb not null default '[]'::jsonb,
      updated_at timestamptz not null default now()
    );
  `);
}

export async function getCart(cartId: string): Promise<CartSnapshot>;
export async function getCart(arg: unknown): Promise<CartSnapshot>;
export async function getCart(arg: unknown): Promise<CartSnapshot> {
  await ensureCartTables();
  const id = pickCartId(arg);

  if (!id) return { cartId: "", items: [], qty: 0, subtotalJod: 0 };

  const r = await db.query<{ items: unknown }>(
    `select items from carts where cart_id=$1 limit 1`,
    [id]
  );

  const items = normalizeCartItems(r.rows[0]?.items ?? []);
  return { cartId: id, items, qty: cartQty(items), subtotalJod: cartSubtotalJod(items) };
}

export async function replaceCart(cartId: string, items: CartItem[]): Promise<CartSnapshot>;
export async function replaceCart(arg1: unknown, arg2?: unknown): Promise<CartSnapshot>;
export async function replaceCart(arg1: unknown, arg2?: unknown): Promise<CartSnapshot> {
  await ensureCartTables();

  let id = "";
  let itemsUnknown: unknown = [];

  if (typeof arg1 === "string") {
    id = arg1;
    itemsUnknown = arg2 ?? [];
  } else if (arg1 && typeof arg1 === "object") {
    const obj = arg1 as Record<string, unknown>;
    id = pickCartId(obj);
    itemsUnknown = obj.items ?? arg2 ?? [];
  }

  if (!id) return { cartId: "", items: [], qty: 0, subtotalJod: 0 };

  const normalized = normalizeCartItems(itemsUnknown);

  await db.query(
    `insert into carts (cart_id, items, updated_at)
     values ($1, $2::jsonb, now())
     on conflict (cart_id) do update set items=excluded.items, updated_at=now()`,
    [id, JSON.stringify(normalized)]
  );

  return { cartId: id, items: normalized, qty: cartQty(normalized), subtotalJod: cartSubtotalJod(normalized) };
}

// Re-export pure helpers for server routes that already import them from this module.
export { normalizeCartItems, mergeCartSum } from "@/lib/cartStore";
