#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

echo "==> Creating directories"
mkdir -p "sql"
mkdir -p "src/lib"
mkdir -p "src/components"
mkdir -p "src/app/api/cart/sync"
mkdir -p "src/app/api/cart"
mkdir -p "src/app/api/auth/profile"
mkdir -p "src/app/admin/customers"
mkdir -p "src/app/(store)/[locale]/account"
mkdir -p "src/app/(store)/[locale]/account/login"
mkdir -p "src/app/(store)/[locale]/account/signup"
mkdir -p "src/app/(store)/[locale]/checkout"

echo "==> Writing SQL patch (Neon)"
cat > db/migrations/patches/006_account_checkout_patch.sql <<'SQL'
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
SQL

echo "==> Updating src/lib/identity.ts"
cat > src/lib/identity.ts <<'TS'
import crypto from "crypto";
import { db } from "@/lib/db";

/** Cookies */
export const CUSTOMER_SESSION_COOKIE = "nivran_customer_session";
export const ADMIN_TOKEN_COOKIE = "nivran_admin_token";

/** Helpers */
export function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function createSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function createAdminSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Password hashing:
 * - Supports bcrypt hashes if your old DB uses them ($2a/$2b/$2y…)
 * - Otherwise uses PBKDF2 with a self-describing format: pbkdf2$iter$saltB64$hashB64
 */
