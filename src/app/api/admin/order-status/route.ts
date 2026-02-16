import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureOrdersTables } from "@/lib/orders";
import { requireAdmin } from "@/lib/guards";

export const runtime = "nodejs";

function isAllowedTransition(paymentMethod: string, current: string, next: string) {
  const pm = String(paymentMethod || "").toUpperCase();

  // PayTabs guardrail: can't ship unless PAID
  if (pm === "PAYTABS") {
    if ((next === "SHIPPED" || next === "DELIVERED") && current !== "PAID") return false;
  }

  // COD recommended flow
  if (pm === "COD") {
    const allowed = new Set([
      "PENDING_COD_CONFIRM",
      "PROCESSING",
      "SHIPPED",
      "DELIVERED",
      "PAID_COD",
      "CANCELED",
    ]);
    if (!allowed.has(next)) return false;
  }

  return true;
}

export async function POST(req: Request) {
  const auth = requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
  await ensureOrdersTables();
  const body = (await req.json().catch(() => ({}))) as { id?: number | string; status?: string };
  const id = Number(body?.id);
  const nextStatus = String(body?.status || "");

  if (!id || !nextStatus) {
    return NextResponse.json({ ok: false, error: "id and status are required" }, { status: 400 });
  }

  const pool = db;
  const { rows } = await pool.query(
    `select id, status, payment_method from orders where id=$1`,
    [id]
  );
  if (!rows.length) {
    return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });
  }

  const order = rows[0];
  const current = String(order.status || "");
  const pm = String(order.payment_method || "");

  if (!isAllowedTransition(pm, current, nextStatus)) {
    return NextResponse.json(
      { ok: false, error: `Transition not allowed: ${pm} ${current} -> ${nextStatus}` },
      { status: 400 }
    );
  }

  await pool.query(
    `update orders set status=$2, updated_at=now() where id=$1`,
    [id, nextStatus]
  );

  return NextResponse.json({ ok: true });
}
