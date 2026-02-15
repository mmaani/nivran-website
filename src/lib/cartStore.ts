import { db } from "@/lib/db";

export const CART_LOCAL_KEY = "nivran_cart_v1";

export type CartItem = {
  slug: string;
  name: string;
  priceJod: number;
  qty: number;
};

export async function ensureCartTables() {
  await db.query(`
    create table if not exists customer_carts (
      customer_id bigint primary key references customers(id) on delete cascade,
      updated_at timestamptz not null default now()
    );
  `);
  await db.query(`
    create table if not exists customer_cart_items (
      customer_id bigint not null references customers(id) on delete cascade,
      slug text not null,
      name text not null,
      price_jod numeric(10,2) not null default 0,
      qty int not null default 1,
      updated_at timestamptz not null default now(),
      primary key (customer_id, slug)
    );
  `);
}

export async function getCart(customerId: number): Promise<CartItem[]> {
  await ensureCartTables();
  const r = await db.query<{ slug: string; name: string; price_jod: string; qty: number }>(
    `select slug, name, price_jod::text as price_jod, qty
       from customer_cart_items
      where customer_id=$1
      order by updated_at desc`,
    [customerId]
  );
  return r.rows.map((x) => ({
    slug: x.slug,
    name: x.name,
    priceJod: Number(x.price_jod || 0),
    qty: Number(x.qty || 0),
  }));
}

export async function upsertCart(customerId: number, items: CartItem[]): Promise<CartItem[]> {
  await ensureCartTables();

  // Clear
  await db.query(`delete from customer_cart_items where customer_id=$1`, [customerId]);

  // Upsert new items
  const safe = (Array.isArray(items) ? items : [])
    .map((i) => ({
      slug: String(i.slug || "").trim(),
      name: String(i.name || "").trim(),
      priceJod: Number(i.priceJod || 0),
      qty: Math.max(1, Number(i.qty || 1)),
    }))
    .filter((i) => i.slug && i.name);

  for (const it of safe) {
    await db.query(
      `insert into customer_cart_items (customer_id, slug, name, price_jod, qty, updated_at)
       values ($1,$2,$3,$4,$5, now())`,
      [customerId, it.slug, it.name, it.priceJod, it.qty]
    );
  }

  // Touch cart
  await db.query(
    `insert into customer_carts (customer_id, updated_at)
     values ($1, now())
     on conflict (customer_id) do update set updated_at=excluded.updated_at`,
    [customerId]
  );

  return safe;
}
