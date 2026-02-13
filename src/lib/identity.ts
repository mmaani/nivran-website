import crypto from "crypto";
import { db } from "@/lib/db";

const SESSION_BYTES = 32;

export async function ensureIdentityTables() {
  await db.query(`
    create table if not exists customers (
      id bigserial primary key,
      email text not null unique,
      password_hash text not null,
      first_name text,
      last_name text,
      phone text,
      locale text not null default 'en',
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists customer_sessions (
      id bigserial primary key,
      customer_id bigint not null references customers(id) on delete cascade,
      token text not null unique,
      created_at timestamptz not null default now(),
      expires_at timestamptz not null,
      revoked_at timestamptz
    );

    create table if not exists staff_users (
      id bigserial primary key,
      email text not null unique,
      password_hash text not null,
      full_name text,
      role text not null default 'staff',
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create index if not exists idx_customer_sessions_customer_id on customer_sessions(customer_id);
    create index if not exists idx_customer_sessions_token on customer_sessions(token);
  `);
}

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [algo, salt, hash] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const check = crypto.scryptSync(password, salt, 64);
  const current = Buffer.from(hash, "hex");
  if (current.length !== check.length) return false;
  return crypto.timingSafeEqual(current, check);
}

export function createSessionToken() {
  return crypto.randomBytes(SESSION_BYTES).toString("hex");
}
