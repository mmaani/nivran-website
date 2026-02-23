import { db } from "@/lib/db";

/**
 * Orders schema stabilizer (Neon-safe, idempotent)
 * - Creates orders + order_items if missing
 * - Adds missing columns/indexes without breaking old deployments
 */
export async function ensureOrdersTables(): Promise<void> {
  // orders
  await db.query(`
    create table if not exists orders (
      id bigserial primary key,
      cart_id text,
      customer_id bigint,
      email text,
      status text not null default 'PENDING_PAYMENT',
      amount numeric(10,2) not null default 0,
      total_jod numeric(10,2),
      currency text not null default 'JOD',
      shipping_jod numeric(10,2),
      promo_code text,
      discount_jod numeric(10,2),
      paytabs_ref text,
      paytabs_status text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);

  // Best-effort FK (only if customers exists; don’t fail deploy if it doesn’t yet)
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

  // order_items (your DB dump shows order_items.items as jsonb)
  await db.query(`
    create table if not exists order_items (
      id bigserial primary key,
      order_id bigint not null,
      items jsonb not null default '[]'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
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

  // Add/normalize columns (safe to run repeatedly)
  await db.query(`alter table orders add column if not exists total_jod numeric(10,2);`);
  await db.query(`alter table orders add column if not exists promo_code text;`);
  await db.query(`alter table orders add column if not exists discount_jod numeric(10,2);`);
  await db.query(`alter table orders add column if not exists shipping_jod numeric(10,2);`);
  await db.query(`alter table orders add column if not exists currency text;`);
  await db.query(`alter table orders add column if not exists updated_at timestamptz;`);
  await db.query(`update orders set currency='JOD' where currency is null;`);
  await db.query(`update orders set updated_at=coalesce(updated_at, created_at, now()) where updated_at is null;`);

  // Indexes for account screens / admin
  await db.query(`create index if not exists idx_orders_customer_id_created_at on orders(customer_id, created_at desc);`);
  await db.query(`create index if not exists idx_orders_created_at on orders(created_at desc);`);
  await db.query(`create index if not exists idx_order_items_order_id on order_items(order_id);`);
}

export type OrderRow = {
  id: number;
  cart_id: string | null;
  status: string;
  amount_jod: string; // returned as text for display safety
  created_at: string;
};

export type OrderDetails = OrderRow & {
  items: unknown[]; // stored in order_items.items (jsonb array)
};
