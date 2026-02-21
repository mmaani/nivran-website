import "server-only";
import { db, type DbExecutor } from "@/lib/db";

export async function ensureOrdersTables(): Promise<void> {
  // 1) Create tables (only if missing)
  await db.query(`
    create table if not exists orders (
      id bigserial primary key,
      cart_id text not null unique,
      status text not null,
      amount numeric(10,2) not null default 0,
      currency text not null default 'JOD'
    );
  `);

  await db.query(`
    create table if not exists paytabs_callbacks (
      id bigserial primary key,
      cart_id text,
      tran_ref text,
      signature_header text,
      signature_computed text,
      signature_valid boolean not null default false,
      raw_body text
    );
  `);

  // 2) Backfill/migrate columns for older DBs
  await db.query(`alter table orders add column if not exists locale text not null default 'en'`);
  await db.query(`alter table orders add column if not exists customer jsonb`);
  await db.query(`alter table orders add column if not exists shipping jsonb`);
  await db.query(`alter table orders add column if not exists items jsonb`);

  await db.query(`alter table orders add column if not exists customer_name text`);
  await db.query(`alter table orders add column if not exists customer_phone text`);
  await db.query(`alter table orders add column if not exists customer_email text`);
  await db.query(`alter table orders add column if not exists shipping_city text`);
  await db.query(`alter table orders add column if not exists shipping_address text`);
  await db.query(`alter table orders add column if not exists shipping_country text`);
  await db.query(`alter table orders add column if not exists notes text`);

  await db.query(`alter table orders add column if not exists subtotal_before_discount_jod numeric(10,2)`);
  await db.query(`alter table orders add column if not exists discount_jod numeric(10,2)`);
  await db.query(`alter table orders add column if not exists subtotal_after_discount_jod numeric(10,2)`);
  await db.query(`alter table orders add column if not exists shipping_jod numeric(10,2)`);
  await db.query(`alter table orders add column if not exists total_jod numeric(10,2)`);

  await db.query(`alter table orders add column if not exists promo_code text`);
  await db.query(`alter table orders add column if not exists promotion_id bigint`);
  await db.query(`alter table orders add column if not exists discount_source text`);

  await db.query(`alter table orders add column if not exists promo_consumed boolean not null default false`);
  await db.query(`alter table orders add column if not exists promo_consumed_at timestamptz`);
  await db.query(`alter table orders add column if not exists promo_consume_failed boolean not null default false`);
  await db.query(`alter table orders add column if not exists promo_consume_error text`);

  await db.query(`alter table orders add column if not exists payment_method text not null default 'PAYTABS'`);
  await db.query(`alter table orders add column if not exists customer_id bigint`);

  await db.query(`alter table orders add column if not exists paytabs_tran_ref text`);
  await db.query(`alter table orders add column if not exists paytabs_last_payload text`);
  await db.query(`alter table orders add column if not exists paytabs_last_signature text`);
  await db.query(`alter table orders add column if not exists paytabs_response_status text`);
  await db.query(`alter table orders add column if not exists paytabs_response_message text`);

  // inventory commit (decrement stock) idempotency
  await db.query(`alter table orders add column if not exists inventory_committed_at timestamptz`);

  // timestamps
  await db.query(`alter table orders add column if not exists created_at timestamptz not null default now()`);
  await db.query(`alter table orders add column if not exists updated_at timestamptz not null default now()`);

  await db.query(`alter table paytabs_callbacks add column if not exists payload jsonb`);
  await db.query(`alter table paytabs_callbacks add column if not exists created_at timestamptz not null default now()`);
  await db.query(`alter table paytabs_callbacks add column if not exists received_at timestamptz not null default now()`);

  // Constraints (only create if missing)
  await db.query(`
    do $$
    begin
      if not exists (
        select 1 from pg_constraint where conname='orders_discount_source_chk'
      ) then
        alter table orders
          add constraint orders_discount_source_chk
          check (discount_source in ('AUTO','CODE') or discount_source is null);
      end if;
    end $$;
  `);

  await db.query(`
    do $$
    begin
      if not exists (
        select 1 from pg_constraint where conname='orders_single_discount_chk'
      ) then
        alter table orders
          add constraint orders_single_discount_chk
          check (
            (discount_source is null and promo_code is null)
            or (discount_source='AUTO' and promo_code is null)
            or (discount_source='CODE' and promo_code is not null)
          );
      end if;
    end $$;
  `);

  // Keep amount/currency in sync for legacy readers.
  await db.query(`
    update orders
       set amount = coalesce(total_jod, amount)
     where total_jod is not null
       and (amount is null or amount <> total_jod)
  `);

  await db.query(`
    update orders
       set currency = coalesce(nullif(currency,''), 'JOD')
     where currency is null or currency = ''
  `);

  // 3) Indexes last (so columns definitely exist)
  await db.query(`create index if not exists idx_orders_cart_id on orders(cart_id)`);
  await db.query(`create index if not exists idx_orders_status on orders(status)`);
  await db.query(`create index if not exists idx_orders_created_at on orders(created_at desc)`);
  await db.query(`create index if not exists idx_orders_paytabs_tran_ref on orders(paytabs_tran_ref)`);
  await db.query(`create index if not exists idx_orders_promo_code on orders(promo_code)`);
  await db.query(`create index if not exists idx_orders_discount_source on orders(discount_source)`);
  await db.query(`create index if not exists idx_orders_inventory_committed_at on orders(inventory_committed_at)`);

  await db.query(`create index if not exists idx_orders_promo_consumed on orders(promo_consumed)`);
  await db.query(`create index if not exists idx_orders_promo_consume_failed on orders(promo_consume_failed)`);

  await db.query(`create index if not exists idx_paytabs_callbacks_cart_id on paytabs_callbacks(cart_id)`);
  await db.query(`create index if not exists idx_paytabs_callbacks_tran_ref on paytabs_callbacks(tran_ref)`);
  await db.query(`create index if not exists idx_paytabs_callbacks_created_at on paytabs_callbacks(created_at desc)`);
  await db.query(`create index if not exists idx_paytabs_callbacks_received_at on paytabs_callbacks(received_at desc)`);
}

