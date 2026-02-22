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
async function tryBcrypt(): Promise<(typeof import("bcryptjs")) | null> {
  try {
    const m = await import("bcryptjs");
    return m;
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
export async function ensureIdentityTables(): Promise<void> {
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

  // Email verification flag
  await db.query(`alter table customers add column if not exists email_verified_at timestamptz`);

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

  // Bring legacy schemas forward before adding indexes.
  await db.query(`alter table customer_sessions add column if not exists token text`);
  await db.query(`alter table customer_sessions add column if not exists token_hash text`);
  await db.query(`alter table customer_sessions add column if not exists expires_at timestamptz`);
  await db.query(`alter table customer_sessions add column if not exists revoked_at timestamptz`);
  await db.query(`update customer_sessions set expires_at = now() + interval '30 days' where expires_at is null`);

  await db.query(`create index if not exists customer_sessions_token_hash_idx on customer_sessions(token_hash);`);

  await db.query(`
    create table if not exists customer_password_reset_tokens (
      id bigserial primary key,
      customer_id bigint not null references customers(id) on delete cascade,
      token text not null,
      expires_at timestamptz not null,
      used_at timestamptz,
      created_at timestamptz not null default now()
    );
  `);
  await db.query(`create index if not exists customer_password_reset_tokens_token_idx on customer_password_reset_tokens(token);`);
  await db.query(`create index if not exists customer_password_reset_tokens_customer_idx on customer_password_reset_tokens(customer_id);`);

  /**
   * Email verification codes
   * Support BOTH schemas:
   * - legacy: code NOT NULL (plain)
   * - new: code_hash + salt (preferred)
   */
  await db.query(`
    create table if not exists customer_email_verification_codes (
      id bigserial primary key,
      customer_id bigint not null references customers(id) on delete cascade,
      code text,
      expires_at timestamptz not null,
      used_at timestamptz,
      attempts int not null default 0,
      created_at timestamptz not null default now(),
      code_hash text,
      salt text
    );
  `);

  // Ensure columns exist (older DBs)
  await db.query(`alter table customer_email_verification_codes add column if not exists code text`);
  await db.query(`alter table customer_email_verification_codes add column if not exists code_hash text`);
  await db.query(`alter table customer_email_verification_codes add column if not exists salt text`);
  await db.query(`alter table customer_email_verification_codes add column if not exists used_at timestamptz`);
  await db.query(`alter table customer_email_verification_codes add column if not exists attempts int`);
  await db.query(`update customer_email_verification_codes set attempts = 0 where attempts is null`);

  // Fix: some legacy schemas had `code` NOT NULL (your Vercel error). Make it nullable.
  await db.query(`
    do $$
    begin
      if exists (
        select 1
          from information_schema.columns
         where table_schema='public'
           and table_name='customer_email_verification_codes'
           and column_name='code'
      ) then
        begin
          alter table customer_email_verification_codes alter column code drop not null;
        exception when others then
          null;
        end;
      end if;
    end $$;
  `);

  await db.query(`create index if not exists customer_email_verification_codes_customer_idx on customer_email_verification_codes(customer_id);`);
  await db.query(`create index if not exists customer_email_verification_codes_expires_idx on customer_email_verification_codes(expires_at);`);

  // Legacy (kept to avoid breaking older deployments). New code uses customer_password_reset_tokens.
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

  // Backwards-compatible migrations
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

  await db.query(`create index if not exists idx_customers_created_at on customers(created_at desc)`);
  await db.query(`create index if not exists idx_customers_email_lower on customers(lower(email))`);
  await db.query(`create index if not exists idx_customer_sessions_customer_id on customer_sessions(customer_id)`);
  await db.query(`create index if not exists idx_customer_sessions_expires_at on customer_sessions(expires_at)`);

  // orders index (orders table must exist in your app)
  await db.query(`create index if not exists idx_orders_customer_id_created_at on orders(customer_id, created_at desc)`);
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
  email_verified_at?: string | null;
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
  const hasEmailVerifiedAt = await hasColumn("customers", "email_verified_at");

  const r = await db.query<CustomerRow>(
    `select id, email, password_hash,
            ${hasFullName ? "full_name" : "trim(concat_ws(' ', first_name, last_name))"} as full_name,
            phone,
            ${hasAddressLine1 ? "address_line1" : "null::text"} as address_line1,
            ${hasCity ? "city" : "null::text"} as city,
            ${hasCountry ? "country" : "null::text"} as country,
            is_active,
            ${hasEmailVerifiedAt ? "email_verified_at::text" : "null::text"} as email_verified_at,
            created_at::text as created_at
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

export async function createCustomerSession(customerId: number, token: string): Promise<void> {
  await ensureIdentityTables();
  const tokenHash = sha256Hex(token);
  const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(); // 30 days

  const hasTokenHash = await hasColumn("customer_sessions", "token_hash");
  if (hasTokenHash) {
    await db.query(
      `insert into customer_sessions (customer_id, token, token_hash, expires_at)
       values ($1, null, $2, $3)`,
      [customerId, tokenHash, expiresAt]
    );
    return;
  }

  await db.query(
    `insert into customer_sessions (customer_id, token, expires_at)
     values ($1,$2,$3)`,
    [customerId, token, expiresAt]
  );
}

export async function revokeCustomerSessionByToken(token: string): Promise<void> {
  await ensureIdentityTables();
  const tokenHash = sha256Hex(token);
  const hasTokenHash = await hasColumn("customer_sessions", "token_hash");
  if (hasTokenHash) {
    await db.query(
      `update customer_sessions
          set revoked_at = now()
        where revoked_at is null
          and (token_hash = $1 or token = $2)`,
      [tokenHash, token]
    );
    return;
  }
  await db.query(`update customer_sessions set revoked_at = now() where revoked_at is null and token = $1`, [token]);
}

export async function rotateCustomerSession(customerId: number, oldToken: string): Promise<string> {
  await revokeCustomerSessionByToken(oldToken);
  const next = createSessionToken();
  await createCustomerSession(customerId, next);
  return next;
}

function readCookie(cookieHeader: string, name: string): string {
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
}): Promise<void> {
  await ensureIdentityTables();

  const username = String(args.username || "").trim().toLowerCase();
  const fullName =
    args.full_name === undefined ? null : args.full_name === null ? null : String(args.full_name || "").trim() || null;

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

// Backwards-compat named exports used by existing routes
export { listStaffUsers as listStaff, upsertStaffUser as upsertStaff };

/** Email verification (4 digits) */
export function createVerificationCode4(): string {
  const n = crypto.randomInt(0, 10000);
  return String(n).padStart(4, "0");
}

const VERIFY_COOLDOWN_SECONDS = 60;
const VERIFY_WINDOW_SECONDS = 10 * 60;
const VERIFY_MAX_SENDS_PER_WINDOW = 3;

export type IssueVerificationResult =
  | { ok: true; code: string; expiresAt: string }
  | { ok: false; error: "COOLDOWN" | "RATE_LIMIT"; retryAfterSec: number };

export async function issueEmailVerificationCode(customerId: number): Promise<IssueVerificationResult> {
  await ensureIdentityTables();

  // Cooldown: 1 send per minute.
  const last = await db.query<{ created_at: string }>(
    `select created_at::text as created_at
       from customer_email_verification_codes
      where customer_id = $1
      order by id desc
      limit 1`,
    [customerId]
  );
  const lastAt = last.rows[0]?.created_at ? new Date(last.rows[0].created_at).getTime() : 0;
  if (lastAt) {
    const ageSec = Math.floor((Date.now() - lastAt) / 1000);
    if (ageSec < VERIFY_COOLDOWN_SECONDS) {
      return { ok: false, error: "COOLDOWN", retryAfterSec: VERIFY_COOLDOWN_SECONDS - ageSec };
    }
  }

  // Window limit: max 3 sends per 10 minutes.
  const cnt = await db.query<{ n: number }>(
    `select count(*)::int as n
       from customer_email_verification_codes
      where customer_id = $1
        and created_at > now() - interval '${VERIFY_WINDOW_SECONDS} seconds'`,
    [customerId]
  );
  const n = Number(cnt.rows[0]?.n || 0);
  if (n >= VERIFY_MAX_SENDS_PER_WINDOW) {
    const oldest = await db.query<{ created_at: string }>(
      `select created_at::text as created_at
         from customer_email_verification_codes
        where customer_id = $1
          and created_at > now() - interval '${VERIFY_WINDOW_SECONDS} seconds'
        order by created_at asc
        limit 1`,
      [customerId]
    );
    const oldestAt = oldest.rows[0]?.created_at ? new Date(oldest.rows[0].created_at).getTime() : Date.now();
    const ageSec = Math.floor((Date.now() - oldestAt) / 1000);
    const retryAfterSec = Math.max(5, VERIFY_WINDOW_SECONDS - ageSec);
    return { ok: false, error: "RATE_LIMIT", retryAfterSec };
  }

  // Invalidate previous active codes
  await db.query(
    `update customer_email_verification_codes
        set used_at = now()
      where customer_id = $1
        and used_at is null`,
    [customerId]
  );

  const code = createVerificationCode4();
  const salt = crypto.randomBytes(16).toString("hex");
  const codeHash = sha256Hex(`${code}:${salt}`);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  const hasCodeCol = await hasColumn("customer_email_verification_codes", "code");
  const hasCodeHashCol = await hasColumn("customer_email_verification_codes", "code_hash");
  const hasSaltCol = await hasColumn("customer_email_verification_codes", "salt");

  if (hasCodeCol && hasCodeHashCol && hasSaltCol) {
    await db.query(
      `insert into customer_email_verification_codes (customer_id, code, code_hash, salt, expires_at)
       values ($1, $2, $3, $4, $5)`,
      [customerId, code, codeHash, salt, expiresAt.toISOString()]
    );
  } else if (hasCodeHashCol && hasSaltCol) {
    await db.query(
      `insert into customer_email_verification_codes (customer_id, code_hash, salt, expires_at)
       values ($1, $2, $3, $4)`,
      [customerId, codeHash, salt, expiresAt.toISOString()]
    );
  } else if (hasCodeCol) {
    await db.query(
      `insert into customer_email_verification_codes (customer_id, code, expires_at)
       values ($1, $2, $3)`,
      [customerId, code, expiresAt.toISOString()]
    );
  } else {
    // last resort: create missing columns (shouldn't happen because ensureIdentityTables adds them)
    await db.query(`alter table customer_email_verification_codes add column if not exists code text`);
    await db.query(`alter table customer_email_verification_codes add column if not exists code_hash text`);
    await db.query(`alter table customer_email_verification_codes add column if not exists salt text`);
    await db.query(
      `insert into customer_email_verification_codes (customer_id, code, code_hash, salt, expires_at)
       values ($1, $2, $3, $4, $5)`,
      [customerId, code, codeHash, salt, expiresAt.toISOString()]
    );
  }

  return { ok: true, code, expiresAt: expiresAt.toISOString() };
}

export async function confirmEmailVerificationCode(
  customerId: number,
  codeRaw: string
): Promise<{ ok: boolean; error?: string }> {
  await ensureIdentityTables();

  const code = String(codeRaw || "").trim();
  if (!/^[0-9]{4}$/.test(code)) return { ok: false, error: "INVALID_CODE" };

  const hasCodeHashCol = await hasColumn("customer_email_verification_codes", "code_hash");
  const hasSaltCol = await hasColumn("customer_email_verification_codes", "salt");
  const hasCodeCol = await hasColumn("customer_email_verification_codes", "code");

  type Row = {
    id: number;
    code_hash: string | null;
    salt: string | null;
    code: string | null;
    expires_at: string;
    used_at: string | null;
    attempts: number;
  };

  const r = await db.query<Row>(
    `
    select id,
           ${hasCodeHashCol ? "code_hash" : "null::text"} as code_hash,
           ${hasSaltCol ? "salt" : "null::text"} as salt,
           ${hasCodeCol ? "code" : "null::text"} as code,
           expires_at::text as expires_at,
           used_at::text as used_at,
           attempts
      from customer_email_verification_codes
     where customer_id = $1
       and used_at is null
     order by id desc
     limit 1
    `,
    [customerId]
  );

  if (!r.rows.length) return { ok: false, error: "NO_ACTIVE_CODE" };
  const row = r.rows[0];

  // Expired?
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    await db.query(`update customer_email_verification_codes set used_at = now() where id = $1`, [row.id]);
    return { ok: false, error: "EXPIRED" };
  }

  if (row.attempts >= 5) return { ok: false, error: "TOO_MANY_ATTEMPTS" };

  // Prefer hashed verification when available; fallback to plain code if legacy
  let ok = false;

  if (row.code_hash && row.salt) {
    const want = sha256Hex(`${code}:${row.salt}`);
    ok = want === row.code_hash;
  } else if (row.code) {
    ok = row.code === code;
  }

  if (!ok) {
    await db.query(`update customer_email_verification_codes set attempts = attempts + 1 where id = $1`, [row.id]);
    return { ok: false, error: "WRONG_CODE" };
  }

  await db.query(`update customer_email_verification_codes set used_at = now() where id = $1`, [row.id]);
  await db.query(
    `update customers
        set email_verified_at = coalesce(email_verified_at, now()),
            updated_at = now()
      where id = $1`,
    [customerId]
  );

  return { ok: true };
}

export async function isCustomerEmailVerified(customerId: number): Promise<boolean> {
  await ensureIdentityTables();
  const has = await hasColumn("customers", "email_verified_at");
  if (!has) return false;

  const r = await db.query<{ email_verified_at: string | null }>(
    `select email_verified_at::text as email_verified_at from customers where id = $1`,
    [customerId]
  );
  return !!(r.rows[0] && r.rows[0].email_verified_at);
}
