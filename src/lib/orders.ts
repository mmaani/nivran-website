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

type InventoryDelta = {
  // Raw value from the order payload (may contain underscores, uppercase, etc.)
  slugRaw: string | null;
  // Normalized slug (lowercase, hyphenated). Used for matching.
  slug: string | null;
  // Optional variant id from the order payload (when slug is missing/incorrect)
  variantId: number | null;
  qty: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  return s ? s : null;
}

function toPosInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.trunc(value);
  if (typeof value === "string") {
    const n = Number(value.trim());
    if (Number.isFinite(n) && n > 0) return Math.trunc(n);
  }
  return null;
}

export function normalizeSkuForInventory(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let s = value.trim().toLowerCase();
  if (!s) return null;

  // Common normalizations
  s = s.replace(/_/g, "-");
  s = s.replace(/\s+/g, "-");

  // Keep only URL-safe slug characters
  s = s.replace(/[^a-z0-9-]/g, "-");
  s = s.replace(/-+/g, "-");
  s = s.replace(/^-+/, "").replace(/-+$/, "");

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

  const map = new Map<string, InventoryDelta>();

  for (const entry of list) {
    if (!isRecord(entry)) continue;

    const slugRaw =
      toNonEmptyString(entry["slug"]) ||
      toNonEmptyString(entry["productSlug"]) ||
      toNonEmptyString(entry["product_slug"]) ||
      toNonEmptyString(entry["sku"]);

    const slug = normalizeSkuForInventory(slugRaw);
    const variantId = toPosInt(entry["variantId"] ?? entry["variant_id"]);

    const qty = toQty(entry["qty"]);

    const key = slug ? `slug:${slug}` : variantId ? `variant:${variantId}` : null;
    if (!key) continue;

    const prev = map.get(key);
    if (!prev) {
      map.set(key, { slugRaw, slug, variantId, qty });
    } else {
      map.set(key, {
        slugRaw: prev.slugRaw || slugRaw,
        slug: prev.slug || slug,
        variantId: prev.variantId || variantId,
        qty: Math.max(1, Math.min(999, prev.qty + qty)),
      });
    }
  }

  return Array.from(map.values());
}

function buildSlugCandidates(delta: InventoryDelta): string[] {
  const out: string[] = [];
  const push = (v: string | null) => {
    if (!v) return;
    const s = v.trim();
    if (!s) return;
    if (!out.includes(s)) out.push(s);
  };

  push(delta.slug);

  if (delta.slugRaw) {
    const rawLower = delta.slugRaw.trim().toLowerCase();
    push(rawLower);
    push(rawLower.replace(/_/g, "-"));
    push(rawLower.replace(/\s+/g, "-"));
    push(normalizeSkuForInventory(rawLower));
  }

  return out;
}

async function resolveProductSlugByVariantId(trx: DbExecutor, variantId: number): Promise<string | null> {
  // Best-effort resolution. If variants table is absent or schema differs, just return null.
  try {
    const r = await trx.query<{ slug: string }>(
      `select product_slug::text as slug
         from variants
        where id = $1
        limit 1`,
      [variantId]
    );
    const slug = r.rows[0]?.slug;
    return typeof slug === "string" && slug.trim() ? slug.trim() : null;
  } catch {
    return null;
  }
}

async function resolveInventoryDeltasToSlugs(
  trx: DbExecutor,
  deltas: InventoryDelta[]
): Promise<{ resolved: Array<{ slug: string; qty: number }>; missing: InventoryDelta[] }> {
  const perDeltaCandidates = deltas.map((d) => buildSlugCandidates(d));

  // Variant-based enrichment (only when no candidates)
  for (let i = 0; i < deltas.length; i++) {
    const d = deltas[i];
    if (perDeltaCandidates[i].length > 0) continue;
    if (!d.variantId) continue;
    const byVariant = await resolveProductSlugByVariantId(trx, d.variantId);
    if (byVariant) {
      perDeltaCandidates[i].push(byVariant);
      const normalized = normalizeSkuForInventory(byVariant);
      if (normalized && normalized !== byVariant) perDeltaCandidates[i].push(normalized);
    }
  }

  const allCandidates = Array.from(new Set(perDeltaCandidates.flat())).filter((s) => typeof s === "string" && s.length > 0);
  const exists = new Set<string>();

  if (allCandidates.length > 0) {
    const r = await trx.query<{ slug: string }>(
      `select slug::text as slug
         from products
        where slug = any($1::text[])`,
      [allCandidates]
    );
    for (const row of r.rows) {
      if (typeof row.slug === "string" && row.slug) exists.add(row.slug);
    }
  }

  const resolved: Array<{ slug: string; qty: number }> = [];
  const missing: InventoryDelta[] = [];

  for (let i = 0; i < deltas.length; i++) {
    const d = deltas[i];
    const candidates = perDeltaCandidates[i];
    const found = candidates.find((c) => exists.has(c)) || null;
    if (!found) {
      missing.push(d);
      continue;
    }
    resolved.push({ slug: found, qty: d.qty });
  }

  return { resolved, missing };
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
  if (deltas.length === 0) {
    // Nothing to decrement, but mark committed to stop repeated callbacks.
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

  const resolved = await resolveInventoryDeltasToSlugs(trx, deltas);
  if (resolved.missing.length > 0) {
    // Do not partially commit. Keep order pending for reconciliation.
    return false;
  }

  for (const d of resolved.resolved) {
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
  if (deltas.length === 0) {
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

  const resolved = await resolveInventoryDeltasToSlugs(trx, deltas);
  if (resolved.missing.length > 0) {
    return false;
  }

  for (const d of resolved.resolved) {
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
