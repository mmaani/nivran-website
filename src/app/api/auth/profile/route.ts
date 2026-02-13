import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCustomerIdFromRequest, hashPassword } from "@/lib/identity";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const customerId = await getCustomerIdFromRequest(req);
  if (!customerId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const [profileRes, ordersRes] = await Promise.all([
    db.query<{ id: number; email: string; first_name: string | null; last_name: string | null; phone: string | null; locale: string }>(
      `select id, email, first_name, last_name, phone, locale from customers where id=$1`,
      [customerId]
    ),
    db.query<{ id: number; cart_id: string; status: string; amount: string; created_at: string }>(
      `select id, cart_id, status, amount::text, created_at::text
       from orders
       where lower(customer_email)=(select email from customers where id=$1)
       order by created_at desc
       limit 100`,
      [customerId]
    ),
  ]);

  const pending = ordersRes.rows.filter((o) => ["PENDING_PAYMENT", "PENDING_COD_CONFIRM", "PROCESSING", "SHIPPED"].includes(o.status));
  return NextResponse.json({ ok: true, profile: profileRes.rows[0], orders: ordersRes.rows, pending });
}

export async function PUT(req: Request) {
  const customerId = await getCustomerIdFromRequest(req);
  if (!customerId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const input = await req.json().catch(() => ({} as any));
  const firstName = String(input?.firstName || "").trim() || null;
  const lastName = String(input?.lastName || "").trim() || null;
  const phone = String(input?.phone || "").trim() || null;
  const locale = String(input?.locale || "en") === "ar" ? "ar" : "en";
  const password = String(input?.password || "");

  if (password && password.length < 8) {
    return NextResponse.json({ ok: false, error: "Password must be at least 8 chars" }, { status: 400 });
  }

  if (password) {
    await db.query(
      `update customers set first_name=$2,last_name=$3,phone=$4,locale=$5,password_hash=$6,updated_at=now() where id=$1`,
      [customerId, firstName, lastName, phone, locale, hashPassword(password)]
    );
  } else {
    await db.query(
      `update customers set first_name=$2,last_name=$3,phone=$4,locale=$5,updated_at=now() where id=$1`,
      [customerId, firstName, lastName, phone, locale]
    );
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const customerId = await getCustomerIdFromRequest(req);
  if (!customerId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  await db.query(`update customers set is_active=false, updated_at=now() where id=$1`, [customerId]);
  await db.query(`update customer_sessions set revoked_at=now() where customer_id=$1`, [customerId]);

  const res = NextResponse.json({ ok: true });
  res.cookies.set("customer_session", "", { path: "/", maxAge: 0 });
  return res;
}
