import { db } from "@/lib/db";

export type CartItem = {
  slug: string;
  name: string;
  priceJod: number;
  qty: number;
};

const MAX_QTY = 99;

function clampQty(n: any) {
  const x = Math.floor(Number(n || 1));
  if (!Number.isFinite(x)) return 1;
  return Math.max(1, Math.min(MAX_QTY, x));
}

export function normalizeCartItems(items: any): CartItem[] {
  if (!Array.isArray(items)) return [];
  const out: CartItem[] = [];
  for (const it of items) {
    const slug = String(it?.slug || "").trim();
    if (!slug) continue;
    const name = String(it?.name || slug).trim();
    const priceJod = Number(it?.priceJod || it?.price_jod || 0);
    out.push({ slug, name, priceJod: Number.isFinite(priceJod) ? priceJod : 0, qty: clampQty(it?.qty) });
  }
  // de-dupe by slug (keep last)
  const map = new Map<string, CartItem>();
  for (const i of out) map.set(i.slug, i);
  return Array.from(map.values());
}

export async function getCart(customerId: number): Promise<CartItem[]> {
  const r = await db.query(
    `select slug, name, price_jod::text as price_jod, qty
       from customer_cart_items
      where customer_id=$1
      order by updated_at desc, slug asc`,
    [customerId]
  );

  return r.rows.map((x: any) => ({
    slug: String(x.slug),
    name: String(x.name),
    priceJod: Number(x.price_jod || 0),
    qty: clampQty(x.qty),
  }));
}

export async function replaceCart(customerId: number, items: CartItem[]): Promise<void> {
  const slugs = items.map((i) => i.slug);
  const names = items.map((i) => i.name);
  const prices = items.map((i) => String(Number(i.priceJod || 0)));
  const qtys = items.map((i) => clampQty(i.qty));

  await db.query("begin");
  try {
    await db.query(
      `insert into customer_carts(customer_id, updated_at)
       values ($1, now())
       on conflict (customer_id) do update set updated_at=excluded.updated_at`,
      [customerId]
    );

    await db.query(`delete from customer_cart_items where customer_id=$1`, [customerId]);

    if (items.length) {
      await db.query(
        `with data as (
           select
             unnest($2::text[]) as slug,
             unnest($3::text[]) as name,
             unnest($4::numeric[]) as price_jod,
             unnest($5::int[]) as qty
         )
         insert into customer_cart_items(customer_id, slug, name, price_jod, qty, updated_at)
         select $1, slug, name, price_jod, qty, now()
         from data`,
        [customerId, slugs, names, prices, qtys]
      );
    }

    await db.query("commit");
  } catch (e) {
    await db.query("rollback");
    throw e;
  }
}

export async function mergeCartSum(customerId: number, incoming: CartItem[]): Promise<CartItem[]> {
  const existing = await getCart(customerId);
  const map = new Map<string, CartItem>();

  for (const e of existing) map.set(e.slug, { ...e });

  for (const inc of incoming) {
    const prev = map.get(inc.slug);
    if (!prev) {
      map.set(inc.slug, { ...inc, qty: clampQty(inc.qty) });
    } else {
      const nextQty = clampQty((prev.qty || 0) + (inc.qty || 0));
      map.set(inc.slug, { ...prev, name: inc.name || prev.name, priceJod: inc.priceJod ?? prev.priceJod, qty: nextQty });
    }
  }

  return Array.from(map.values());
}
