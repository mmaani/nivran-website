import { db } from "@/lib/db";
import { hasColumn } from "@/lib/dbSchema";
import { ensureIdentityTables } from "@/lib/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = {
  id: number;
  email: string;
  full_name: string | null;
  phone: string | null;
  address_line1: string | null;
  city: string | null;
  country: string | null;
  created_at: string;
  orders_count: number;
  total_spent: string;
  last_order_at: string | null;
};

export default async function AdminCustomersPage() {
  await ensureIdentityTables();
  const hasTotalJod = await hasColumn("orders", "total_jod");
  const hasFullName = await hasColumn("customers", "full_name");
  const hasAddressLine1 = await hasColumn("customers", "address_line1");
  const hasCity = await hasColumn("customers", "city");
  const hasCountry = await hasColumn("customers", "country");

  const r = await db.query<Row>(
    `
    select
      c.id,
      c.email,
      ${hasFullName ? "c.full_name" : "trim(concat_ws(' ', c.first_name, c.last_name))"} as full_name,
      c.phone,
      ${hasAddressLine1 ? "c.address_line1" : "null::text"} as address_line1,
      ${hasCity ? "c.city" : "null::text"} as city,
      ${hasCountry ? "c.country" : "null::text"} as country,
      c.created_at::text as created_at,
      coalesce(o.orders_count, 0)::int as orders_count,
      coalesce(o.total_spent, 0)::text as total_spent,
      o.last_order_at::text as last_order_at
    from customers c
    left join (
      select
        customer_id,
        count(*) as orders_count,
        sum(${hasTotalJod ? "coalesce(total_jod, amount)" : "amount"}) as total_spent,
        max(created_at) as last_order_at
      from orders
      where customer_id is not null
      group by customer_id
    ) o on o.customer_id = c.id
    order by o.last_order_at desc nulls last, c.created_at desc
    limit 500
    `
  );

  return (
    <div>
      <h1 className="admin-title">Customers</h1>
      <p className="muted">Shows customer contact/location + purchase history summary.</p>

      <div style={{ overflowX: "auto" }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Email</th>
              <th>Name</th>
              <th>Phone</th>
              <th>Address</th>
              <th>Orders</th>
              <th>Total Spent</th>
              <th>Last Order</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {r.rows.map((x) => (
              <tr key={x.id}>
                <td>{x.id}</td>
                <td>{x.email}</td>
                <td>{x.full_name || "—"}</td>
                <td>{x.phone || "—"}</td>
                <td>
                  {[x.address_line1, x.city, x.country].filter(Boolean).join(", ") || "—"}
                </td>
                <td>{x.orders_count}</td>
                <td>{Number(x.total_spent || 0).toFixed(2)} JOD</td>
                <td>{x.last_order_at ? new Date(x.last_order_at).toLocaleString() : "—"}</td>
                <td>{new Date(x.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
