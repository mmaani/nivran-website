// src/app/api/auth/login/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, createSessionToken } from "@/lib/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CustomerRow = {
  id: number;
  email: string;
  password_hash: string;
  is_active: boolean;
};

function sha256Hex(s: string) {
  // If you already have this in identity.ts, it’s okay to duplicate here.
  const crypto = require("crypto") as typeof import("crypto");
  return crypto.createHash("sha256").update(s).digest("hex");
}

async function ensureCustomerAuthTables() {
  // Minimal tables + safe migrations
  await db.query(`
    create table if not exists customers (
      id bigserial primary key
    );

    create table if not exists customer_sessions (
      id bigserial primary key
    );
  `);

  await db.query(`alter table customers add column if not exists email text;`);
  await db.query(`alter table customers add column if not exists password_hash text;`);
  await db.query(`alter table customers add column if not exists is_active boolean not null default true;`);

  // Sessions (support both schemas: token_hash or token)
  await db.query(`alter table customer_sessions add column if not exists customer_id bigint;`);
  await db.query(`alter table customer_sessions add column if not exists created_at timestamptz not null default now();`);
  await db.query(`alter table customer_sessions add column if not exists expires_at timestamptz;`);
  await db.query(`alter table customer_sessions add column if not exists revoked_at timestamptz;`);
  await db.query(`alter table customer_sessions add column if not exists token_hash text;`);
  await db.query(`alter table customer_sessions add column if not exists token text;`);

  await db.query(`create unique index if not exists ux_customers_email on customers(email);`);
  // Indexes for whichever token column you use
  await db.query(`create index if not exists idx_customer_sessions_customer on customer_sessions(customer_id);`);
  await db.query(`create index if not exists idx_customer_sessions_expires on customer_sessions(expires_at);`);
}

async function hasColumn(table: string, column: string): Promise<boolean> {
  const r = await db.query(
    `select 1
     from information_schema.columns
     where table_name=$1 and column_name=$2
     limit 1`,
    [table, column]
  );
  return (r.rowCount ?? 0) > 0;
}

export async function POST(req: Request): Promise<Response> {
  await ensureCustomerAuthTables();

  const ct = req.headers.get("content-type") || "";
  const isForm =
    ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data");

  const body = isForm
    ? Object.fromEntries((await req.formData()).entries())
    : await req.json().catch(() => ({}));

  const email = String((body as any)?.email || "").trim().toLowerCase();
  const password = String((body as any)?.password || "");

  if (!email || !email.includes("@") || !password) {
    return NextResponse.json(
      { ok: false, error: "Invalid credentials" },
      { status: 400 }
    );
  }

  const { rows } = await db.query<CustomerRow>(
    `select id, email, password_hash, is_active
     from customers
     where email=$1
     limit 1`,
    [email]
  );

  const c = rows[0];
  if (!c || !c.is_active || !verifyPassword(password, c.password_hash || "")) {
    return NextResponse.json(
      { ok: false, error: "Invalid credentials" },
      { status: 401 }
    );
  }

  // ✅ Fix: createSessionToken requires customerId (and optional ttl)
  const token = await createSessionToken(c.id);

  // Store session in DB (support both schemas)
  const hasTokenHash = await hasColumn("customer_sessions", "token_hash");
  const hasToken = await hasColumn("customer_sessions", "token");

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  if (hasTokenHash) {
    const tokenHash = sha256Hex(token);
    await db.query(
      `insert into customer_sessions (customer_id, token_hash, expires_at)
       values ($1,$2,$3)`,
      [c.id, tokenHash, expiresAt]
    );
  } else if (hasToken) {
    // less secure, but keeps compatibility if your table is old
    await db.query(
      `insert into customer_sessions (customer_id, token, expires_at)
       values ($1,$2,$3)`,
      [c.id, token, expiresAt]
    );
  } else {
    // fallback: create token_hash column automatically if neither exists (very rare)
    await db.query(`alter table customer_sessions add column if not exists token_hash text;`);
    const tokenHash = sha256Hex(token);
    await db.query(
      `insert into customer_sessions (customer_id, token_hash, expires_at)
       values ($1,$2,$3)`,
      [c.id, tokenHash, expiresAt]
    );
  }

  const res = NextResponse.json({ ok: true });

  // Cookie name matches what getCustomerIdFromRequest() supports
  res.cookies.set("nivran_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return res;
}
