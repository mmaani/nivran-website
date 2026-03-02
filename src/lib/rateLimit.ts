import { db } from "@/lib/db";

export type RateLimitAction =
  | "verify_email_send"
  | "auth_login"
  | "auth_forgot_password"
  | "auth_reset_password";

export async function ensureRateLimitTables(): Promise<void> {
  await db.query(`
    create table if not exists auth_rate_limits (
      id bigserial primary key,
      created_at timestamptz not null default now(),
      key text not null,
      action text not null
    );
  `);
  await db.query(`create index if not exists auth_rate_limits_key_action_idx on auth_rate_limits(key, action, created_at desc);`);
}

export async function rateLimitCheck(args: {
  key: string;
  action: RateLimitAction;
  windowSeconds: number;
  maxInWindow: number;
}): Promise<{ ok: boolean; remaining: number; retryAfterSeconds: number }> {
  await ensureRateLimitTables();

  const since = new Date(Date.now() - args.windowSeconds * 1000).toISOString();
  const r = await db.query<{ c: string }>(
    `select count(*)::text as c
       from auth_rate_limits
      where key=$1 and action=$2 and created_at >= $3`,
    [args.key, args.action, since]
  );

  const used = Number(r.rows[0]?.c || "0");
  const remaining = Math.max(0, args.maxInWindow - used);

  if (used >= args.maxInWindow) {
    return { ok: false, remaining: 0, retryAfterSeconds: Math.max(30, Math.floor(args.windowSeconds / 6)) };
  }

  await db.query(`insert into auth_rate_limits (key, action) values ($1,$2)`, [args.key, args.action]);

  return { ok: true, remaining: remaining - 1, retryAfterSeconds: 0 };
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for") || "";
  const first = forwarded.split(",")[0]?.trim();
  if (first) return first;
  const realIp = (req.headers.get("x-real-ip") || "").trim();
  if (realIp) return realIp;
  const cfIp = (req.headers.get("cf-connecting-ip") || "").trim();
  if (cfIp) return cfIp;
  return "unknown";
}