export function hashPassword(password: string): string {
  const pwd = String(password || "");
  const bcrypt = tryBcrypt();
  if (bcrypt) return bcrypt.hashSync(pwd, 10);

  const iter = 210_000;
  const salt = crypto.randomBytes(16);
  const key = crypto.pbkdf2Sync(pwd, salt, iter, 32, "sha256");
  return `pbkdf2$${iter}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const pwd = String(password || "");
  const h = String(stored || "");

  if (/^\$2[aby]\$/.test(h)) {
    const bcrypt = tryBcrypt();
    if (!bcrypt) throw new Error("bcrypt hash detected but bcrypt module not installed");
    return bcrypt.compareSync(pwd, h);
  }

  if (h.startsWith("pbkdf2$")) {
    const parts = h.split("$");
    if (parts.length !== 4) return false;
    const iter = Number(parts[1] || 0);
    const salt = Buffer.from(parts[2], "base64");
    const hash = Buffer.from(parts[3], "base64");
    const key = crypto.pbkdf2Sync(pwd, salt, iter, hash.length, "sha256");
    return crypto.timingSafeEqual(hash, key);
  }

  return false;
}

function tryBcrypt(): any | null {
  try {
    // prefer bcryptjs in serverless builds
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("bcryptjs");
  } catch {}
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("bcrypt");
  } catch {}
  return null;
}

/** Tables */
export async function ensureIdentityTables() {
  // Keep it light: only create if missing (safe for Neon).
  await db.query(`
    create table if not exists customers (
      id bigserial primary key,
      email text unique not null,
      password_hash text not null,
      full_name text,
      phone text,
      address_line1 text,
      city text,
      country text,
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);

  await db.query(`
    create table if not exists customer_sessions (
      id bigserial primary key,
      customer_id bigint not null references customers(id) on delete cascade,
      token_hash text not null,
      created_at timestamptz not null default now(),
      expires_at timestamptz not null,
      revoked_at timestamptz
    );
  `);
  await db.query(`create index if not exists customer_sessions_token_hash_idx on customer_sessions(token_hash);`);

  await db.query(`
    create table if not exists password_reset_tokens (
      id bigserial primary key,
      email text not null,
      token text not null,
      expires_at timestamptz not null,
      used_at timestamptz,
      created_at timestamptz not null default now()
    );
  `);

  await db.query(`
    create table if not exists staff_users (
      id bigserial primary key,
      username text unique not null,
      password_hash text not null,
      role text not null default 'admin',
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);
}

/** Customers */
export type CustomerRow = {
  id: number;
  email: string;
  password_hash: string;
  full_name: string | null;
  phone: string | null;
  address_line1: string | null;
  city: string | null;
  country: string | null;
  is_active: boolean;
  created_at: string;
};

export async function getCustomerByEmail(email: string): Promise<CustomerRow | null> {
  await ensureIdentityTables();
  const e = String(email || "").trim().toLowerCase();
  if (!e) return null;
  const r = await db.query<CustomerRow>(
    `select id, email, password_hash, full_name, phone, address_line1, city, country, is_active, created_at::text as created_at
       from customers
      where lower(email)=lower($1)
      limit 1`,
    [e]
  );
  return r.rows[0] || null;
}

export async function createCustomer(args: {
  email: string;
  fullName: string;
  password: string;
  phone: string;
  addressLine1: string;
  city: string;
  country: string;
}): Promise<{ id: number; email: string }> {
  await ensureIdentityTables();

  const email = String(args.email || "").trim().toLowerCase();
  const fullName = String(args.fullName || "").trim();
  const phone = String(args.phone || "").trim();
  const addressLine1 = String(args.addressLine1 || "").trim();
  const city = String(args.city || "").trim();
  const country = String(args.country || "").trim() || "Jordan";

  const passwordHash = hashPassword(args.password);

  const r = await db.query<{ id: number; email: string }>(
    `insert into customers (email, password_hash, full_name, phone, address_line1, city, country, is_active)
     values ($1,$2,$3,$4,$5,$6,$7,true)
     returning id, email`,
    [email, passwordHash, fullName, phone, addressLine1, city, country]
  );
  return r.rows[0];
}

export async function createCustomerSession(customerId: number, token: string) {
  await ensureIdentityTables();
  const tokenHash = sha256Hex(token);
  // 30 days
  const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
  await db.query(
    `insert into customer_sessions (customer_id, token_hash, expires_at)
     values ($1,$2,$3)`,
    [customerId, tokenHash, expiresAt]
  );
}

export async function getCustomerIdFromRequest(req: Request): Promise<number | null> {
  await ensureIdentityTables();
  const cookie = req.headers.get("cookie") || "";
  const token = readCookie(cookie, CUSTOMER_SESSION_COOKIE);
  if (!token) return null;

  const tokenHash = sha256Hex(token);
  const r = await db.query<{ customer_id: number }>(
    `select customer_id
       from customer_sessions
      where token_hash=$1
        and revoked_at is null
        and expires_at > now()
      limit 1`,
    [tokenHash]
  );
  return r.rows[0]?.customer_id ?? null;
}

function readCookie(cookieHeader: string, name: string): string | null {
  const parts = String(cookieHeader || "").split(";").map((s) => s.trim());
  for (const p of parts) {
    if (!p) continue;
    const eq = p.indexOf("=");
    if (eq < 0) continue;
    const k = p.slice(0, eq).trim();
    const v = p.slice(eq + 1).trim();
    if (k === name) return decodeURIComponent(v);
  }
  return null;
}

/** Staff */
export type StaffUser = {
  id: number;
  username: string;
  password_hash: string;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export async function listStaffUsers(): Promise<StaffUser[]> {
  await ensureIdentityTables();
  const r = await db.query<StaffUser>(
    `select id, username, password_hash, role, is_active,
            created_at::text as created_at, updated_at::text as updated_at
       from staff_users
      order by created_at desc
      limit 200`
  );
  return r.rows;
}

export async function upsertStaffUser(args: {
  id?: number;
  username: string;
  password?: string;
  role: string;
  is_active: boolean;
}) {
  await ensureIdentityTables();

  const username = String(args.username || "").trim().toLowerCase();
  const role = String(args.role || "admin").trim();
  const isActive = !!args.is_active;

  if (!username) throw new Error("Missing username");

  if (args.id) {
    if (args.password) {
      const ph = hashPassword(args.password);
      await db.query(
        `update staff_users
            set username=$1, role=$2, is_active=$3, password_hash=$4, updated_at=now()
          where id=$5`,
        [username, role, isActive, ph, args.id]
      );
    } else {
      await db.query(
        `update staff_users
            set username=$1, role=$2, is_active=$3, updated_at=now()
          where id=$4`,
        [username, role, isActive, args.id]
      );
    }
    return;
  }

  if (!args.password) throw new Error("Password required for new staff user");
  const ph = hashPassword(args.password);
  await db.query(
    `insert into staff_users (username, password_hash, role, is_active)
     values ($1,$2,$3,$4)`,
    [username, ph, role, isActive]
  );
}
TS

echo "==> Updating src/lib/cartStore.ts (adds ensureCartTables + server persistence helpers)"
cat > src/lib/cartStore.ts <<'TS'
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
TS

echo "==> Writing /api/cart + /api/cart/sync"
cat > src/app/api/cart/route.ts <<'TS'
import { getCustomerIdFromRequest } from "@/lib/identity";
import { getCart } from "@/lib/cartStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const customerId = await getCustomerIdFromRequest(req);
  if (!customerId) return Response.json({ ok: false, authed: false });

  const items = await getCart(customerId);
  return Response.json({ ok: true, authed: true, customerId, items });
}
TS

cat > src/app/api/cart/sync/route.ts <<'TS'
import { getCustomerIdFromRequest } from "@/lib/identity";
import { upsertCart, CartItem } from "@/lib/cartStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const customerId = await getCustomerIdFromRequest(req);
  if (!customerId) return Response.json({ ok: false, authed: false }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const items = Array.isArray(body?.items) ? (body.items as CartItem[]) : [];
  const merged = await upsertCart(customerId, items);

  return Response.json({ ok: true, authed: true, items: merged });
}
TS

echo "==> Fixing /api/auth/profile to return profile + orders (matches AccountClient)"
cat > src/app/api/auth/profile/route.ts <<'TS'
import { db } from "@/lib/db";
import { ensureCatalogTables } from "@/lib/catalog";
import { ensureIdentityTables, getCustomerIdFromRequest } from "@/lib/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await ensureCatalogTables();
  await ensureIdentityTables();

  const customerId = await getCustomerIdFromRequest(req);
  if (!customerId) return Response.json({ ok: false }, { status: 401 });

  const pr = await db.query(
    `select id, email, full_name, phone, address_line1, city, country,
            created_at::text as created_at
       from customers
      where id=$1 and is_active=true
      limit 1`,
    [customerId]
  );
  const profile = pr.rows[0];
  if (!profile) return Response.json({ ok: false }, { status: 401 });

  // Orders summary
  const or = await db.query(
    `select id, cart_id, status,
            amount_jod::text as amount_jod,
            created_at::text as created_at
       from orders
      where customer_id=$1
      order by created_at desc
      limit 50`,
    [customerId]
  );

  return Response.json({ ok: true, profile, orders: or.rows });
}

export async function PUT(req: Request) {
  await ensureIdentityTables();

  const customerId = await getCustomerIdFromRequest(req);
  if (!customerId) return Response.json({ ok: false }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  const fullName = String(body?.full_name || "").trim();
  const phone = String(body?.phone || "").trim();
  const addressLine1 = String(body?.address_line1 || "").trim();
  const city = String(body?.city || "").trim();
  const country = String(body?.country || "").trim() || "Jordan";

  // App-level mandatory fields
  if (!fullName || !phone || !addressLine1) {
    return Response.json(
      { ok: false, error: "Missing required fields (full name, phone, address)." },
      { status: 400 }
    );
  }

  await db.query(
    `update customers
        set full_name=$1, phone=$2, address_line1=$3, city=$4, country=$5, updated_at=now()
      where id=$6`,
    [fullName, phone, addressLine1, city, country, customerId]
  );

  return Response.json({ ok: true });
}
TS

echo "==> Updating account page: /account auto-redirects to /account/login if not authed"
cat > 'src/app/(store)/[locale]/account/page.tsx' <<'TSX'
import AccountClient from "./AccountClient";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { CUSTOMER_SESSION_COOKIE, ensureIdentityTables, sha256Hex } from "@/lib/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = rawLocale === "ar" ? "ar" : "en";

  await ensureIdentityTables();

  const token = cookies().get(CUSTOMER_SESSION_COOKIE)?.value || "";
  if (!token) redirect(`/${locale}/account/login`);

  const tokenHash = sha256Hex(token);
  const r = await db.query<{ customer_id: number }>(
    `select customer_id
       from customer_sessions
      where token_hash=$1
        and revoked_at is null
        and expires_at > now()
      limit 1`,
    [tokenHash]
  );

  if (!r.rows[0]?.customer_id) redirect(`/${locale}/account/login`);

  return <AccountClient locale={locale} />;
}
TSX

echo "==> Updating AccountClient to match new /api/auth/profile response"
cat > 'src/app/(store)/[locale]/account/AccountClient.tsx' <<'TSX'
"use client";

import { useEffect, useMemo, useState } from "react";

type Profile = {
  id: number;
  email: string;
  full_name: string | null;
  phone: string | null;
  address_line1: string | null;
  city: string | null;
  country: string | null;
  created_at: string;
};

type OrderRow = {
  id: number;
  cart_id: string;
  status: string;
  amount_jod: string;
  created_at: string;
};

export default function AccountClient({ locale }: { locale: string }) {
  const isAr = locale === "ar";

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("Jordan");

  const canSave = useMemo(() => !!fullName.trim() && !!phone.trim() && !!addressLine1.trim(), [
    fullName,
    phone,
    addressLine1,
  ]);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setErr(null);

      const res = await fetch("/api/auth/profile", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));

      if (!alive) return;

      if (!res.ok || !data?.ok) {
        setErr(isAr ? "يرجى تسجيل الدخول." : "Please login.");
        setProfile(null);
        setOrders([]);
        setLoading(false);
        return;
      }

      setProfile(data.profile);
      setOrders(Array.isArray(data.orders) ? data.orders : []);

      setFullName(String(data.profile?.full_name || ""));
      setPhone(String(data.profile?.phone || ""));
      setAddressLine1(String(data.profile?.address_line1 || ""));
      setCity(String(data.profile?.city || ""));
      setCountry(String(data.profile?.country || "Jordan"));

      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [isAr]);

  async function saveProfile() {
    setErr(null);
    const res = await fetch("/api/auth/profile", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        full_name: fullName,
        phone,
        address_line1: addressLine1,
        city,
        country,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      setErr(data?.error || (isAr ? "تعذر حفظ البيانات." : "Could not save profile."));
      return;
    }
    // Refresh
    const r = await fetch("/api/auth/profile", { cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    if (r.ok && d?.ok) setProfile(d.profile);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = `/${locale}/`;
  }

  if (loading) return <p className="muted">{isAr ? "جارٍ التحميل..." : "Loading..."}</p>;
  if (!profile)
    return (
      <div className="panel">
        <p className="muted">{err || (isAr ? "يرجى تسجيل الدخول." : "Please login.")}</p>
        <a className="btn" href={`/${locale}/account/login`}>
          {isAr ? "تسجيل الدخول" : "Login"}
        </a>
      </div>
    );

  return (
    <div style={{ padding: "1.2rem 0", maxWidth: 860 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h1 className="title" style={{ margin: 0 }}>
          {isAr ? "حسابي" : "My Account"}
        </h1>
        <button className="btn btn-outline" onClick={logout}>
          {isAr ? "تسجيل خروج" : "Logout"}
        </button>
      </div>

      <div className="panel" style={{ marginTop: 14 }}>
        <h3 style={{ marginTop: 0 }}>{isAr ? "البيانات الشخصية" : "Profile"}</h3>

        <div className="grid-2" style={{ gap: 10 }}>
          <label>
            <span className="muted">{isAr ? "الاسم الكامل *" : "Full name *"}</span>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </label>

          <label>
            <span className="muted">{isAr ? "البريد الإلكتروني" : "Email"}</span>
            <input value={profile.email} readOnly />
          </label>

          <label>
            <span className="muted">{isAr ? "الهاتف *" : "Phone *"}</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>

          <label>
            <span className="muted">{isAr ? "الدولة" : "Country"}</span>
            <input value={country} onChange={(e) => setCountry(e.target.value)} />
          </label>

          <label style={{ gridColumn: "1 / -1" }}>
            <span className="muted">{isAr ? "العنوان *" : "Address *"}</span>
            <input value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} />
          </label>

          <label style={{ gridColumn: "1 / -1" }}>
            <span className="muted">{isAr ? "المدينة" : "City"}</span>
            <input value={city} onChange={(e) => setCity(e.target.value)} />
          </label>
        </div>

        {err ? <p style={{ color: "crimson", marginTop: 10 }}>{err}</p> : null}

        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button className={"btn" + (!canSave ? " btn-disabled" : "")} disabled={!canSave} onClick={saveProfile}>
            {isAr ? "حفظ" : "Save"}
          </button>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 14 }}>
        <h3 style={{ marginTop: 0 }}>{isAr ? "الطلبات" : "Orders"}</h3>

        {orders.length ? (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>{isAr ? "الرقم" : "ID"}</th>
                  <th>{isAr ? "السلة" : "Cart"}</th>
                  <th>{isAr ? "الحالة" : "Status"}</th>
                  <th>{isAr ? "المبلغ" : "Amount"}</th>
                  <th>{isAr ? "التاريخ" : "Date"}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>{o.id}</td>
                    <td>{o.cart_id}</td>
                    <td>{o.status}</td>
                    <td>{Number(o.amount_jod || 0).toFixed(2)} JOD</td>
                    <td>{new Date(o.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">{isAr ? "لا توجد طلبات بعد." : "No orders yet."}</p>
        )}
      </div>
    </div>
  );
}
TSX

echo "==> Updating login/signup pages: sync cart after auth"
cat > 'src/app/(store)/[locale]/account/login/page.tsx' <<'TSX'
"use client";
import { useEffect, useMemo, useState } from "react";
import { CART_LOCAL_KEY } from "@/lib/cartStore";

type Locale = "en" | "ar";
function t(locale: Locale, en: string, ar: string) {
  return locale === "ar" ? ar : en;
}

function readLocalCart() {
  try {
    const raw = localStorage.getItem(CART_LOCAL_KEY);
    const items = raw ? JSON.parse(raw) : [];
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

export default function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const [locale, setLocale] = useState<Locale>("en");
  const isAr = locale === "ar";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setLocale(p.locale === "ar" ? "ar" : "en"));
  }, [params]);

  const can = useMemo(() => !!email.trim() && !!password.trim(), [email, password]);

  async function syncCartIfAny() {
    const items = readLocalCart();
    await fetch("/api/cart/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items }),
    }).catch(() => {});
  }

  async function submit(e: any) {
    e.preventDefault();
    if (!can || busy) return;
    setBusy(true);
    setError(null);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      setBusy(false);
      setError(data?.error || t(locale, "Login failed.", "فشل تسجيل الدخول."));
      return;
    }

    // Merge local cart into account cart
    await syncCartIfAny();

    // Optional ?next=
    const qs = new URLSearchParams(window.location.search);
    const next = qs.get("next");
    window.location.href = next || `/${locale}/account`;
  }

  return (
    <div style={{ padding: "1.2rem 0", maxWidth: 520 }}>
      <h1 className="title">{t(locale, "Login", "تسجيل الدخول")}</h1>
      <form className="panel" onSubmit={submit}>
        <label>
          <span className="muted">{t(locale, "Email", "البريد الإلكتروني")}</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </label>

        <label style={{ marginTop: 10 }}>
          <span className="muted">{t(locale, "Password", "كلمة المرور")}</span>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
        </label>

        {error ? <p style={{ color: "crimson", marginTop: 10 }}>{error}</p> : null}

        <button className={"btn" + (!can || busy ? " btn-disabled" : "")} disabled={!can || busy} style={{ marginTop: 12 }}>
          {busy ? t(locale, "Please wait…", "يرجى الانتظار…") : t(locale, "Login", "تسجيل الدخول")}
        </button>

        <p className="muted" style={{ marginTop: 12 }}>
          {t(locale, "No account?", "لا تملك حساباً؟")}{" "}
          <a href={`/${locale}/account/signup`}>{t(locale, "Create one", "إنشاء حساب")}</a>
        </p>
      </form>
    </div>
  );
}
TSX

cat > 'src/app/(store)/[locale]/account/signup/page.tsx' <<'TSX'
"use client";
import { useEffect, useMemo, useState } from "react";
import { CART_LOCAL_KEY } from "@/lib/cartStore";

type Locale = "en" | "ar";
function t(locale: Locale, en: string, ar: string) {
  return locale === "ar" ? ar : en;
}

function readLocalCart() {
  try {
    const raw = localStorage.getItem(CART_LOCAL_KEY);
    const items = raw ? JSON.parse(raw) : [];
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

export default function SignupPage({ params }: { params: Promise<{ locale: string }> }) {
  const [locale, setLocale] = useState<Locale>("en");
  const isAr = locale === "ar";

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("Jordan");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setLocale(p.locale === "ar" ? "ar" : "en"));
  }, [params]);

  const can = useMemo(
    () => !!fullName.trim() && !!email.trim() && !!phone.trim() && !!addressLine1.trim() && !!password.trim(),
    [fullName, email, phone, addressLine1, password]
  );

  async function syncCartIfAny() {
    const items = readLocalCart();
    await fetch("/api/cart/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items }),
    }).catch(() => {});
  }

  async function submit(e: any) {
    e.preventDefault();
    if (!can || busy) return;
    setBusy(true);
    setError(null);

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fullName,
        email,
        phone,
        addressLine1,
        city,
        country,
        password,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      setBusy(false);
      setError(data?.error || t(locale, "Signup failed.", "فشل إنشاء الحساب."));
      return;
    }

    await syncCartIfAny();
    window.location.href = `/${locale}/account`;
  }

  return (
    <div style={{ padding: "1.2rem 0", maxWidth: 560 }}>
      <h1 className="title">{t(locale, "Create account", "إنشاء حساب")}</h1>

      <form className="panel" onSubmit={submit}>
        <label>
          <span className="muted">{t(locale, "Full name *", "الاسم الكامل *")}</span>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </label>

        <label style={{ marginTop: 10 }}>
          <span className="muted">{t(locale, "Email *", "البريد الإلكتروني *")}</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </label>

        <label style={{ marginTop: 10 }}>
          <span className="muted">{t(locale, "Phone *", "الهاتف *")}</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </label>

        <label style={{ marginTop: 10 }}>
          <span className="muted">{t(locale, "Address *", "العنوان *")}</span>
          <input value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} required />
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
          <label>
            <span className="muted">{t(locale, "City", "المدينة")}</span>
            <input value={city} onChange={(e) => setCity(e.target.value)} />
          </label>
          <label>
            <span className="muted">{t(locale, "Country", "الدولة")}</span>
            <input value={country} onChange={(e) => setCountry(e.target.value)} />
          </label>
        </div>

        <label style={{ marginTop: 10 }}>
          <span className="muted">{t(locale, "Password *", "كلمة المرور *")}</span>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
        </label>

        {error ? <p style={{ color: "crimson", marginTop: 10 }}>{error}</p> : null}

        <button className={"btn" + (!can || busy ? " btn-disabled" : "")} disabled={!can || busy} style={{ marginTop: 12 }}>
          {busy ? t(locale, "Please wait…", "يرجى الانتظار…") : t(locale, "Create account", "إنشاء الحساب")}
        </button>

        <p className="muted" style={{ marginTop: 12 }}>
          {t(locale, "Already have an account?", "لديك حساب؟")}{" "}
          <a href={`/${locale}/account/login`}>{t(locale, "Login", "تسجيل الدخول")}</a>
        </p>
      </form>
    </div>
  );
}
TSX

echo "==> Updating /api/auth/signup to store mandatory fields"
cat > src/app/api/auth/signup/route.ts <<'TS'
import { NextResponse } from "next/server";
import { createCustomer, createCustomerSession, createSessionToken, getCustomerByEmail } from "@/lib/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const fullName = String(body?.fullName || "").trim();
  const email = String(body?.email || "").trim().toLowerCase();
  const phone = String(body?.phone || "").trim();
  const addressLine1 = String(body?.addressLine1 || "").trim();
  const city = String(body?.city || "").trim();
  const country = String(body?.country || "").trim() || "Jordan";
  const password = String(body?.password || "").trim();

  if (!fullName || !email || !phone || !addressLine1 || !password) {
    return NextResponse.json(
      { ok: false, error: "Missing required fields (name, email, phone, address, password)." },
      { status: 400 }
    );
  }

  const exists = await getCustomerByEmail(email);
  if (exists) return NextResponse.json({ ok: false, error: "Email already registered." }, { status: 409 });

  const created = await createCustomer({
    email,
    fullName,
    password,
    phone,
    addressLine1,
    city,
    country,
  });

  const token = createSessionToken();
  await createCustomerSession(created.id, token);

  const res = NextResponse.json({ ok: true });

  res.cookies.set("nivran_customer_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return res;
}
TS

echo "==> Updating checkout: use cart items + consent (checked by default)"
cat > 'src/app/(store)/[locale]/checkout/page.tsx' <<'TSX'
"use client";

import { useEffect, useMemo, useState } from "react";
import { CART_LOCAL_KEY } from "@/lib/cartStore";

type Locale = "en" | "ar";
function t(locale: Locale, en: string, ar: string) {
  return locale === "ar" ? ar : en;
}

type CartItem = { slug: string; name: string; priceJod: number; qty: number };

function readCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_LOCAL_KEY);
    const items = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(items)) return [];
    return items
      .map((i: any) => ({
        slug: String(i.slug || "").trim(),
        name: String(i.name || "").trim(),
        priceJod: Number(i.priceJod || 0),
        qty: Math.max(1, Number(i.qty || 1)),
      }))
      .filter((i) => i.slug && i.name);
  } catch {
    return [];
  }
}

function writeCart(items: CartItem[]) {
  localStorage.setItem(CART_LOCAL_KEY, JSON.stringify(items));
}

export default function CheckoutPage({ params }: { params: Promise<{ locale: string }> }) {
  const [locale, setLocale] = useState<Locale>("en");
  const [items, setItems] = useState<CartItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("Jordan");

  const [createAccount, setCreateAccount] = useState(true); // checked by default
  const [paymentMethod, setPaymentMethod] = useState<"CARD" | "COD">("CARD");

  useEffect(() => {
    params.then((p) => setLocale(p.locale === "ar" ? "ar" : "en"));
    setItems(readCart());
  }, [params]);

  const subtotal = useMemo(() => items.reduce((s, i) => s + i.priceJod * i.qty, 0), [items]);
  const shipping = 3.5;
  const total = subtotal + (items.length ? shipping : 0);

  const canSubmit = useMemo(() => {
    if (!items.length) return false;
    return !!fullName.trim() && !!email.trim() && !!phone.trim() && !!addressLine1.trim();
  }, [items, fullName, email, phone, addressLine1]);

  function updateQty(slug: string, qty: number) {
    const next = items.map((i) => (i.slug === slug ? { ...i, qty: Math.max(1, qty) } : i));
    setItems(next);
    writeCart(next);
    setMsg(null);
    setErr(null);
  }

  function removeItem(slug: string) {
    const next = items.filter((i) => i.slug !== slug);
    setItems(next);
    writeCart(next);
    setMsg(null);
    setErr(null);
  }

  async function clearCartServerIfAuthed() {
    // If logged in, clear server cart too
    await fetch("/api/cart/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: [] }),
    }).catch(() => {});
  }

  async function submit(e: any) {
    e.preventDefault();
    if (!canSubmit || busy) return;

    setBusy(true);
    setMsg(null);
    setErr(null);

    const payload = {
      items,
      customer: { fullName, email, phone },
      shipping: { addressLine1, city, country },
      createAccount,
      paymentMethod: paymentMethod === "CARD" ? "PAYTABS" : "COD",
      locale,
    };

    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data?.ok) {
      setBusy(false);
      setErr(data?.error || t(locale, "Checkout failed.", "فشل إتمام الطلب."));
      return;
    }

    const cartId = String(data.cartId || "");
    const amountJod = Number(data.amountJod || total);

    if (paymentMethod === "COD") {
      // clear local + server cart
      writeCart([]);
      setItems([]);
      await clearCartServerIfAuthed();
      setBusy(false);
      setMsg(t(locale, "Order placed successfully (Cash on Delivery).", "تم إنشاء الطلب بنجاح (الدفع عند الاستلام)."));
      return;
    }

    // Card: initiate PayTabs
    const pt = await fetch("/api/paytabs/initiate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cartId, amountJod }),
    });
    const ptData = await pt.json().catch(() => ({}));
    if (!pt.ok || !ptData?.ok || !ptData?.redirectUrl) {
      setBusy(false);
      setErr(ptData?.error || t(locale, "Payment init failed.", "فشل تهيئة الدفع."));
      return;
    }

    window.location.href = ptData.redirectUrl;
  }

  return (
    <div style={{ padding: "1.2rem 0", maxWidth: 980 }}>
      <h1 className="title">{t(locale, "Checkout", "الدفع")}</h1>

      {!items.length ? (
        <div className="panel">
          <p className="muted">{t(locale, "Your cart is empty.", "سلة التسوق فارغة.")}</p>
          <a className="btn" href={`/${locale}/product`}>
            {t(locale, "Back to shop", "العودة للمتجر")}
          </a>
        </div>
      ) : (
        <div className="grid2" style={{ alignItems: "start" }}>
          <div className="panel">
            <h3 style={{ marginTop: 0 }}>{t(locale, "Your items", "المنتجات")}</h3>

            <div style={{ display: "grid", gap: 10 }}>
              {items.map((i) => (
                <div key={i.slug} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center" }}>
                  <div>
                    <strong>{i.name}</strong>
                    <div className="muted" style={{ marginTop: 2 }}>
                      {i.priceJod.toFixed(2)} JOD
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      aria-label="qty"
                      type="number"
                      min={1}
                      value={i.qty}
                      onChange={(e) => updateQty(i.slug, Number(e.target.value))}
                      style={{ width: 80 }}
                    />
                    <button type="button" className="btn btn-outline" onClick={() => removeItem(i.slug)}>
                      {t(locale, "Remove", "حذف")}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <hr style={{ margin: "14px 0" }} />

            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted">{t(locale, "Subtotal", "المجموع الفرعي")}</span>
                <strong>{subtotal.toFixed(2)} JOD</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted">{t(locale, "Shipping", "التوصيل")}</span>
                <strong>{shipping.toFixed(2)} JOD</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted">{t(locale, "Total", "الإجمالي")}</span>
                <strong>{total.toFixed(2)} JOD</strong>
              </div>
            </div>
          </div>

          <form className="panel" onSubmit={submit}>
            <h3 style={{ marginTop: 0 }}>{t(locale, "Delivery details", "بيانات التوصيل")}</h3>

            <label>
              <span className="muted">{t(locale, "Full name *", "الاسم الكامل *")}</span>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </label>

            <label style={{ marginTop: 10 }}>
              <span className="muted">{t(locale, "Email *", "البريد الإلكتروني *")}</span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
            </label>

            <label style={{ marginTop: 10 }}>
              <span className="muted">{t(locale, "Phone *", "الهاتف *")}</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </label>

            <label style={{ marginTop: 10 }}>
              <span className="muted">{t(locale, "Address *", "العنوان *")}</span>
              <input value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} required />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
              <label>
                <span className="muted">{t(locale, "City", "المدينة")}</span>
                <input value={city} onChange={(e) => setCity(e.target.value)} />
              </label>
              <label>
                <span className="muted">{t(locale, "Country", "الدولة")}</span>
                <input value={country} onChange={(e) => setCountry(e.target.value)} />
              </label>
            </div>

            <label style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
              <input type="checkbox" checked={createAccount} onChange={(e) => setCreateAccount(e.target.checked)} />
              <span className="muted">
                {t(locale, "Create an account for me (recommended)", "إنشاء حساب لي (موصى به)")}
              </span>
            </label>

            <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
              <button
                type="button"
                className={"btn" + (paymentMethod === "CARD" ? "" : " btn-outline")}
                onClick={() => setPaymentMethod("CARD")}
              >
                {t(locale, "Pay by card", "الدفع بالبطاقة")}
              </button>
              <button
                type="button"
                className={"btn" + (paymentMethod === "COD" ? "" : " btn-outline")}
                onClick={() => setPaymentMethod("COD")}
              >
                {t(locale, "Cash on delivery", "الدفع عند الاستلام")}
              </button>
            </div>

            {err ? <p style={{ color: "crimson", marginTop: 10 }}>{err}</p> : null}
            {msg ? <p style={{ color: "green", marginTop: 10 }}>{msg}</p> : null}

            <button className={"btn" + (!canSubmit || busy ? " btn-disabled" : "")} disabled={!canSubmit || busy} style={{ marginTop: 12 }}>
              {busy ? t(locale, "Please wait…", "يرجى الانتظار…") : t(locale, "Place order", "تأكيد الطلب")}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
TSX

echo "==> Updating /api/orders to accept cart items + optional account creation"
cat > src/app/api/orders/route.ts <<'TS'
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureCatalogTables } from "@/lib/catalog";
import { ensureIdentityTables, getCustomerByEmail, createCustomer, createCustomerSession, createSessionToken, getCustomerIdFromRequest } from "@/lib/identity";
import { upsertCart } from "@/lib/cartStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function makeCartId() {
  return `NIVRAN-${Date.now()}`;
}

export async function POST(req: Request) {
  await ensureCatalogTables();
  await ensureIdentityTables();

  const body = await req.json().catch(() => ({}));

  const rawItems = Array.isArray(body?.items) ? body.items : [];
  const items = rawItems
    .map((i: any) => ({
      slug: String(i?.slug || "").trim(),
      qty: Math.max(1, Number(i?.qty || 1)),
    }))
    .filter((i: any) => i.slug);

  if (!items.length) {
    return NextResponse.json({ ok: false, error: "Cart is empty." }, { status: 400 });
  }

  const customer = body?.customer || {};
  const shipping = body?.shipping || {};
  const createAccount = !!body?.createAccount;
  const paymentMethod = String(body?.paymentMethod || "PAYTABS"); // PAYTABS | COD

  const fullName = String(customer?.fullName || "").trim();
  const email = String(customer?.email || "").trim().toLowerCase();
  const phone = String(customer?.phone || "").trim();

  const addressLine1 = String(shipping?.addressLine1 || "").trim();
  const city = String(shipping?.city || "").trim();
  const country = String(shipping?.country || "").trim() || "Jordan";

  if (!fullName || !email || !phone || !addressLine1) {
    return NextResponse.json(
      { ok: false, error: "Missing required fields (name, email, phone, address)." },
      { status: 400 }
    );
  }

  // Compute prices from DB (don’t trust client)
  const slugs = Array.from(new Set(items.map((i: any) => i.slug)));
  const pr = await db.query<{ slug: string; name_en: string; name_ar: string; price_jod: string }>(
    `select slug, name_en, name_ar, price_jod::text as price_jod
       from products
      where slug = any($1::text[]) and is_active=true`,
    [slugs]
  );

  const bySlug = new Map(pr.rows.map((p) => [p.slug, p]));
  const normalized = items.map((i: any) => {
    const p = bySlug.get(i.slug);
    if (!p) throw new Error(`Unknown product slug: ${i.slug}`);
    const price = Number(p.price_jod || 0);
    return {
      slug: i.slug,
      name: p.name_en || i.slug,
      priceJod: price,
      qty: i.qty,
      lineTotal: price * i.qty,
    };
  });

  const subtotal = normalized.reduce((s: number, x: any) => s + x.lineTotal, 0);
  const shippingJod = 3.5;
  const amountJod = subtotal + shippingJod;

  // Try to get existing logged-in customer id
  let customerId = await getCustomerIdFromRequest(req);

  // If not logged in and consent is checked, ONLY auto-create if email is not registered
  // (Never auto-login an existing email—security)
  let createdSessionToken: string | null = null;

  if (!customerId && createAccount) {
    const existing = await getCustomerByEmail(email);
    if (!existing) {
      const randomPassword = createSessionToken(); // strong random, user can reset later
      const created = await createCustomer({
        email,
        fullName,
        password: randomPassword,
        phone,
        addressLine1,
        city,
        country,
      });
      customerId = created.id;

      createdSessionToken = createSessionToken();
      await createCustomerSession(customerId, createdSessionToken);

      // persist cart server-side
      await upsertCart(customerId, normalized.map((x: any) => ({
        slug: x.slug, name: x.name, priceJod: x.priceJod, qty: x.qty
      })));
    }
  }

  const cartId = makeCartId();

  // Insert order (your DB likely already has items jsonb; keep this insert consistent with your existing handler)
  await db.query(
    `insert into orders
      (cart_id, status, amount_jod, currency, customer, shipping, payment_method, paytabs_ref, paytabs_status, customer_id)
     values
      ($1, $2, $3, 'JOD', $4::jsonb, $5::jsonb, $6, null, null, $7)`,
    [
      cartId,
      paymentMethod === "COD" ? "PENDING" : "PENDING_PAYMENT",
      amountJod,
      JSON.stringify({ fullName, email, phone }),
      JSON.stringify({ addressLine1, city, country, shippingJod }),
      paymentMethod,
      customerId,
    ]
  );

  const res = NextResponse.json({ ok: true, cartId, amountJod });

  if (createdSessionToken) {
    res.cookies.set("nivran_customer_session", createdSessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  return res;
}
TS

echo "==> Admin: add Customers page + nav link"
# Patch admin nav (simple overwrite for safety)
cat > src/app/admin/layout.tsx <<'TSX'
import "./admin.css";
import Link from "next/link";
import { RequireAdmin } from "./_components/RequireAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link className="admin-nav-link" href={href}>
      {label}
    </Link>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAdmin>
      <div className="admin-shell">
        <aside className="admin-nav">
          <div className="admin-brand">NIVRAN Admin</div>
          <nav style={{ display: "grid", gap: 6 }}>
            <NavLink href="/admin/orders" label="Orders" />
            <NavLink href="/admin/catalog" label="Catalog" />
            <NavLink href="/admin/customers" label="Customers" />
            <NavLink href="/admin/staff" label="Staff" />
          </nav>
        </aside>
        <main className="admin-main">{children}</main>
      </div>
    </RequireAdmin>
  );
}
TSX

cat > src/app/admin/customers/page.tsx <<'TSX'
import { db } from "@/lib/db";
import { ensureIdentityTables } from "@/lib/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = {
  id: number;
  email: string;
  full_name: string | null;
  phone: string | null;
  address_line1: string | null;
  city: string | null;
  country: string | null;
  created_at: string;
  orders_count: number;
  total_spent: string;
  last_order_at: string | null;
};

export default async function AdminCustomersPage() {
  await ensureIdentityTables();

  const r = await db.query<Row>(
    `
    select
      c.id,
      c.email,
      c.full_name,
      c.phone,
      c.address_line1,
      c.city,
      c.country,
      c.created_at::text as created_at,
      coalesce(o.orders_count, 0)::int as orders_count,
      coalesce(o.total_spent, 0)::text as total_spent,
      o.last_order_at::text as last_order_at
    from customers c
    left join (
      select
        customer_id,
        count(*) as orders_count,
        sum(amount_jod) as total_spent,
        max(created_at) as last_order_at
      from orders
      where customer_id is not null
      group by customer_id
    ) o on o.customer_id = c.id
    order by o.last_order_at desc nulls last, c.created_at desc
    limit 500
    `
  );

  return (
    <div>
      <h1 className="admin-title">Customers</h1>
      <p className="muted">Shows customer contact/location + purchase history summary.</p>

      <div style={{ overflowX: "auto" }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Email</th>
              <th>Name</th>
              <th>Phone</th>
              <th>Address</th>
              <th>Orders</th>
              <th>Total Spent</th>
              <th>Last Order</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {r.rows.map((x) => (
              <tr key={x.id}>
                <td>{x.id}</td>
                <td>{x.email}</td>
                <td>{x.full_name || "—"}</td>
                <td>{x.phone || "—"}</td>
                <td>
                  {[x.address_line1, x.city, x.country].filter(Boolean).join(", ") || "—"}
                </td>
                <td>{x.orders_count}</td>
                <td>{Number(x.total_spent || 0).toFixed(2)} JOD</td>
                <td>{x.last_order_at ? new Date(x.last_order_at).toLocaleString() : "—"}</td>
                <td>{new Date(x.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
TSX

echo "==> Done writing files."

echo "==> Running DB patch if possible (optional)"
if command -v psql >/dev/null 2>&1 && [[ -n "${DATABASE_URL:-}" ]]; then
  echo "psql detected + DATABASE_URL set — applying db/migrations/patches/006_account_checkout_patch.sql"
  psql "$DATABASE_URL" -f db/migrations/patches/006_account_checkout_patch.sql
else
  echo "Skipped DB patch auto-run."
  echo "To apply manually:"
  echo "  psql \"\$DATABASE_URL\" -f db/migrations/patches/006_account_checkout_patch.sql"
  echo "Or paste db/migrations/patches/006_account_checkout_patch.sql into Neon SQL Editor."
fi

echo "==> Next recommended commands:"
echo "  pnpm -v || npm -v"
echo "  pnpm install"
echo "  pnpm run build"
