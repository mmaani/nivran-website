import { db } from "@/lib/db";

export async function ensureCatalogTables() {
  await db.query(`
    create table if not exists products (
      id bigserial primary key,
      slug text not null unique,
      name_en text not null,
      name_ar text not null,
      description_en text,
      description_ar text,
      price_jod numeric(10,2) not null,
      compare_at_price_jod numeric(10,2),
      inventory_qty integer not null default 0,
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists promotions (
      id bigserial primary key,
      code text not null unique,
      title_en text not null,
      title_ar text not null,
      discount_type text not null check (discount_type in ('PERCENT','FIXED')),
      discount_value numeric(10,2) not null,
      starts_at timestamptz,
      ends_at timestamptz,
      usage_limit integer,
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create index if not exists idx_products_active on products(is_active);
    create index if not exists idx_promotions_active on promotions(is_active);
  `);
}
