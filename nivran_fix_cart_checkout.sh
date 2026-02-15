#!/usr/bin/env bash
set -euo pipefail

# Run from repo root
test -f package.json || { echo "❌ Run this from the repo root (where package.json exists)."; exit 1; }

echo "==> Creating folders..."
mkdir -p "src/app/api/cart"
mkdir -p "src/app/api/cart/sync"
mkdir -p "src/app/api/catalog/product-by-slug"
mkdir -p "src/app/(store)/[locale]/checkout"

echo "==> Writing src/lib/cartStore.ts (schema-aware + ensureCartTables)..."
cat > "src/lib/cartStore.ts" <<'EOF'
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
EOF

echo "==> Writing /api/cart (guest-safe)..."
cat > "src/app/api/cart/route.ts" <<'EOF'
import { NextRequest, NextResponse } from "next/server";
import { getCustomerIdFromRequest } from "@/lib/identity";
import { ensureCartTables, getCart } from "@/lib/cartStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const customerId = await getCustomerIdFromRequest(req);

    // ✅ Guest-safe: never 401 here (prevents Vercel log spam)
    if (!customerId) {
      return NextResponse.json({ ok: true, customerId: null, items: [] }, { status: 200 });
    }

    await ensureCartTables();
    const cart = await getCart(Number(customerId));

    return NextResponse.json(
      { ok: true, customerId: Number(customerId), items: cart.items, updatedAt: cart.updatedAt },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Cart fetch failed" }, { status: 500 });
  }
}
EOF

echo "==> Writing /api/cart/sync (guest-safe)..."
cat > "src/app/api/cart/sync/route.ts" <<'EOF'
import { NextRequest, NextResponse } from "next/server";
import { getCustomerIdFromRequest } from "@/lib/identity";
import { ensureCartTables, mergeCart, overwriteCart, clearCart } from "@/lib/cartStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type IncomingItem = { slug?: string; name?: string; priceJod?: number; price_jod?: number; qty?: number };

function normalize(items: any): IncomingItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((x: any) => ({
      slug: String(x?.slug || "").trim(),
      name: String(x?.name || "").trim(),
      priceJod: Number(x?.priceJod ?? x?.price_jod ?? 0),
      qty: Math.max(1, Math.min(99, Number(x?.qty || 1))),
    }))
    .filter((x: any) => !!x.slug);
}

export async function POST(req: NextRequest) {
  try {
    const customerId = await getCustomerIdFromRequest(req);

    // ✅ Guest-safe: never 401 here either
    if (!customerId) {
      return NextResponse.json({ ok: true, customerId: null, items: [] }, { status: 200 });
    }

    const body = await req.json().catch(() => ({} as any));
    const mode = String(body?.mode || "merge").toLowerCase();
    const items = normalize(body?.items);

    await ensureCartTables();

    if (mode === "clear") {
      await clearCart(Number(customerId));
      return NextResponse.json({ ok: true, customerId: Number(customerId), items: [] }, { status: 200 });
    }

    const cart =
      mode === "replace" ? await overwriteCart(Number(customerId), items) : await mergeCart(Number(customerId), items);

    return NextResponse.json({ ok: true, customerId: Number(customerId), items: cart.items }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Cart sync failed" }, { status: 500 });
  }
}
EOF

echo "==> Updating CartHydrator to match new guest-safe /api/cart behavior..."
cat > "src/components/CartHydrator.tsx" <<'EOF'
"use client";

import React, { useEffect } from "react";

type CartItem = {
  slug: string;
  name: string;
  priceJod: number;
  qty: number;
};

const CART_KEY = "nivran_cart_v1";
const CUSTOMER_KEY = "nivran_customer_id_v1";

function readCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x: any) => ({
        slug: String(x?.slug || "").trim(),
        name: String(x?.name || "").trim(),
        priceJod: Number(x?.priceJod || 0),
        qty: Math.max(1, Math.min(99, Number(x?.qty || 1))),
      }))
      .filter((x: CartItem) => !!x.slug);
  } catch {
    return [];
  }
}

