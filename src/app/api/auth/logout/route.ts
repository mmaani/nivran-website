import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const token = req.headers.get("cookie")?.match(/customer_session=([^;]+)/)?.[1] || "";
  if (token) {
    await db.query(`update customer_sessions set revoked_at=now() where token=$1`, [token]);
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set("customer_session", "", { path: "/", maxAge: 0 });
  return res;
}
