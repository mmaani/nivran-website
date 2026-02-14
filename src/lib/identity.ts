// src/lib/identity.ts
import { db } from "@/lib/db";
import crypto from "crypto";

export type StaffRole = "admin" | "ops" | "staff";

/* =========================================================
   Password hashing (PBKDF2)
   Stored format (canonical):
   pbkdf2_sha512$120000$salt$hex
   (also tolerates double-$$ variants by filtering empty parts)
   ========================================================= */

function pbkdf2Hash(password: string, salt: string) {
  const iterations = 120_000;
  const keylen = 64;
  const digest = "sha512";
  const derived = crypto.pbkdf2Sync(password, salt, iterations, keylen, digest);
  return `pbkdf2_${digest}$${iterations}$${salt}$${derived.toString("hex")}`;
}

function parsePbkdf2(stored: string): null | {
  digest: string;
  iterations: number;
  salt: string;
  hex: string;
  keylen: number;
} {
  if (!stored || !stored.startsWith("pbkdf2_")) return null;

  // tolerate strings with accidental double-$$ by removing empty parts
  const parts = stored.split("$").filter(Boolean);
  // expected: [ "pbkdf2_sha512", "120000", "salt", "hex" ]
  if (parts.length !== 4) return null;

  const [tag, iterStr, salt, hex] = parts;
  const digest = tag.slice("pbkdf2_".length);
  const iterations = Number(iterStr);

  if (!digest || !Number.isFinite(iterations) || iterations <= 0) return null;
  if (!salt || !hex) return null;

  return { digest, iterations, salt, hex, keylen: 64 };
}

function pbkdf2Verify(password: string, stored: string) {
  const parsed = parsePbkdf2(stored);
  if (!parsed) return false;

  const derived = crypto.pbkdf2Sync(
    password,
    parsed.salt,
    parsed.iterations,
    parsed.keylen,
    parsed.digest as any
  );

  const a = Buffer.from(parsed.hex, "hex");
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

/* =========================================================
   Staff tables (migration-safe)
   ========================================================= */

export async function ensureIdentityTables() {
  // 1) Create minimal tables (won’t fail if old schema exists)
  await db.query(`
    create table if not exists staff_users (
      id bigserial primary key
    );

    create table if not exists password_reset_tokens (
      id bigserial primary key
    );
  `);

  // 2) Add missing columns (safe migrations)
  await db.query(`alter table staff_users add column if not exists email text;`);
  await db.query(`alter table staff_users add column if not exists full_name text;`);
  await db.query(`alter table staff_users add column if not exists role text not null default 'staff';`);
  await db.query(`alter table staff_users add column if not exists password_hash text;`);
  await db.query(`alter table staff_users add column if not exists is_active boolean not null default true;`);
  await db.query(`alter table staff_users add column if not exists created_at timestamptz not null default now();`);
  await db.query(`alter table staff_users add column if not exists updated_at timestamptz not null default now();`);

  // Ensure password_hash has something (avoid nulls breaking login code)
  await db.query(`update staff_users set password_hash='' where password_hash is null;`);
  await db.query(`update staff_users set email=lower(email) where email is not null;`);

  await db.query(`alter table password_reset_tokens add column if not exists staff_user_id bigint;`);
  await db.query(`alter table password_reset_tokens add column if not exists token_hash text;`);
  await db.query(`alter table password_reset_tokens add column if not exists expires_at timestamptz;`);
  await db.query(`alter table password_reset_tokens add column if not exists used_at timestamptz;`);
  await db.query(`alter table password_reset_tokens add column if not exists created_at timestamptz not null default now();`);

  // 3) Indexes last (prevents "column does not exist" failures)
  await db.query(`create unique index if not exists ux_staff_users_email on staff_users(email);`);
  await db.query(`create index if not exists idx_staff_users_active on staff_users(is_active);`);

  await db.query(`create index if not exists idx_password_reset_tokens_staff on password_reset_tokens(staff_user_id);`);
  await db.query(`create index if not exists idx_password_reset_tokens_expires on password_reset_tokens(expires_at);`);
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

  if (!email || !email.includes("@")) throw new Error("Invalid email");
  if (!params.password || params.password.trim().length < 6) throw new Error("Password too short");

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

  return rows[0]?.id ?? null;
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

/* =========================================================
   ✅ Admin staff helpers (fix TS imports)
   ========================================================= */

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
  password?: string | null; // optional: if omitted, keep existing hash (only if user exists)
  isActive?: boolean;
}): Promise<number> {
  await ensureIdentityTables();

  const email = String(input.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) throw new Error("Invalid email");

  const fullName = input.fullName?.trim() || null;
  const role = (input.role || "staff") as StaffRole;
  const isActive = input.isActive ?? true;
  const password = String(input.password ?? "").trim();
  const passwordHash = password ? hashPassword(password) : null;

  const existing = await db.query<{ id: number; password_hash: string }>(
    `select id, password_hash from staff_users where email=$1 limit 1`,
    [email]
  );

  if (existing.rows.length === 0) {
    if (!passwordHash) throw new Error("Password required for new staff user");
    const ins = await db.query<{ id: number }>(
      `insert into staff_users (email, full_name, role, password_hash, is_active)
       values ($1,$2,$3,$4,$5)
       returning id`,
      [email, fullName, role, passwordHash, isActive]
    );
    return ins.rows[0].id;
  }

  const id = existing.rows[0].id;

  await db.query(
    `update staff_users
     set full_name=$2,
         role=$3,
         is_active=$5,
         password_hash=case when $4 is null then password_hash else $4 end,
         updated_at=now()
     where id=$1`,
    [id, fullName, role, passwordHash, isActive]
  );

  return id;
}