function writeCart(items: CartItem[]) {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event("nivran_cart_updated"));
  } catch {}
}

function readLocalCustomerId(): string | null {
  try {
    return localStorage.getItem(CUSTOMER_KEY);
  } catch {
    return null;
  }
}

function writeLocalCustomerId(id: string) {
  try {
    localStorage.setItem(CUSTOMER_KEY, id);
  } catch {}
}

export default function CartHydrator() {
  useEffect(() => {
    let cancelled = false;

    async function run() {
      // Always safe now: /api/cart returns 200 even for guests
      const res = await fetch("/api/cart", { cache: "no-store" }).catch(() => null as any);
      if (!res || !res.ok) return;

      const data = await res.json().catch(() => null);
      if (!data?.ok) return;

      const customerId = data.customerId ? String(data.customerId) : null;

      // Guest → do nothing (keep local cart)
      if (!customerId) return;

      const serverItems = Array.isArray(data.items) ? (data.items as CartItem[]) : [];
      const localItems = readCart();

      // If user changed account, avoid mixing carts
      const lastCustomer = readLocalCustomerId();
      if (lastCustomer && lastCustomer !== customerId) {
        // Prefer server cart for the newly-logged-in account
        writeCart(serverItems);
        writeLocalCustomerId(customerId);
        return;
      }

      writeLocalCustomerId(customerId);

      // If local has items → merge into server, then overwrite local with canonical server response
      if (localItems.length) {
        const syncRes = await fetch("/api/cart/sync", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ mode: "merge", items: localItems }),
        }).catch(() => null as any);

        if (!syncRes || !syncRes.ok) return;
        const syncData = await syncRes.json().catch(() => null);
        if (!syncData?.ok) return;

        const merged = Array.isArray(syncData.items) ? (syncData.items as CartItem[]) : [];
        if (!cancelled) writeCart(merged);
        return;
      }

      // If local empty but server has items → hydrate local
      if (!localItems.length && serverItems.length) {
        if (!cancelled) writeCart(serverItems);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
EOF

echo "==> Updating CartClient to dispatch badge events + keep server cart in sync when logged in..."
cat > "src/app/(store)/[locale]/cart/CartClient.tsx" <<'EOF'
"use client";

import React, { useEffect, useMemo, useState } from "react";

type Locale = "en" | "ar";

type CartItem = {
  slug: string;
  name: string;
  priceJod: number;
  qty: number;
};

const CART_KEY = "nivran_cart_v1";

function readCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x: any) => ({
        slug: String(x?.slug || "").trim(),
        name: String(x?.name || "").trim(),
        priceJod: Number(x?.priceJod || 0),
        qty: Math.max(1, Math.min(99, Number(x?.qty || 1))),
      }))
      .filter((x: CartItem) => !!x.slug);
  } catch {
    return [];
  }
}

function writeCart(items: CartItem[]) {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event("nivran_cart_updated"));
  } catch {}
}

async function bestEffortSync(items: CartItem[]) {
  // Guest-safe endpoint; if not logged in it just 200s and does nothing.
  try {
    await fetch("/api/cart/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "replace", items }),
    });
  } catch {}
}

