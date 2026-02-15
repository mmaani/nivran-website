import { db } from "@/lib/db";
import { ensureCatalogTables } from "@/lib/catalog";
import { ensureIdentityTables, getCustomerIdFromRequest } from "@/lib/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await ensureCatalogTables();
  await ensureIdentityTables();

  const customerId = await getCustomerIdFromRequest(req);
  if (!customerId) return Response.json({ ok: false }, { status: 401 });

  const pr = await db.query(
    `select id, email, full_name, phone, address_line1, city, country,
            created_at::text as created_at
       from customers
      where id=$1 and is_active=true
      limit 1`,
    [customerId]
  );
  const profile = pr.rows[0];
  if (!profile) return Response.json({ ok: false }, { status: 401 });

  // Orders summary
  const or = await db.query(
    `select id, cart_id, status,
            amount_jod::text as amount_jod,
            created_at::text as created_at
       from orders
      where customer_id=$1
      order by created_at desc
      limit 50`,
    [customerId]
  );

  return Response.json({ ok: true, profile, orders: or.rows });
}

export async function PUT(req: Request) {
  await ensureIdentityTables();

  const customerId = await getCustomerIdFromRequest(req);
  if (!customerId) return Response.json({ ok: false }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  const fullName = String(body?.full_name || "").trim();
  const phone = String(body?.phone || "").trim();
  const addressLine1 = String(body?.address_line1 || "").trim();
  const city = String(body?.city || "").trim();
  const country = String(body?.country || "").trim() || "Jordan";

  // App-level mandatory fields
  if (!fullName || !phone || !addressLine1) {
    return Response.json(
      { ok: false, error: "Missing required fields (full name, phone, address)." },
      { status: 400 }
    );
  }

  await db.query(
    `update customers
        set full_name=$1, phone=$2, address_line1=$3, city=$4, country=$5, updated_at=now()
      where id=$6`,
    [fullName, phone, addressLine1, city, country, customerId]
  );

  return Response.json({ ok: true });
}
