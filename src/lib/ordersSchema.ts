import { db } from "@/lib/db";

/**
 * Orders schema stabilizer (Neon-safe, idempotent)
 *
 * Goals:
 * - Never drop or rewrite existing columns/types (avoid drift).
 * - Create missing tables with the *current* canonical shape.
 * - Add missing columns/indexes/constraints in a backward-compatible way.
 * - Support legacy deployments where order_items stored a single JSONB `items` payload.
 */
export async function ensureOrdersTables(): Promise<void> {
  // 1) orders (canonical shape)
  await db.query(`
    create table if not exists orders (
      id bigserial primary key,
      cart_id text,
      customer_id bigint,
      customer_email text,
      customer_name text,
      customer_phone text,
      shipping_city text,
      shipping_address text,
      shipping_country text,
      notes text,

      status text not null default 'PENDING_PAYMENT',
      amount numeric(10,2) not null default 0,
      currency text not null default 'JOD',
      locale text not null default 'en',
      payment_method text not null default 'PAYTABS',

      -- PayTabs fields (safe even if unused)
      paytabs_tran_ref text,
      paytabs_response_status text,
      paytabs_response_message text,
      paytabs_payload jsonb,
      paytabs_last_payload text,
      paytabs_last_signature text,

      -- snapshots
      customer jsonb,
      shipping jsonb,
      items jsonb,

      -- discount + totals (added over time via patches; keep optional)
      subtotal_before_discount_jod numeric(10,2),
      discount_jod numeric(10,2),
      subtotal_after_discount_jod numeric(10,2),
      shipping_jod numeric(10,2),
      total_jod numeric(10,2),

      -- promotions linkage
      promo_code text,
      promotion_id bigint,
      discount_source text,

      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);

  // Best-effort FK (only if customers exists; never fail deploy)
  await db.query(`
    do $$
    begin
      if exists (
        select 1 from information_schema.tables
         where table_schema='public' and table_name='customers'
      ) then
        begin
          alter table orders
            add constraint orders_customer_id_fk
            foreign key (customer_id) references customers(id)
            on delete set null;
        exception when duplicate_object then
          null;
        when others then
          null;
        end;
      end if;
    end $$;
  `);

  // 2) order_items (canonical normalized lines)
  // If the table already exists with a legacy shape (e.g., items jsonb),
  // create table if not exists will no-op, and we will not attempt to
  // force NOT NULL columns onto an existing legacy table.
  await db.query(`
    create table if not exists order_items (
      id bigserial primary key,
      order_id bigint not null,
      variant_id bigint not null,
      qty integer not null,
      unit_price_jod numeric(10,2) not null,
      lot_code text,
      line_total_jod numeric(10,2) not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint order_items_qty_check check (qty > 0)
    );
  `);

  // Ensure FK order_items -> orders (ignore if already exists)
  await db.query(`
    do $$
    begin
      begin
        alter table order_items
          add constraint order_items_order_id_fk
          foreign key (order_id) references orders(id)
          on delete cascade;
      exception when duplicate_object then
        null;
      when others then
        null;
      end;
    end $$;
  `);

  // 3) Add missing columns on orders (safe to run repeatedly)
  await db.query(`alter table orders add column if not exists customer_id bigint;`);
  await db.query(`alter table orders add column if not exists customer_email text;`);
  await db.query(`alter table orders add column if not exists customer_name text;`);
  await db.query(`alter table orders add column if not exists customer_phone text;`);
  await db.query(`alter table orders add column if not exists shipping_city text;`);
  await db.query(`alter table orders add column if not exists shipping_address text;`);
  await db.query(`alter table orders add column if not exists shipping_country text;`);
  await db.query(`alter table orders add column if not exists notes text;`);

  await db.query(`alter table orders add column if not exists amount numeric(10,2);`);
  await db.query(`alter table orders add column if not exists currency text;`);
  await db.query(`alter table orders add column if not exists locale text;`);
  await db.query(`alter table orders add column if not exists payment_method text;`);

  await db.query(`alter table orders add column if not exists subtotal_before_discount_jod numeric(10,2);`);
  await db.query(`alter table orders add column if not exists discount_jod numeric(10,2);`);
  await db.query(`alter table orders add column if not exists subtotal_after_discount_jod numeric(10,2);`);
  await db.query(`alter table orders add column if not exists shipping_jod numeric(10,2);`);
  await db.query(`alter table orders add column if not exists total_jod numeric(10,2);`);

  await db.query(`alter table orders add column if not exists promo_code text;`);
  await db.query(`alter table orders add column if not exists promotion_id bigint;`);
  await db.query(`alter table orders add column if not exists discount_source text;`);

  await db.query(`alter table orders add column if not exists created_at timestamptz;`);
  await db.query(`alter table orders add column if not exists updated_at timestamptz;`);

  await db.query(`update orders set currency='JOD' where currency is null;`);
  await db.query(`update orders set locale='en' where locale is null;`);
  await db.query(`update orders set payment_method='PAYTABS' where payment_method is null;`);
  await db.query(`update orders set created_at=coalesce(created_at, now()) where created_at is null;`);
  await db.query(`update orders set updated_at=coalesce(updated_at, created_at, now()) where updated_at is null;`);

  // 4) Add missing columns on order_items (only safe additions)
  // (If this is a legacy jsonb table, these will fail if types clash; guard by checking information_schema first)
  await db.query(`
    do $$
    begin
      if exists (
        select 1 from information_schema.columns
         where table_schema='public' and table_name='order_items' and column_name='variant_id'
      ) then
        -- canonical table already (or compatible); keep it tidy
        begin
          alter table order_items add column if not exists created_at timestamptz;
          alter table order_items add column if not exists updated_at timestamptz;
        exception when others then
          null;
        end;
        begin
          update order_items
             set created_at = coalesce(created_at, now())
           where created_at is null;
          update order_items
             set updated_at = coalesce(updated_at, created_at, now())
           where updated_at is null;
        exception when others then
          null;
        end;
      end if;
    end $$;
  `);

  // 5) Constraints (best-effort, no failures)
  await db.query(`
    do $$
    begin
      if not exists (select 1 from pg_constraint where conname='orders_discount_source_chk') then
        begin
          alter table orders
            add constraint orders_discount_source_chk
            check (discount_source is null or discount_source in ('NONE','CODE','AUTO'));
        exception when others then
          null;
        end;
      end if;

      if not exists (select 1 from pg_constraint where conname='orders_single_discount_chk') then
        begin
          alter table orders
            add constraint orders_single_discount_chk
            check (
              discount_jod is null
              or discount_jod >= 0
            );
        exception when others then
          null;
        end;
      end if;
    end $$;
  `);

  // 6) Indexes for account screens / admin
  await db.query(`create index if not exists idx_orders_customer_id_created_at on orders(customer_id, created_at desc);`);
  await db.query(`create index if not exists idx_orders_created_at on orders(created_at desc);`);
  await db.query(`create index if not exists idx_orders_promo_code on orders(promo_code);`);
  await db.query(`create index if not exists idx_order_items_order_id on order_items(order_id);`);
}

export type OrderRow = {
  id: number;
  cart_id: string | null;
  status: string;
  amount_jod: string; // returned as text for display safety
  created_at: string;

  // Optional discount/promo fields
  subtotal_before_discount_jod?: string | null;
  discount_jod?: string | null;
  subtotal_after_discount_jod?: string | null;
  shipping_jod?: string | null;
  total_jod?: string | null;
  promo_code?: string | null;
  promotion_id?: string | null;
  discount_source?: string | null;
};

export type OrderItemRow = {
  id: number;
  order_id: number;
  variant_id?: number;
  qty?: number;
  unit_price_jod?: string;
  line_total_jod?: string;
  lot_code?: string | null;
};

export type OrderDetails = OrderRow & {
  items?: unknown[]; // legacy jsonb representation
  line_items?: OrderItemRow[]; // normalized lines
};