export default function CartClient({ locale }: { locale: Locale }) {
  const isAr = locale === "ar";

  const [items, setItems] = useState<CartItem[]>([]);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    setItems(readCart());
    const onCustom = () => setItems(readCart());
    window.addEventListener("nivran_cart_updated", onCustom as any);
    return () => window.removeEventListener("nivran_cart_updated", onCustom as any);
  }, []);

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, i) => sum + Number(i.priceJod || 0) * Number(i.qty || 1), 0);
    const shipping = items.length ? 3.5 : 0;
    const total = Number((subtotal + shipping).toFixed(2));
    const qty = items.reduce((sum, i) => sum + Number(i.qty || 1), 0);
    return { subtotal, shipping, total, qty };
  }, [items]);

  const COPY = useMemo(
    () => ({
      title: isAr ? "السلة" : "Cart",
      empty: isAr ? "سلتك فارغة." : "Your cart is empty.",
      backToShop: isAr ? "العودة للمتجر" : "Back to shop",
      checkout: isAr ? "الدفع" : "Checkout",
      item: isAr ? "المنتج" : "Item",
      qty: isAr ? "الكمية" : "Qty",
      price: isAr ? "السعر" : "Price",
      subtotal: isAr ? "المجموع الفرعي" : "Subtotal",
      shipping: isAr ? "الشحن" : "Shipping",
      total: isAr ? "الإجمالي" : "Total",
      clear: isAr ? "تفريغ السلة" : "Clear cart",
      remove: isAr ? "حذف" : "Remove",
    }),
    [isAr]
  );

  function setAndSync(next: CartItem[]) {
    setItems(next);
    writeCart(next);
    bestEffortSync(next);
  }

  function inc(slug: string) {
    const next = items.map((i) => (i.slug === slug ? { ...i, qty: Math.min(99, i.qty + 1) } : i));
    setAndSync(next);
  }

  function dec(slug: string) {
    const next = items.map((i) => (i.slug === slug ? { ...i, qty: Math.max(1, i.qty - 1) } : i));
    setAndSync(next);
  }

  function remove(slug: string) {
    const next = items.filter((i) => i.slug !== slug);
    setAndSync(next);
  }

  async function clear() {
    setClearing(true);
    try {
      setAndSync([]);
      // Also clear server cart if logged in
      await fetch("/api/cart/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "clear" }),
      }).catch(() => null);
    } finally {
      setClearing(false);
    }
  }

  return (
    <div style={{ padding: "1.2rem 0" }}>
      <h1 className="title" style={{ marginTop: 0 }}>
        {COPY.title}
      </h1>

      {items.length === 0 ? (
        <div className="panel">
          <p className="muted" style={{ margin: 0 }}>
            {COPY.empty}
          </p>
          <div style={{ marginTop: 12 }}>
            <a className="btn btn-outline" href={`/${locale}/product`}>
              {COPY.backToShop}
            </a>
          </div>
        </div>
      ) : (
        <>
          <div className="panel" style={{ display: "grid", gap: 12 }}>
            {items.map((i) => (
              <div
                key={i.slug}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 10,
                  alignItems: "center",
                  borderBottom: "1px solid #eee",
                  paddingBottom: 10,
                }}
              >
                <div>
                  <strong>{i.name}</strong>
                  <div className="muted" style={{ marginTop: 4 }}>
                    {i.slug}
                  </div>
                  <div className="muted" style={{ marginTop: 4 }}>
                    {COPY.price}: {Number(i.priceJod || 0).toFixed(2)} JOD
                  </div>
                </div>

                <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button className="btn btn-outline" onClick={() => dec(i.slug)} aria-label="decrease">
                      −
                    </button>
                    <div style={{ minWidth: 28, textAlign: "center" }}>
                      <strong>{i.qty}</strong>
                    </div>
                    <button className="btn btn-outline" onClick={() => inc(i.slug)} aria-label="increase">
                      +
                    </button>
                  </div>

                  <button className="btn" onClick={() => remove(i.slug)}>
                    {COPY.remove}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="grid-2" style={{ marginTop: 14 }}>
            <div className="panel">
              <h3 style={{ marginTop: 0 }}>{isAr ? "الملخص" : "Summary"}</h3>
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="muted">{COPY.subtotal}</span>
                  <strong>{totals.subtotal.toFixed(2)} JOD</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="muted">{COPY.shipping}</span>
                  <strong>{totals.shipping.toFixed(2)} JOD</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18 }}>
                  <span>{COPY.total}</span>
                  <strong>{totals.total.toFixed(2)} JOD</strong>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                <a className="btn primary" href={`/${locale}/checkout`}>
                  {COPY.checkout}
                </a>
                <button className="btn btn-outline" onClick={clear} disabled={clearing}>
                  {COPY.clear}
                </button>
                <a className="btn btn-outline" href={`/${locale}/product`}>
                  {COPY.backToShop}
                </a>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
EOF

echo "==> Writing /api/catalog/product-by-slug (used by Buy Now fallback)..."
cat > "src/app/api/catalog/product-by-slug/route.ts" <<'EOF'
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureCatalogTables } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = String(searchParams.get("slug") || "").trim();
  if (!slug) return NextResponse.json({ ok: false, error: "Missing slug" }, { status: 400 });

  await ensureCatalogTables();

  const r = await db.query(
    `select slug, name_en, name_ar, description_en, description_ar, price_jod, is_active
       from products
      where slug=$1
      limit 1`,
    [slug]
  );

  const p = r.rows?.[0];
  if (!p) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  return NextResponse.json(
    {
      ok: true,
      product: {
        slug: p.slug,
        name_en: p.name_en,
        name_ar: p.name_ar,
        description_en: p.description_en,
        description_ar: p.description_ar,
        price_jod: Number(p.price_jod || 0),
        is_active: !!p.is_active,
      },
    },
    { status: 200 }
  );
}
EOF

