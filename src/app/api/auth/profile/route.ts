import { db } from "@/lib/db";
import { ensureCatalogTables } from "@/lib/catalog";
import { ensureIdentityTables, getCustomerIdFromRequest } from "@/lib/identity";
import { hasColumn } from "@/lib/dbSchema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await ensureCatalogTables();
  await ensureIdentityTables();

  const customerId = await getCustomerIdFromRequest(req);
  if (!customerId) return Response.json({ ok: false }, { status: 401 });

  const hasFullName = await hasColumn("customers", "full_name");
  const hasAddressLine1 = await hasColumn("customers", "address_line1");
  const hasCity = await hasColumn("customers", "city");
  const hasCountry = await hasColumn("customers", "country");
  const hasEmailVerifiedAt = await hasColumn("customers", "email_verified_at");

  const pr = await db.query(
    `select id, email,
            ${hasFullName ? "full_name" : "trim(concat_ws(' ', first_name, last_name))"} as full_name,
            phone,
            ${hasAddressLine1 ? "address_line1" : "null::text"} as address_line1,
            ${hasCity ? "city" : "null::text"} as city,
            ${hasCountry ? "country" : "null::text"} as country,
            ${hasEmailVerifiedAt ? "email_verified_at::text" : "null::text"} as email_verified_at,
            created_at::text as created_at
       from customers
      where id=$1 and is_active=true
      limit 1`,
    [customerId]
  );

  const profile = pr.rows[0];
  if (!profile) return Response.json({ ok: false }, { status: 401 });

  const hasTotalJod = await hasColumn("orders", "total_jod");
  const or = await db.query(
    `select id, cart_id, status,
            ${hasTotalJod ? "coalesce(total_jod, amount)" : "amount"}::text as amount_jod,
            created_at::text as created_at
       from orders
      where customer_id=$1
      order by created_at desc
      limit 50`,
    [customerId]
  );

  return Response.json({ ok: true, profile, orders: or.rows });
}

type ProfilePutBody = {
  full_name?: string;
  phone?: string;
  address_line1?: string;
  city?: string;
  country?: string;
};

export async function PUT(req: Request) {
  await ensureIdentityTables();

  const customerId = await getCustomerIdFromRequest(req);
  if (!customerId) return Response.json({ ok: false }, { status: 401 });

  const hasFullName = await hasColumn("customers", "full_name");
  const hasAddressLine1 = await hasColumn("customers", "address_line1");
  const hasCity = await hasColumn("customers", "city");
  const hasCountry = await hasColumn("customers", "country");

  const body: ProfilePutBody = await req.json().catch((): ProfilePutBody => ({}));

  const fullName = String(body.full_name ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const addressLine1 = String(body.address_line1 ?? "").trim();
  const city = String(body.city ?? "").trim();
  const country = String(body.country ?? "").trim() || "Jordan";

  if (!fullName || !phone || !addressLine1) {
    return Response.json(
      { ok: false, error: "Missing required fields (full name, phone, address)." },
      { status: 400 }
    );
  }

  const sets: string[] = [];
  const vals: Array<string | number> = [];
  let i = 1;

  sets.push(`${hasFullName ? "full_name" : "first_name"}=$${i++}`);
  vals.push(fullName);

  sets.push(`phone=$${i++}`);
  vals.push(phone);

  if (hasAddressLine1) {
    sets.push(`address_line1=$${i++}`);
    vals.push(addressLine1);
  }

  if (hasCity) {
    sets.push(`city=$${i++}`);
    vals.push(city);
  }

  if (hasCountry) {
    sets.push(`country=$${i++}`);
    vals.push(country);
  }

  sets.push(`updated_at=now()`);

  vals.push(customerId);
  const idParam = `$${i}`;

  await db.query(
    `update customers
        set ${sets.join(", ")}
      where id=${idParam}`,
    vals
  );

  return Response.json({ ok: true });
}
