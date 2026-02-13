import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  try {
    // Admin auth (inline so we never accidentally return a plain object)
    const token = process.env.ADMIN_TOKEN || "";
    if (!token) {
      return NextResponse.json({ ok: false, error: "Missing ADMIN_TOKEN on server" }, { status: 500 });
    }

    const header = req.headers.get("authorization") || "";
    const got = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!got || got !== token) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const input = await req.json().catch(() => ({} as any));
    const cartId = String(input?.cartId || "");
    const status = String(input?.status || "");

    if (!cartId || !status) {
      return NextResponse.json({ ok: false, error: "cartId and status are required" }, { status: 400 });
    }

    const pool = db();
    const { rows } = await pool.query(
      `update orders
       set status=$2, updated_at=now()
       where cart_id=$1
       returning id, cart_id, status, updated_at`,
      [cartId, status]
    );

    if (!rows.length) {
      return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, updated: rows[0] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
