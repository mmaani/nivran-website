-- NIVRAN: account + checkout + cart persistence patch
-- Safe to run multiple times.

-- 1) Customers: add address/location fields (app enforces mandatory)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS address_line1 text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS country text;

-- 2) Cart tables (server-side persistence)
CREATE TABLE IF NOT EXISTS customer_carts (
  customer_id bigint PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customer_cart_items (
  customer_id bigint NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  price_jod numeric(10,2) NOT NULL DEFAULT 0,
  qty int NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (customer_id, slug)
);

CREATE INDEX IF NOT EXISTS customer_cart_items_customer_id_idx ON customer_cart_items(customer_id);