type InventoryDelta = { slug: string; qty: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  return s ? s : null;
}

function toQty(value: unknown): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(999, Math.trunc(n)));
}

function parseJsonIfString(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const s = value.trim();
  if (!s) return null;
  try {
    return JSON.parse(s) as unknown;
  } catch {
    return null;
  }
}

function extractInventoryDeltas(itemsValue: unknown): InventoryDelta[] {
  const parsed = parseJsonIfString(itemsValue);

  const list: unknown =
    Array.isArray(parsed)
      ? parsed
      : isRecord(parsed) && Array.isArray(parsed["items"])
        ? parsed["items"]
        : isRecord(parsed) && Array.isArray(parsed["lines"])
          ? parsed["lines"]
          : null;

  if (!Array.isArray(list)) return [];

  const map = new Map<string, number>();

  for (const entry of list) {
    if (!isRecord(entry)) continue;
    const slug = toNonEmptyString(entry["slug"]);
    if (!slug) continue;
    const qty = toQty(entry["qty"]);
    map.set(slug, (map.get(slug) || 0) + qty);
  }

  return Array.from(map.entries()).map(([slug, qty]) => ({ slug, qty }));
}

type OrderInventoryRow = {
  cart_id: string;
  status: string;
  inventory_committed_at: string | null;
  items: unknown;
};

/**
 * Commit inventory (decrement products.inventory_qty) once the order is PAID / PAID_COD.
 * Idempotent via orders.inventory_committed_at.
 */
export async function commitInventoryForPaidCart(trx: DbExecutor, cartId: string): Promise<boolean> {
  const { rows } = await trx.query<OrderInventoryRow>(
    `select cart_id, status, inventory_committed_at, items
       from orders
      where cart_id = $1
      for update`,
    [cartId]
  );

  const order = rows[0];
  if (!order) return false;

  const status = String(order.status || "").toUpperCase();
  const isPaid = status === "PAID" || status === "PAID_COD";
  if (!isPaid) return false;

  if (order.inventory_committed_at) return false;

  const deltas = extractInventoryDeltas(order.items);

  for (const d of deltas) {
    await trx.query(
      `update products
          set inventory_qty = greatest(0, coalesce(inventory_qty, 0) - $2::int),
              updated_at = now()
        where slug = $1::text`,
      [d.slug, d.qty]
    );
  }

  await trx.query(
    `update orders
        set inventory_committed_at = now(),
            updated_at = now()
      where cart_id = $1
        and inventory_committed_at is null`,
    [cartId]
  );

  return true;
}

export async function commitInventoryForPaidOrderId(trx: DbExecutor, orderId: number): Promise<boolean> {
  const { rows } = await trx.query<OrderInventoryRow>(
    `select cart_id, status, inventory_committed_at, items
       from orders
      where id = $1
      for update`,
    [orderId]
  );

  const order = rows[0];
  if (!order) return false;

  const status = String(order.status || "").toUpperCase();
  const isPaid = status === "PAID" || status === "PAID_COD";
  if (!isPaid) return false;

  if (order.inventory_committed_at) return false;

  const deltas = extractInventoryDeltas(order.items);

  for (const d of deltas) {
    await trx.query(
      `update products
          set inventory_qty = greatest(0, coalesce(inventory_qty, 0) - $2::int),
              updated_at = now()
        where slug = $1::text`,
      [d.slug, d.qty]
    );
  }

  await trx.query(
    `update orders
        set inventory_committed_at = now(),
            updated_at = now()
      where id = $1
        and inventory_committed_at is null`,
    [orderId]
  );

  return true;
}