echo "==> Updating /api/orders to accept multi-item carts (keeps single-item compatibility)..."
cat > "src/app/api/orders/route.ts" <<'EOF'
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureOrdersTables } from "@/lib/orders";
import { ensureCatalogTables } from "@/lib/catalog";
import { getCustomerIdFromRequest } from "@/lib/identity";

type PaymentMethod = "PAYTABS" | "COD";

type IncomingItem = {
  slug?: string;
  qty?: number;
  // client may send name/price but server will re-price from DB
  name?: string;
  priceJod?: number;
};

type OrderLine = {
  slug: string;
  name_en: string;
  name_ar: string;
  qty: number;
  unit_price_jod: number;
  line_total_jod: number;
  category_key: string | null;
};

async function fetchProductsBySlugs(slugs: string[]) {
  await ensureCatalogTables();
  const r = await db.query(
    `select slug, name_en, name_ar, price_jod, category_key, is_active
       from products
      where slug = any($1::text[])`,
    [slugs]
  );
  return r.rows || [];
}

function normalizeItems(items: any): { slug: string; qty: number }[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((x: IncomingItem) => ({
      slug: String(x?.slug || "").trim(),
      qty: Math.max(1, Math.min(99, Number(x?.qty || 1))),
    }))
    .filter((x) => !!x.slug);
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  await ensureOrdersTables();

  const customerId = await getCustomerIdFromRequest(req).catch(() => null);

  const body = await req.json().catch(() => null as any);
  if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });

  const locale = body.locale === "ar" ? "ar" : "en";

  const paymentMethod: PaymentMethod =
    String(body.paymentMethod || body.mode || "").toUpperCase() === "COD" ? "COD" : "PAYTABS";

  const customer = body.customer || {};
  const shipping = body.shipping || {};

  const name = String(customer.name || "").trim();
  const phone = String(customer.phone || "").trim();
  const email = String(customer.email || "").trim();
  const city = String(shipping.city || "").trim();
  const address = String(shipping.address || "").trim();
  const notes = String(shipping.notes || "").trim();
  const country = String(shipping.country || "Jordan").trim() || "Jordan";

  if (!name || !phone || !address || !email.includes("@")) {
    return NextResponse.json(
      { ok: false, error: locale === "ar" ? "الاسم والهاتف والعنوان والبريد الإلكتروني مطلوبة" : "Missing required fields" },
      { status: 400 }
    );
  }

  // Accept:
  // - multi-item: body.items[]
  // - legacy: body.productSlug + body.qty
  let items = normalizeItems(body.items);

  const legacySlug = String(body.productSlug || body.slug || "").trim();
  const legacyQty = Math.max(1, Math.min(99, Number(body.qty || 1)));

  if (!items.length && legacySlug) {
    items = [{ slug: legacySlug, qty: legacyQty }];
  }

  if (!items.length) {
    return NextResponse.json({ ok: false, error: locale === "ar" ? "لا توجد عناصر في السلة." : "No items" }, { status: 400 });
  }

  const slugs = Array.from(new Set(items.map((i) => i.slug)));
  const products = await fetchProductsBySlugs(slugs);

  const map = new Map<string, any>();
  for (const p of products) map.set(String(p.slug), p);

  // Build order lines with server pricing
  const lines: OrderLine[] = [];
  for (const it of items) {
    const p = map.get(it.slug);
    if (!p || !p.is_active) {
      return NextResponse.json({ ok: false, error: `Unknown or inactive product: ${it.slug}` }, { status: 400 });
    }
    const unit = Number(p.price_jod || 0);
    const qty = it.qty;
    lines.push({
      slug: it.slug,
      name_en: String(p.name_en || it.slug),
      name_ar: String(p.name_ar || p.name_en || it.slug),
      qty,
      unit_price_jod: unit,
      line_total_jod: Number((unit * qty).toFixed(2)),
      category_key: p.category_key ? String(p.category_key) : null,
    });
  }

  const subtotalBeforeDiscount = Number(lines.reduce((sum, l) => sum + l.line_total_jod, 0).toFixed(2));

  // (Promo support can be added later; keep it simple now)
  const discount = 0;
  const subtotalAfterDiscount = subtotalBeforeDiscount;
  const shippingJod = lines.length ? 3.5 : 0;
  const totalJod = Number((subtotalAfterDiscount + shippingJod).toFixed(2));

  const status =
    paymentMethod === "PAYTABS" ? "PENDING_PAYMENT" : "PENDING_COD_CONFIRM";

  const itemsJson = lines.map((l) => ({
    slug: l.slug,
    name_en: l.name_en,
    name_ar: l.name_ar,
    qty: l.qty,
    unit_price_jod: l.unit_price_jod,
    line_total_jod: l.line_total_jod,
  }));

  const r = await db.query<{ cart_id: string }>(
    `
    insert into orders (
      locale,
      status,
      payment_method,
      customer_id,
      customer_name,
      customer_phone,
      customer_email,
      shipping_city,
      shipping_address,
      shipping_country,
      notes,
      items,
      subtotal_before_discount_jod,
      discount_jod,
      subtotal_after_discount_jod,
      shipping_jod,
      total_jod
    )
    values (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
      $12::jsonb,
      $13,$14,$15,$16,$17
    )
    returning cart_id
  `,
    [
      locale,
      status,
      paymentMethod,
      customerId ? Number(customerId) : null,
      name,
      phone,
      email,
      city || null,
      address,
      country,
      notes || null,
      JSON.stringify(itemsJson),
      subtotalBeforeDiscount,
      discount,
      subtotalAfterDiscount,
      shippingJod,
      totalJod,
    ]
  );

  const cartId = r.rows?.[0]?.cart_id;
  return NextResponse.json({ ok: true, cartId, status }, { status: 200 });
}
EOF

