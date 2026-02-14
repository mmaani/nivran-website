// src/lib/identity.ts
import { db } from "@/lib/db";
import crypto from "crypto";

export type StaffRole = "admin" | "ops" | "staff";

const PBKDF2_ITERATIONS = 120_000;
const PBKDF2_KEYLEN = 64;
const PBKDF2_DIGEST = "sha512";

export const CUSTOMER_SESSION_COOKIE = "nivran_session";

/* =======================
   Password hashing
======================= */
function pbkdf2Hash(password: string, salt: string) {
  const derived = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST);
  return `pbkdf2_${PBKDF2_DIGEST}$${PBKDF2_ITERATIONS}$${salt}$${derived.toString("hex")}`;
}

function pbkdf2Verify(password: string, stored: string) {
  if (!stored.startsWith("pbkdf2_")) return false;
  const parts = stored.split("$");
  // pbkdf2_sha512$$120000$$salt$$hex
  if (parts.length < 5) return false;

  const alg = parts[0].slice("pbkdf2_".length);
  const iterations = Number(parts[2]);
  const salt = parts[3];
  const hex = parts[4];
  if (!alg || !iterations || !salt || !hex) return false;

  const derived = crypto.pbkdf2Sync(password, salt, iterations, PBKDF2_KEYLEN, alg as any);
  const a = Buffer.from(hex, "hex");
  const b = derived;
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  return pbkdf2Hash(password, salt);
}

export function verifyPassword(password: string, storedHash: string) {
  return pbkdf2Verify(password, storedHash);
}

/* =======================
   Staff tables
======================= */
export async function ensureIdentityTables() {
  await db.query(`
    create table if not exists staff_users (
      id bigserial primary key,
      email text not null unique,
      full_name text,
      role text not null default 'staff',
      password_hash text not null,
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists password_reset_tokens (
      id bigserial primary key,
      staff_user_id bigint not null references staff_users(id) on delete cascade,
      token_hash text not null,
      expires_at timestamptz not null,
      used_at timestamptz,
      created_at timestamptz not null default now()
    );
  `);

  // Safe migrations
  await db.query(`alter table staff_users add column if not exists full_name text;`);
  await db.query(`alter table staff_users add column if not exists role text not null default 'staff';`);
  await db.query(`alter table staff_users add column if not exists is_active boolean not null default true;`);
  await db.query(`alter table staff_users add column if not exists created_at timestamptz not null default now();`);
  await db.query(`alter table staff_users add column if not exists updated_at timestamptz not null default now();`);

  await db.query(`create index if not exists idx_staff_users_active on staff_users(is_active);`);
  await db.query(`create index if not exists idx_password_reset_tokens_staff on password_reset_tokens(staff_user_id);`);
  await db.query(`create index if not exists idx_password_reset_tokens_expires on password_reset_tokens(expires_at);`);
}

export async function getStaffByEmail(email: string) {
  await ensureIdentityTables();
  const { rows } = await db.query<{
    id: number;
    email: string;
    full_name: string | null;
    role: string;
    password_hash: string;
    is_active: boolean;
  }>(
    `select id, email, full_name, role, password_hash, is_active
     from staff_users
     where email=$1
     limit 1`,
    [email.trim().toLowerCase()]
  );
  return rows[0] || null;
}

export async function createStaffUser(params: {
  email: string;
  fullName?: string | null;
  role?: StaffRole;
  password: string;
  isActive?: boolean;
}) {
  await ensureIdentityTables();
  const email = params.email.trim().toLowerCase();
  const fullName = params.fullName?.trim() || null;
  const role = params.role || "staff";
  const isActive = params.isActive ?? true;
  const passwordHash = hashPassword(params.password);

  const { rows } = await db.query<{ id: number }>(
    `insert into staff_users (email, full_name, role, password_hash, is_active)
     values ($1,$2,$3,$4,$5)
     on conflict (email) do update
       set full_name=excluded.full_name,
           role=excluded.role,
           is_active=excluded.is_active,
           password_hash=excluded.password_hash,
           updated_at=now()
     returning id`,
    [email, fullName, role, passwordHash, isActive]
  );

  return rows[0]?.id;
}

export async function createPasswordResetToken(staffUserId: number) {
  await ensureIdentityTables();
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30 minutes

  await db.query(
    `insert into password_reset_tokens (staff_user_id, token_hash, expires_at)
     values ($1,$2,$3)`,
    [staffUserId, tokenHash, expiresAt.toISOString()]
  );

  return token;
}

