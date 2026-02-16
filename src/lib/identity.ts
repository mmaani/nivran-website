import crypto from "crypto";
import { db } from "@/lib/db";
import { hasColumn } from "@/lib/dbSchema";

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
 * - Supports bcrypt hashes if your old DB already stored them
 * - Also supports PBKDF2 fallback hashes: pbkdf2$iter$saltB64$hashB64
 */
async function tryBcrypt() {
  try {
    return await import("bcryptjs");
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  const pwd = String(password || "");
  const b = await tryBcrypt();
  if (b) return b.hashSync(pwd, 10);

  // PBKDF2 fallback
  const iter = 150_000;
  const salt = crypto.randomBytes(16);
  const key = crypto.pbkdf2Sync(pwd, salt, iter, 32, "sha256");
  return `pbkdf2$${iter}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const pwd = String(password || "");
  const h = String(stored || "");

  // bcrypt format
  if (/^\$2[aby]\$/.test(h)) {
    const b = await tryBcrypt();
    if (!b) return false;
    return b.compareSync(pwd, h);
  }

  // pbkdf2 format
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

  await db.query(`alter table customer_sessions add column if not exists token text`);
  await db.query(`alter table customer_sessions add column if not exists token_hash text`);
  await db.query(`alter table customer_sessions add column if not exists expires_at timestamptz`);
  await db.query(`alter table customer_sessions add column if not exists revoked_at timestamptz`);
  await db.query(`update customer_sessions set expires_at = now() + interval '30 days' where expires_at is null`);

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
      full_name text,
      role text not null default 'admin',
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);

  // Backwards-compatible migrations (safe to run repeatedly)
  await db.query(`
    do $$
    begin
      if exists (
        select 1 from information_schema.columns
        where table_schema='public' and table_name='staff_users' and column_name='email'
      ) and not exists (
        select 1 from information_schema.columns
        where table_schema='public' and table_name='staff_users' and column_name='username'
      ) then
        alter table staff_users rename column email to username;
      end if;
    end $$;
  `);

  await db.query(`alter table staff_users add column if not exists full_name text;`);
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

  const hasFullName = await hasColumn("customers", "full_name");
  const hasAddressLine1 = await hasColumn("customers", "address_line1");
  const hasCity = await hasColumn("customers", "city");
  const hasCountry = await hasColumn("customers", "country");

  const r = await db.query<CustomerRow>(
    `select id, email, password_hash,
            ${hasFullName ? "full_name" : "trim(concat_ws(' ', first_name, last_name))"} as full_name,
            phone,
            ${hasAddressLine1 ? "address_line1" : "null::text"} as address_line1,
            ${hasCity ? "city" : "null::text"} as city,
            ${hasCountry ? "country" : "null::text"} as country,
            is_active, created_at::text as created_at
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

  const passwordHash = await hashPassword(args.password);

  const hasFullName = await hasColumn("customers", "full_name");
  const hasAddressLine1 = await hasColumn("customers", "address_line1");
  const hasCity = await hasColumn("customers", "city");
  const hasCountry = await hasColumn("customers", "country");

  const r = await db.query<{ id: number; email: string }>(
    `insert into customers (
        email,
        password_hash,
        ${hasFullName ? "full_name" : "first_name, last_name"},
        phone,
        ${hasAddressLine1 ? "address_line1," : ""}
        ${hasCity ? "city," : ""}
        ${hasCountry ? "country," : ""}
        is_active
      )
     values (
       $1,$2,
       ${hasFullName ? "$3" : "$3, null"},
       $4,
       ${hasAddressLine1 ? "$5," : ""}
       ${hasCity ? "$6," : ""}
       ${hasCountry ? "$7," : ""}
       true
     )
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
  const hasTokenHash = await hasColumn("customer_sessions", "token_hash");
  if (hasTokenHash) {
    await db.query(
      `insert into customer_sessions (customer_id, token, token_hash, expires_at)
       values ($1,$2,$3,$4)`,
      [customerId, token, tokenHash, expiresAt]
    );
    return;
  }

  await db.query(
    `insert into customer_sessions (customer_id, token, expires_at)
     values ($1,$2,$3)`,
    [customerId, token, expiresAt]
  );
}

function readCookie(cookieHeader: string, name: string) {
  const parts = cookieHeader.split(";").map((p) => p.trim());
  for (const p of parts) {
    if (p.toLowerCase().startsWith(name.toLowerCase() + "=")) {
      return decodeURIComponent(p.slice(name.length + 1));
    }
  }
  return "";
}

export async function getCustomerIdFromRequest(req: Request): Promise<number | null> {
  await ensureIdentityTables();
  const cookie = req.headers.get("cookie") || "";
  const token = readCookie(cookie, CUSTOMER_SESSION_COOKIE);
  if (!token) return null;

  const tokenHash = sha256Hex(token);
  const hasTokenHash = await hasColumn("customer_sessions", "token_hash");
  const r = hasTokenHash
    ? await db.query<{ customer_id: number }>(
        `select customer_id
           from customer_sessions
          where (token_hash=$1 or token=$2)
            and revoked_at is null
            and expires_at > now()
          limit 1`,
        [tokenHash, token]
      )
    : await db.query<{ customer_id: number }>(
        `select customer_id
           from customer_sessions
          where token=$1
            and revoked_at is null
            and expires_at > now()
          limit 1`,
        [token]
      );
  return r.rows[0]?.customer_id ?? null;
}

/** Staff */
export type StaffUser = {
  id: number;
  username: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export async function listStaffUsers(): Promise<StaffUser[]> {
  await ensureIdentityTables();

  const hasUsername = await hasColumn("staff_users", "username");
  const r = await db.query<StaffUser>(
    `select id,
            ${hasUsername ? "username" : "email"} as username,
            full_name, role, is_active,
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
  full_name?: string | null;
  password?: string;
  role: string;
  is_active: boolean;
}) {
  await ensureIdentityTables();

  const username = String(args.username || "").trim().toLowerCase();
  const fullName =
    args.full_name === undefined
      ? null
      : args.full_name === null
        ? null
        : String(args.full_name || "").trim() || null;

  const role = String(args.role || "admin").trim();
  const isActive = !!args.is_active;
  const hasUsername = await hasColumn("staff_users", "username");
  const loginColumn = hasUsername ? "username" : "email";

  if (!username) throw new Error("Missing username");

  if (args.id) {
    if (args.password) {
      const ph = await hashPassword(args.password);
      await db.query(
        `update staff_users
            set ${loginColumn}=$1, full_name=$2, role=$3, is_active=$4, password_hash=$5, updated_at=now()
          where id=$6`,
        [username, fullName, role, isActive, ph, args.id]
      );
    } else {
      await db.query(
        `update staff_users
            set ${loginColumn}=$1, full_name=$2, role=$3, is_active=$4, updated_at=now()
          where id=$5`,
        [username, fullName, role, isActive, args.id]
      );
    }
    return;
  }

  if (!args.password) throw new Error("Password required for new staff user");
  const ph = await hashPassword(args.password);

  await db.query(
    `insert into staff_users (${loginColumn}, password_hash, full_name, role, is_active)
     values ($1,$2,$3,$4,$5)
     on conflict (${loginColumn}) do update
        set password_hash=excluded.password_hash,
            full_name=excluded.full_name,
            role=excluded.role,
            is_active=excluded.is_active,
            updated_at=now()`,
    [username, ph, fullName, role, isActive]
  );
}

export { listStaffUsers as listStaff, upsertStaffUser as upsertStaff };