echo "==> Writing CheckoutClient.tsx (cart-aware checkout)..."
cat > "src/app/(store)/[locale]/checkout/CheckoutClient.tsx" <<'EOF'
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

type Locale = "en" | "ar";

type CartItem = {
  slug: string;
  name: string;
  priceJod: number;
  qty: number;
};

const CART_KEY = "nivran_cart_v1";
const SHIPPING_JOD = 3.5;

function readCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x: any) => ({
        slug: String(x?.slug || "").trim(),
        name: String(x?.name || "").trim(),
        priceJod: Number(x?.priceJod || 0),
        qty: Math.max(1, Math.min(99, Number(x?.qty || 1))),
      }))
      .filter((x: CartItem) => !!x.slug);
  } catch {
    return [];
  }
}

function clearCart() {
  try {
    localStorage.removeItem(CART_KEY);
    window.dispatchEvent(new Event("nivran_cart_updated"));
  } catch {}
}

export default function CheckoutClient() {
  const p = useParams<{ locale?: string }>();
  const locale: Locale = p?.locale === "ar" ? "ar" : "en";
  const isAr = locale === "ar";

  const sp = useSearchParams();
  const buyNowSlug = String(sp.get("slug") || "").trim();

  const [items, setItems] = useState<CartItem[]>([]);
  const [loadingBuyNow, setLoadingBuyNow] = useState(false);

  // Customer/shipping fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  // Order state
  const [cartId, setCartId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Load cart from localStorage, or Buy Now from API if cart is empty
  useEffect(() => {
    const cart = readCart();
    if (cart.length) {
      setItems(cart);
      return;
    }

    if (buyNowSlug) {
      setLoadingBuyNow(true);
      fetch(`/api/catalog/product-by-slug?slug=${encodeURIComponent(buyNowSlug)}`)
        .then((r) => r.json())
        .then((j) => {
          if (!j?.ok || !j?.product) return;
          const prod = j.product;
          const prodName = isAr
            ? String(prod.name_ar || prod.name_en || prod.slug)
            : String(prod.name_en || prod.name_ar || prod.slug);
          const price = Number(prod.price_jod || 0);
          setItems([{ slug: prod.slug, name: prodName, priceJod: price, qty: 1 }]);
        })
        .finally(() => setLoadingBuyNow(false));
    } else {
      setItems([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buyNowSlug, locale]);

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, i) => sum + Number(i.priceJod || 0) * Number(i.qty || 1), 0);
    const shipping = items.length ? SHIPPING_JOD : 0;
    const total = Number((subtotal + shipping).toFixed(2));
    const qty = items.reduce((sum, i) => sum + Number(i.qty || 1), 0);
    return { subtotal, shipping, total, qty };
  }, [items]);

  const COPY = useMemo(
    () => ({
      title: isAr ? "الدفع" : "Checkout",
      empty: isAr ? "لا توجد عناصر في السلة." : "Your cart is empty.",
      backToShop: isAr ? "العودة للمتجر" : "Back to shop",
      editCart: isAr ? "تعديل السلة" : "Edit cart",
      loadingProduct: isAr ? "جارٍ تحميل المنتج..." : "Loading product...",
      required: isAr ? "الاسم والهاتف والعنوان والبريد الإلكتروني مطلوبة" : "Name, phone, address, and email are required",
      payCard: isAr ? "الدفع بالبطاقة" : "Pay by card",
      cod: isAr ? "الدفع عند الاستلام" : "Cash on delivery",
      orderSummary: isAr ? "ملخص الطلب" : "Order summary",
      subtotal: isAr ? "المجموع الفرعي" : "Subtotal",
      shipping: isAr ? "الشحن" : "Shipping",
      total: isAr ? "الإجمالي" : "Total",
      fullName: isAr ? "الاسم الكامل" : "Full name",
      phone: isAr ? "رقم الهاتف" : "Phone",
      email: isAr ? "البريد الإلكتروني" : "Email",
      city: isAr ? "المدينة" : "City",
      address: isAr ? "العنوان" : "Address",
      notes: isAr ? "ملاحظات" : "Notes",
      placed: isAr ? "تم إنشاء الطلب." : "Order created.",
    }),
    [isAr]
  );

  function validate() {
    if (!items.length) {
      setErr(COPY.empty);
      return false;
    }
    if (!name.trim() || !phone.trim() || !address.trim() || !email.includes("@")) {
      setErr(COPY.required);
      return false;
    }
    return true;
  }

  async function createOrder(paymentMethod: "PAYTABS" | "COD") {
    const payload = {
      locale,
      paymentMethod,
      items: items.map((i) => ({ slug: i.slug, qty: i.qty })), // server will re-price
      customer: { name, phone, email },
      shipping: { city, address, country: "Jordan", notes },
    };

    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    const raw = await res.text();
    let data: any = null;
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(`Order create failed (${res.status})`);
      }
    }

    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || `Order create failed (${res.status})`);
    }

    setCartId(String(data.cartId || ""));
    setStatus(String(data.status || ""));
    return String(data.cartId || "");
  }

  async function payByCard() {
    if (!validate()) return;
    setLoading(true);
    setErr(null);

    try {
      const cid = await createOrder("PAYTABS");
      const res = await fetch("/api/paytabs/initiate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cartId: cid }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "PayTabs initiate failed");
      // Clear cart only once user is leaving to payment (so they don’t pay twice)
      clearCart();
      window.location.href = data.redirectUrl || data.redirect_url;
    } catch (e: any) {
      setErr(e?.message || "Error");
    } finally {
      setLoading(false);
    }
  }

  async function cashOnDelivery() {
    if (!validate()) return;
    setLoading(true);
    setErr(null);

    try {
      await createOrder("COD");
      clearCart();
      setErr(COPY.placed);
    } catch (e: any) {
      setErr(e?.message || "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: "1.2rem 0" }}>
      <h1 className="title" style={{ marginTop: 0 }}>
        {COPY.title}
      </h1>

      {loadingBuyNow ? <p className="muted">{COPY.loadingProduct}</p> : null}

      {items.length === 0 ? (
        <div className="panel">
          <p className="muted" style={{ margin: 0 }}>
            {COPY.empty}
          </p>
          <div style={{ marginTop: 12 }}>
            <a className="btn btn-outline" href={`/${locale}/product`}>
              {COPY.backToShop}
            </a>
          </div>
        </div>
      ) : (
        <div className="grid-2">
          <section className="panel" style={{ display: "grid", gap: ".55rem" }}>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={COPY.fullName} />
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={COPY.phone} />
            <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={COPY.email} />
            <input className="input" value={city} onChange={(e) => setCity(e.target.value)} placeholder={COPY.city} />
            <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder={COPY.address} />
            <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder={COPY.notes} />

            {err && <p style={{ color: err === COPY.placed ? "seagreen" : "crimson", margin: 0 }}>{err}</p>}

            <div className="cta-row">
              <button className="btn primary" onClick={payByCard} disabled={loading}>
                {COPY.payCard}
              </button>
              <button className="btn" onClick={cashOnDelivery} disabled={loading}>
                {COPY.cod}
              </button>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
              <a className="btn btn-outline" href={`/${locale}/cart`}>
                {COPY.editCart}
              </a>
              <a className="btn btn-outline" href={`/${locale}/product`}>
                {COPY.backToShop}
              </a>
            </div>
          </section>

          <aside className="panel">
            <h3 style={{ marginTop: 0 }}>{COPY.orderSummary}</h3>

            <div style={{ display: "grid", gap: 10 }}>
              {items.map((i) => (
                <div key={i.slug} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <strong>{i.name}</strong>
                    <div className="muted" style={{ marginTop: 4 }}>
                      {i.qty} × {Number(i.priceJod || 0).toFixed(2)} JOD
                    </div>
                    <div className="muted" style={{ marginTop: 2 }}>{i.slug}</div>
                  </div>
                  <div style={{ minWidth: 120, textAlign: "end" }}>
                    <strong>{(Number(i.priceJod || 0) * Number(i.qty || 1)).toFixed(2)} JOD</strong>
                  </div>
                </div>
              ))}
            </div>

            <hr style={{ margin: "14px 0", border: "none", borderTop: "1px solid #eee" }} />

            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted">{COPY.subtotal}</span>
                <strong>{totals.subtotal.toFixed(2)} JOD</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted">{COPY.shipping}</span>
                <strong>{totals.shipping.toFixed(2)} JOD</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18 }}>
                <span>{COPY.total}</span>
                <strong>{totals.total.toFixed(2)} JOD</strong>
              </div>
            </div>

            {cartId ? (
              <p style={{ marginBottom: 0, fontFamily: "monospace", marginTop: 12 }}>
                cart_id: {cartId} {status ? `(${status})` : null}
              </p>
            ) : null}
          </aside>
        </div>
      )}
    </div>
  );
}
EOF

echo "==> Wiring checkout/page.tsx to the new client..."
cat > "src/app/(store)/[locale]/checkout/page.tsx" <<'EOF'
import CheckoutClient from "./CheckoutClient";

export default function Page() {
  return <CheckoutClient />;
}
EOF

echo "✅ Done. Next steps:"
echo "1) Run: pnpm -s lint && pnpm -s build   (or npm/yarn equivalent)"
echo "2) Deploy to Vercel"
echo ""
echo "Expected result: /api/cart and /api/cart/sync will be 200 for guests (no more 401 spam)."
