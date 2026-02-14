// src/lib/identity.ts
import { db } from "@/lib/db";
import crypto from "crypto";

export type StaffRole = "admin" | "ops" | "staff";

function pbkdf2Hash(password: string, salt: string) {
  const iterations = 120_000;
  const keylen = 64;
  const digest = "sha512";
  const derived = crypto.pbkdf2Sync(password, salt, iterations, keylen, digest);
  return `pbkdf2_${digest}$${iterations}$${salt}$${derived.toString("hex")}`;
}

function pbkdf2Verify(password: string, stored: string) {
  if (!stored.startsWith("pbkdf2_")) return false;
  const parts = stored.split("$");
  // pbkdf2_sha512$$120000$$salt$$hex
  if (parts.length < 5) return false;
  const alg = parts[0].slice("pbkdf2_".length);
  const iterations = Number(parts[2]);
  const salt = parts[4 - 1]; // keeps compatibility with existing string format
  const hex = parts[5 - 1];
  if (!alg || !iterations || !salt || !hex) return false;

  const derived = crypto.pbkdf2Sync(password, salt, iterations, 64, alg as any);
  const a = Buffer.from(hex, "hex");
  const b = derived;
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

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

    create index if not exists idx_staff_users_active on staff_users(is_active);
    create index if not exists idx_password_reset_tokens_staff on password_reset_tokens(staff_user_id);
    create index if not exists idx_password_reset_tokens_expires on password_reset_tokens(expires_at);
  `);

  // Safe migrations for older schemas
  await db.query(`alter table staff_users add column if not exists full_name text;`);
  await db.query(`alter table staff_users add column if not exists role text not null default 'staff';`);
  await db.query(`alter table staff_users add column if not exists is_active boolean not null default true;`);
  await db.query(`alter table staff_users add column if not exists created_at timestamptz not null default now();`);
  await db.query(`alter table staff_users add column if not exists updated_at timestamptz not null default now();`);
}

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  return pbkdf2Hash(password, salt);
}

export function verifyPassword(password: string, storedHash: string) {
  return pbkdf2Verify(password, storedHash);
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
   ✅ Added exports to fix your TS errors:
   - listStaff
   - upsertStaff
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

  await db.query(
    `insert into staff_users (email, full_name, role, password_hash, is_active)
     values ($1,$2,$3,coalesce($4, 'TEMP'),$5)
     on conflict (email) do update
       set full_name=excluded.full_name,
           role=excluded.role,
           is_active=excluded.is_active,
           password_hash=case
             when $4 is null then staff_users.password_hash
             else excluded.password_hash
           end,
           updated_at=now()`,
    [email, fullName, role, passwordHash, isActive]
  );
}
