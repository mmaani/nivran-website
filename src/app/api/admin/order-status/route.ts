import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const ALLOWED = new Set(["PENDING_PAYMENT","PAID","SHIPPED","DELIVERED","REFUNDED","FAILED"]);

export async function POST(req: Request): Promise<Response> {
  try {
    const token = process.env.ADMIN_TOKEN || "";
    if (!token) return NextResponse.json({ ok: false, error: "Missing ADMIN_TOKEN on server" }, { status: 500 });

    const header = req.headers.get("authorization") || "";
    const got = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!got || got !== token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const input = await req.json().catch(() => ({} as any));
    const cartId = String(input?.cartId || "");
    const nextStatus = String(input?.status || "");

    if (!cartId || !nextStatus) {
      return NextResponse.json({ ok: false, error: "cartId and status are required" }, { status: 400 });
    }
    if (!ALLOWED.has(nextStatus)) {
      return NextResponse.json({ ok: false, error: "Invalid status" }, { status: 400 });
    }

    const pool = db();

    // Load current order
    const cur = await pool.query(
      `select status, paytabs_response_status, paytabs_response_message
       from orders where cart_id=$1`,
      [cartId]
    );
    if (!cur.rows.length) return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });

    const currentStatus = String(cur.rows[0].status || "");
    const paytabsStatus = String(cur.rows[0].paytabs_response_status || "").toUpperCase(); // e.g. C=Cancelled

    // Prevent shipping/delivery unless PAID
    if ((nextStatus === "SHIPPED" || nextStatus === "DELIVERED") && currentStatus !== "PAID") {
      return NextResponse.json({ ok: false, error: "Only PAID orders can be shipped/delivered" }, { status: 400 });
    }

    // If PayTabs indicates cancelled/failed, do not allow moving away from FAILED
    if (paytabsStatus === "C" && nextStatus !== "FAILED") {
      return NextResponse.json({ ok: false, error: "PayTabs shows Cancelled. Keep status FAILED." }, { status: 400 });
    }

    const { rows } = await pool.query(
      `update orders
       set status=$2, updated_at=now()
       where cart_id=$1
       returning id, cart_id, status, updated_at`,
      [cartId, nextStatus]
    );

    return NextResponse.json({ ok: true, updated: rows[0] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
