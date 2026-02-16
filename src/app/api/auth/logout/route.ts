import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hasColumn } from "@/lib/dbSchema";
import { CUSTOMER_SESSION_COOKIE, sha256Hex } from "@/lib/identity";

export const runtime = "nodejs";

function readCookie(cookieHeader: string, name: string) {
  const parts = cookieHeader.split(";").map((p) => p.trim());
  for (const p of parts) {
    if (p.toLowerCase().startsWith(name.toLowerCase() + "=")) {
      return decodeURIComponent(p.slice(name.length + 1));
    }
  }
  return "";
}

export async function POST(req: Request) {
  const cookieHeader = req.headers.get("cookie") || "";
  const token = readCookie(cookieHeader, CUSTOMER_SESSION_COOKIE);

  if (token) {
    const tokenHash = sha256Hex(token);
    const hasTokenHash = await hasColumn("customer_sessions", "token_hash");
    const q = hasTokenHash
      ? `update customer_sessions set revoked_at=now() where token_hash=$1 or token=$2`
      : `update customer_sessions set revoked_at=now() where token=$1`;
    const params = hasTokenHash ? [tokenHash, token] : [token];
    await db.query(q, params).catch(() => {});
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(CUSTOMER_SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