/* =========================================================
   ✅ Customer sessions (fix Vercel build errors)
   - createSessionToken
   - getCustomerIdFromRequest
   ========================================================= */

async function ensureCustomerAuthTables() {
  await db.query(`
    create table if not exists customers (
      id bigserial primary key
    );

    create table if not exists customer_sessions (
      id bigserial primary key
    );
  `);

  await db.query(`alter table customers add column if not exists email text;`);
  await db.query(`alter table customers add column if not exists full_name text;`);
  await db.query(`alter table customers add column if not exists password_hash text;`);
  await db.query(`alter table customers add column if not exists is_active boolean not null default true;`);
  await db.query(`alter table customers add column if not exists created_at timestamptz not null default now();`);
  await db.query(`alter table customers add column if not exists updated_at timestamptz not null default now();`);

  await db.query(`alter table customer_sessions add column if not exists customer_id bigint;`);
  await db.query(`alter table customer_sessions add column if not exists token_hash text;`);
  await db.query(`alter table customer_sessions add column if not exists expires_at timestamptz;`);
  await db.query(`alter table customer_sessions add column if not exists revoked_at timestamptz;`);
  await db.query(`alter table customer_sessions add column if not exists created_at timestamptz not null default now();`);

  await db.query(`create unique index if not exists ux_customers_email on customers(email);`);
  await db.query(`create unique index if not exists ux_customer_sessions_token_hash on customer_sessions(token_hash);`);
  await db.query(`create index if not exists idx_customer_sessions_customer on customer_sessions(customer_id);`);
  await db.query(`create index if not exists idx_customer_sessions_expires on customer_sessions(expires_at);`);
}

function sha256Hex(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

/**
 * createSessionToken(customerId[, ttlHours])
 * createSessionToken({ customerId, ttlHours })
 */
export async function createSessionToken(
  a: number | { customerId: number; ttlHours?: number },
  ttlHoursMaybe?: number
): Promise<string> {
  await ensureCustomerAuthTables();

  const customerId = typeof a === "number" ? a : a.customerId;
  const ttlHours = typeof a === "number" ? (ttlHoursMaybe ?? 24 * 30) : (a.ttlHours ?? 24 * 30);

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256Hex(token);
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

  await db.query(
    `insert into customer_sessions (customer_id, token_hash, expires_at)
     values ($1,$2,$3)`,
    [customerId, tokenHash, expiresAt.toISOString()]
  );

  return token;
}

function getCookieValue(cookieHeader: string, name: string): string | null {
  const parts = cookieHeader.split(";").map((p) => p.trim());
  for (const p of parts) {
    if (!p) continue;
    const eq = p.indexOf("=");
    if (eq === -1) continue;
    const k = p.slice(0, eq).trim();
    if (k === name) return decodeURIComponent(p.slice(eq + 1));
  }
  return null;
}

function extractSessionTokenFromRequest(req: Request): string | null {
  // 1) Authorization: Bearer <token>
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^\s*Bearer\s+(.+)\s*$/i);
  if (m?.[1]) return m[1].trim();

  // 2) Cookies
  const cookie = req.headers.get("cookie") || "";
  if (!cookie) return null;

  // Support multiple names (pick whatever your routes already use)
  const names = [
    "nivran_session",
    "nivran_session_token",
    "customer_session",
    "session_token",
    "session",
  ];

  for (const n of names) {
    const v = getCookieValue(cookie, n);
    if (v) return v;
  }
  return null;
}

/**
 * Reads session token from Authorization Bearer or cookie,
 * validates against DB, returns customer_id or null.
 */
export async function getCustomerIdFromRequest(req: Request): Promise<number | null> {
  await ensureCustomerAuthTables();

  const token = extractSessionTokenFromRequest(req);
  if (!token) return null;

  const tokenHash = sha256Hex(token);

  const { rows } = await db.query<{ customer_id: number }>(
    `select customer_id
     from customer_sessions
     where token_hash=$1
       and revoked_at is null
       and expires_at > now()
     limit 1`,
    [tokenHash]
  );

  return rows[0]?.customer_id ?? null;
}
