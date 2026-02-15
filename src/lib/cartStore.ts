import { db } from "@/lib/db";

/**
 * Supports TWO possible schemas (because your repo includes both patterns in different places):
 *
 * A) Normalized schema:
 *    customer_carts(id, customer_id UNIQUE)
 *    customer_cart_items(cart_id, slug, name, price_jod, qty)
 *
 * B) Flat schema:
 *    customer_cart_items(customer_id, slug, name, price_jod, qty)
 *
 * We detect which schema exists at runtime and use it.
 */

export type CartItem = {
  slug: string;
  name: string;
  priceJod: number;
  qty: number;
};

export type Cart = {
  items: CartItem[];
  updatedAt: string | null;
};

let _schema: "normalized" | "flat" | null = null;

async function detectSchema(): Promise<"normalized" | "flat"> {
  if (_schema) return _schema;

  // If table doesn't exist yet, we'll create normalized schema by default.
  const t = await db.query<{ exists: boolean }>(
    `select exists (
       select 1 from information_schema.tables
       where table_schema='public' and table_name='customer_cart_items'
     ) as exists`
  );

  if (!t.rows?.[0]?.exists) {
    _schema = "normalized";
    return _schema;
  }

  const cols = await db.query<{ column_name: string }>(
    `select column_name
       from information_schema.columns
      where table_schema='public' and table_name='customer_cart_items'`
  );

  const set = new Set((cols.rows || []).map((r) => String(r.column_name)));
  _schema = set.has("cart_id") ? "normalized" : "flat";
  return _schema;
}

export async function ensureCartTables() {
  const schema = await detectSchema();

  if (schema === "flat") {
    // Ensure at least the flat table exists with required columns.
    await db.query(`
      create table if not exists customer_cart_items (
        customer_id bigint not null,
        slug text not null,
        name text not null,
        price_jod numeric(10,2) not null default 0,
        qty int not null default 1,
        updated_at timestamptz not null default now(),
        primary key (customer_id, slug)
      );
    `);
    await db.query(`create index if not exists idx_customer_cart_items_customer on customer_cart_items(customer_id);`);
    return;
  }

  // Normalized schema (preferred)
  await db.query(`
    create table if not exists customer_carts (
      id bigserial primary key,
      customer_id bigint not null unique,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);

  await db.query(`
    create table if not exists customer_cart_items (
      cart_id bigint not null references customer_carts(id) on delete cascade,
      slug text not null,
      name text not null,
      price_jod numeric(10,2) not null default 0,
      qty int not null default 1,
      updated_at timestamptz not null default now(),
      primary key (cart_id, slug)
    );
  `);

  await db.query(`create index if not exists idx_customer_cart_items_cart on customer_cart_items(cart_id);`);
}

function normalizeItems(items: any): CartItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((x: any) => ({
      slug: String(x?.slug || "").trim(),
      name: String(x?.name || "").trim(),
      priceJod: Number(x?.priceJod ?? x?.price_jod ?? 0),
      qty: Math.max(1, Math.min(99, Number(x?.qty || 1))),
    }))
    .filter((x: CartItem) => !!x.slug);
}

async function getOrCreateCartId(customerId: number): Promise<number> {
  const r = await db.query<{ id: number }>(
    `
    insert into customer_carts (customer_id)
    values ($1)
    on conflict (customer_id)
    do update set updated_at = now()
    returning id
  `,
    [customerId]
  );
  return Number(r.rows[0].id);
}

export async function getCart(customerId: number): Promise<Cart> {
  await ensureCartTables();
  const schema = await detectSchema();

  if (schema === "flat") {
    const r = await db.query<{ slug: string; name: string; price_jod: any; qty: number; updated_at: string }>(
      `select slug, name, price_jod, qty, updated_at
         from customer_cart_items
        where customer_id=$1
        order by updated_at desc`,
      [customerId]
    );
    const items = (r.rows || []).map((x) => ({
      slug: x.slug,
      name: x.name,
      priceJod: Number(x.price_jod || 0),
      qty: Number(x.qty || 1),
    }));
    const updatedAt = r.rows?.[0]?.updated_at || null;
    return { items, updatedAt };
  }

  const cartId = await getOrCreateCartId(customerId);

  const r = await db.query<{ slug: string; name: string; price_jod: any; qty: number; updated_at: string }>(
    `select slug, name, price_jod, qty, updated_at
       from customer_cart_items
      where cart_id=$1
      order by updated_at desc`,
    [cartId]
  );

  const items = (r.rows || []).map((x) => ({
    slug: x.slug,
    name: x.name,
    priceJod: Number(x.price_jod || 0),
    qty: Number(x.qty || 1),
  }));
  const updatedAt = r.rows?.[0]?.updated_at || null;
  return { items, updatedAt };
}

export async function mergeCart(customerId: number, incoming: any): Promise<Cart> {
  await ensureCartTables();
  const schema = await detectSchema();
  const items = normalizeItems(incoming);
  if (!items.length) return getCart(customerId);

  if (schema === "flat") {
    // Merge by adding qty (cap 99)
    for (const it of items) {
      await db.query(
        `
        insert into customer_cart_items (customer_id, slug, name, price_jod, qty)
        values ($1,$2,$3,$4,$5)
        on conflict (customer_id, slug)
        do update set
          qty = least(99, customer_cart_items.qty + excluded.qty),
          name = excluded.name,
          price_jod = excluded.price_jod,
          updated_at = now()
      `,
        [customerId, it.slug, it.name, it.priceJod, it.qty]
      );
    }
    return getCart(customerId);
  }

  const cartId = await getOrCreateCartId(customerId);
  for (const it of items) {
    await db.query(
      `
      insert into customer_cart_items (cart_id, slug, name, price_jod, qty)
      values ($1,$2,$3,$4,$5)
      on conflict (cart_id, slug)
      do update set
        qty = least(99, customer_cart_items.qty + excluded.qty),
        name = excluded.name,
        price_jod = excluded.price_jod,
        updated_at = now()
    `,
      [cartId, it.slug, it.name, it.priceJod, it.qty]
    );
  }
  return getCart(customerId);
}

export async function overwriteCart(customerId: number, incoming: any): Promise<Cart> {
  await ensureCartTables();
  const schema = await detectSchema();
  const items = normalizeItems(incoming);

  if (schema === "flat") {
    await db.query(`delete from customer_cart_items where customer_id=$1`, [customerId]);
    for (const it of items) {
      await db.query(
        `insert into customer_cart_items (customer_id, slug, name, price_jod, qty) values ($1,$2,$3,$4,$5)`,
        [customerId, it.slug, it.name, it.priceJod, it.qty]
      );
    }
    return getCart(customerId);
  }

  const cartId = await getOrCreateCartId(customerId);
  await db.query(`delete from customer_cart_items where cart_id=$1`, [cartId]);
  for (const it of items) {
    await db.query(
      `insert into customer_cart_items (cart_id, slug, name, price_jod, qty) values ($1,$2,$3,$4,$5)`,
      [cartId, it.slug, it.name, it.priceJod, it.qty]
    );
  }
  return getCart(customerId);
}

export async function clearCart(customerId: number) {
  await ensureCartTables();
  const schema = await detectSchema();

  if (schema === "flat") {
    await db.query(`delete from customer_cart_items where customer_id=$1`, [customerId]);
    return;
  }

  const cartId = await getOrCreateCartId(customerId);
  await db.query(`delete from customer_cart_items where cart_id=$1`, [cartId]);
}
