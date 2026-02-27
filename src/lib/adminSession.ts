import crypto from "crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/identity";

export type AdminRole = "admin" | "sales";

export type AdminSession = {
  role: AdminRole;
  staffId: number | null;
  username: string | null;
};

function signStaff(staffId: number, username: string): string {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_TOKEN || "";
  return crypto.createHmac("sha256", secret).update(`${staffId}:${username.toLowerCase()}`).digest("hex");
}

function safeEq(a: string, b: string): boolean {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

export async function readAdminSessionFromCookies(): Promise<AdminSession | null> {
  const store = await cookies();
  const adminToken = (store.get("admin_token")?.value || store.get("nivran_admin_token")?.value || "").trim();
  const expected = (process.env.ADMIN_TOKEN || "").trim();
  if (adminToken && expected && adminToken === expected) {
    return { role: "admin", staffId: null, username: null };
  }

  const role = (store.get("nivran_admin_role")?.value || "").trim();
  if (role !== "sales") return null;

  const staffIdRaw = Number(store.get("nivran_staff_id")?.value || "0");
  const username = (store.get("nivran_staff_user")?.value || "").trim().toLowerCase();
  const sig = (store.get("nivran_staff_sig")?.value || "").trim();
  if (!Number.isFinite(staffIdRaw) || staffIdRaw <= 0 || !username || !sig) return null;

  const expectedSig = signStaff(Math.trunc(staffIdRaw), username);
  if (!safeEq(sig, expectedSig)) return null;

  return { role: "sales", staffId: Math.trunc(staffIdRaw), username };
}

export function verifyAdminFromRequest(req: Request): boolean {
  const expected = (process.env.ADMIN_TOKEN || "").trim();
  if (!expected) return false;
  const cookieHeader = req.headers.get("cookie") || "";
  const pieces = cookieHeader.split(";").map((value) => value.trim());
  for (const piece of pieces) {
    if (piece.startsWith("admin_token=") || piece.startsWith("nivran_admin_token=")) {
      const got = decodeURIComponent(piece.slice(piece.indexOf("=") + 1)).trim();
      if (got === expected) return true;
    }
  }
  return false;
}

function readCookie(header: string, name: string): string {
  const pieces = header.split(";").map((value) => value.trim());
  for (const piece of pieces) {
    if (piece.toLowerCase().startsWith(`${name.toLowerCase()}=`)) {
      return decodeURIComponent(piece.slice(name.length + 1));
    }
  }
  return "";
}

export function readSalesFromRequest(req: Request): { staffId: number; username: string } | null {
  const cookie = req.headers.get("cookie") || "";
  const role = readCookie(cookie, "nivran_admin_role").trim();
  if (role !== "sales") return null;

  const staffId = Number(readCookie(cookie, "nivran_staff_id"));
  const username = readCookie(cookie, "nivran_staff_user").trim().toLowerCase();
  const sig = readCookie(cookie, "nivran_staff_sig").trim();
  if (!Number.isFinite(staffId) || staffId <= 0 || !username || !sig) return null;

  const expectedSig = signStaff(Math.trunc(staffId), username);
  if (!safeEq(sig, expectedSig)) return null;

  return { staffId: Math.trunc(staffId), username };
}

export function makeSalesCookies(staffId: number, username: string, rememberMe: boolean): Array<{ name: string; value: string; maxAge: number }> {
  const maxAge = rememberMe ? 60 * 60 * 24 * 14 : 60 * 30;
  const normalizedUser = username.trim().toLowerCase();
  const sig = signStaff(staffId, normalizedUser);

  return [
    { name: "nivran_admin_role", value: "sales", maxAge },
    { name: "nivran_staff_id", value: String(staffId), maxAge },
    { name: "nivran_staff_user", value: normalizedUser, maxAge },
    { name: "nivran_staff_sig", value: sig, maxAge },
  ];
}

export async function authenticateSalesUser(usernameRaw: string, password: string): Promise<{ ok: true; staffId: number; username: string } | { ok: false; error: string }> {
  const username = usernameRaw.trim().toLowerCase();
  if (!username || !password) return { ok: false, error: "Email and password are required" };

  await db.query(`
    create table if not exists staff_login_attempts (
      id bigserial primary key,
      username text not null,
      attempted_at timestamptz not null default now(),
      success boolean not null default false
    )
  `);

  const failedCount = await db.query<{ c: string }>(
    `select count(*)::text as c
       from staff_login_attempts
      where username=$1
        and success=false
        and attempted_at > now() - interval '15 minutes'`,
    [username]
  );

  const attempts = Number(failedCount.rows[0]?.c || "0");
  if (attempts >= 8) return { ok: false, error: "Too many attempts. Try again in 15 minutes." };

  const row = await db.query<{ id: number; username: string; password_hash: string; role: string; is_active: boolean }>(
    `select id, username, password_hash, role, is_active
       from staff_users
      where lower(username)=lower($1)
      limit 1`,
    [username]
  );

  const user = row.rows[0];
  const role = String(user?.role || "").toLowerCase();
  const isSalesRole = role === "sales" || role === "staff";
  const valid = !!user && user.is_active && isSalesRole && (await verifyPassword(password, user.password_hash));

  await db.query(`insert into staff_login_attempts (username, success) values ($1,$2)`, [username, valid]);

  if (!valid || !user) return { ok: false, error: "Invalid credentials" };
  return { ok: true, staffId: user.id, username: user.username };
}