export async function usePasswordResetToken(token: string) {
  await ensureIdentityTables();
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const { rows } = await db.query<{ id: number; staff_user_id: number }>(
    `select id, staff_user_id
     from password_reset_tokens
     where token_hash=$1
       and used_at is null
       and expires_at > now()
     limit 1`,
    [tokenHash]
  );

  const row = rows[0];
  if (!row) return null;

  await db.query(`update password_reset_tokens set used_at=now() where id=$1`, [row.id]);
  return row.staff_user_id;
}

export type StaffListRow = {
  id: number;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export async function listStaff(opts?: { limit?: number }): Promise<StaffListRow[]> {
  await ensureIdentityTables();
  const limit = Math.max(1, Math.min(500, Number(opts?.limit ?? 200) || 200));

  const { rows } = await db.query<StaffListRow>(
    `select id,
            email,
            full_name,
            role,
            is_active,
            created_at::text,
            updated_at::text
     from staff_users
     order by created_at desc
     limit $1`,
    [limit]
  );

  return rows;
}

export async function upsertStaff(input: {
  email: string;
  fullName?: string | null;
  role?: StaffRole;
  password?: string | null; // optional: if omitted, keep existing hash
  isActive?: boolean;
}) {
  await ensureIdentityTables();

  const email = String(input.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) throw new Error("Invalid email");

  const fullName = input.fullName?.trim() || null;
  const role = (input.role || "staff") as StaffRole;
  const isActive = input.isActive ?? true;

  const password = (input.password ?? "").trim();
  const passwordHash = password ? hashPassword(password) : null;

  // Ensure there is always a password_hash on insert; on update, keep if password not provided.
  const insertHash = passwordHash || hashPassword(crypto.randomBytes(12).toString("hex"));

  await db.query(
    `insert into staff_users (email, full_name, role, password_hash, is_active)
     values ($1,$2,$3,$4,$5)
     on conflict (email) do update
       set full_name=excluded.full_name,
           role=excluded.role,
           is_active=excluded.is_active,
           password_hash=case
             when $6::text is null then staff_users.password_hash
             else $6::text
           end,
           updated_at=now()`,
    [email, fullName, role, insertHash, isActive, passwordHash]
  );
}

/* =======================
   Customer auth tables
======================= */
let _hasCustomerSessionsTokenHash: boolean | null = null;
let _hasCustomerSessionsToken: boolean | null = null;

async function detectCustomerSessionColumns() {
  if (_hasCustomerSessionsTokenHash !== null && _hasCustomerSessionsToken !== null) return;
  const { rows } = await db.query<{ column_name: string }>(
    `select column_name
     from information_schema.columns
     where table_name='customer_sessions'`
  );
  const cols = new Set(rows.map((r) => r.column_name));
  _hasCustomerSessionsTokenHash = cols.has("token_hash");
  _hasCustomerSessionsToken = cols.has("token");
}

export async function ensureCustomerTables() {
  await db.query(`
    create table if not exists customers (
      id bigserial primary key,
      email text not null unique,
      full_name text,
      password_hash text not null,
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists customer_sessions (
      id bigserial primary key,
      customer_id bigint not null references customers(id) on delete cascade,
      token_hash text,
      token text,
      expires_at timestamptz not null,
      created_at timestamptz not null default now()
    );
  `);

  // Safe migrations (older schemas)
  await db.query(`alter table customers add column if not exists full_name text;`);
  await db.query(`alter table customers add column if not exists is_active boolean not null default true;`);
  await db.query(`alter table customers add column if not exists created_at timestamptz not null default now();`);
  await db.query(`alter table customers add column if not exists updated_at timestamptz not null default now();`);

  await db.query(`alter table customer_sessions add column if not exists token_hash text;`);
  await db.query(`alter table customer_sessions add column if not exists token text;`);
  await db.query(`alter table customer_sessions add column if not exists expires_at timestamptz not null default (now() + interval '30 days');`);
  await db.query(`alter table customer_sessions add column if not exists created_at timestamptz not null default now();`);

  await db.query(`create index if not exists idx_customers_active on customers(is_active);`);
  await db.query(`create index if not exists idx_customer_sessions_customer on customer_sessions(customer_id);`);
  await db.query(`create index if not exists idx_customer_sessions_expires on customer_sessions(expires_at);`);
  // unique indexes only if columns exist (they do after alter)
  await db.query(`create unique index if not exists uq_customer_sessions_token_hash on customer_sessions(token_hash) where token_hash is not null;`);
  await db.query(`create unique index if not exists uq_customer_sessions_token on customer_sessions(token) where token is not null;`);

  // refresh cached detection
  _hasCustomerSessionsTokenHash = null;
  _hasCustomerSessionsToken = null;
  await detectCustomerSessionColumns();
}

export async function getCustomerByEmail(email: string) {
  await ensureCustomerTables();
  const e = email.trim().toLowerCase();
  const { rows } = await db.query<{
    id: number;
    email: string;
    full_name: string | null;
    password_hash: string;
    is_active: boolean;
  }>(
    `select id, email, full_name, password_hash, is_active
     from customers
     where email=$1
     limit 1`,
    [e]
  );
  return rows[0] || null;
}

export async function createCustomer(params: { email: string; fullName?: string | null; password: string }) {
  await ensureCustomerTables();

  const email = params.email.trim().toLowerCase();
  if (!email || !email.includes("@")) throw new Error("Invalid email");

  const fullName = params.fullName?.trim() || null;
  const passwordHash = hashPassword(params.password);

  const { rows } = await db.query<{ id: number }>(
    `insert into customers (email, full_name, password_hash, is_active)
     values ($1,$2,$3,true)
     on conflict (email) do nothing
     returning id`,
    [email, fullName, passwordHash]
  );

  return rows[0]?.id ?? null;
}

/**
 * Creates a session token for a customer.
 * Returns the *raw* token (stored as sha256 hash if token_hash column exists).
 */
export async function createSessionToken(customerId: number, opts?: { days?: number }): Promise<string> {
  await ensureCustomerTables();

  const days = Number(opts?.days ?? 30);
  const expiresAt = new Date(Date.now() + Math.max(1, days) * 24 * 60 * 60 * 1000);

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  await detectCustomerSessionColumns();
  const hasHash = !!_hasCustomerSessionsTokenHash;
  const hasToken = !!_hasCustomerSessionsToken;

  if (hasHash && hasToken) {
    await db.query(
      `insert into customer_sessions (customer_id, token_hash, token, expires_at)
       values ($1,$2,$3,$4)`,
      [customerId, tokenHash, token, expiresAt.toISOString()]
    );
  } else if (hasHash) {
    await db.query(
      `insert into customer_sessions (customer_id, token_hash, expires_at)
       values ($1,$2,$3)`,
      [customerId, tokenHash, expiresAt.toISOString()]
    );
  } else if (hasToken) {
    await db.query(
      `insert into customer_sessions (customer_id, token, expires_at)
       values ($1,$2,$3)`,
      [customerId, token, expiresAt.toISOString()]
    );
  } else {
    // extremely unlikely after migrations, but keep safe:
    await db.query(
      `insert into customer_sessions (customer_id, token_hash, expires_at)
       values ($1,$2,$3)`,
      [customerId, tokenHash, expiresAt.toISOString()]
    );
  }

  return token;
}

/**
 * Extract customerId from request (cookie or Authorization Bearer).
 */
export async function getCustomerIdFromRequest(req: Request): Promise<number | null> {
  await ensureCustomerTables();

  const auth = req.headers.get("authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";

  const cookieHeader = req.headers.get("cookie") || "";
  let cookieToken = "";
  for (const part of cookieHeader.split(";")) {
    const p = part.trim();
    if (p.toLowerCase().startsWith(CUSTOMER_SESSION_COOKIE.toLowerCase() + "=")) {
      cookieToken = decodeURIComponent(p.slice(CUSTOMER_SESSION_COOKIE.length + 1));
      break;
    }
  }

  const token = bearer || cookieToken;
  if (!token) return null;

  await detectCustomerSessionColumns();
  const hasHash = !!_hasCustomerSessionsTokenHash;
  const hasToken = !!_hasCustomerSessionsToken;

  if (hasHash) {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const { rows } = await db.query<{ customer_id: number }>(
      `select customer_id
       from customer_sessions
       where token_hash=$1
         and expires_at > now()
       limit 1`,
      [tokenHash]
    );
    return rows[0]?.customer_id ?? null;
  }

  if (hasToken) {
    const { rows } = await db.query<{ customer_id: number }>(
      `select customer_id
       from customer_sessions
       where token=$1
         and expires_at > now()
       limit 1`,
      [token]
    );
    return rows[0]?.customer_id ?? null;
  }

  return null;
}
