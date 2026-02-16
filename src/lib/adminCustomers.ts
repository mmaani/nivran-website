import "server-only";
import { db } from "@/lib/db";
import { hasColumn } from "@/lib/dbSchema";
import { ensureIdentityTables } from "@/lib/identity";

export type AdminCustomerRow = {
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

export type CustomersPage = {
  rows: AdminCustomerRow[];
  total: number;
  page: number;
  pageSize: number;
};

export async function fetchAdminCustomers(page: number, pageSize: number): Promise<CustomersPage> {
  await ensureIdentityTables();

  const safePageSize = [25, 50, 100].includes(pageSize) ? pageSize : 25;
  const safePage = page > 0 ? page : 1;
  const offset = (safePage - 1) * safePageSize;

  const hasTotalJod = await hasColumn("orders", "total_jod");
  const hasFullName = await hasColumn("customers", "full_name");
  const hasAddressLine1 = await hasColumn("customers", "address_line1");
  const hasCity = await hasColumn("customers", "city");
  const hasCountry = await hasColumn("customers", "country");

  const [rowsRes, countRes] = await Promise.all([
    db.query<AdminCustomerRow>(
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
      limit $1
      offset $2
      `,
      [safePageSize, offset]
    ),
    db.query<{ total: string }>(`select count(*)::text as total from customers`),
  ]);

  return {
    rows: rowsRes.rows,
    total: Number(countRes.rows[0]?.total || 0),
    page: safePage,
    pageSize: safePageSize,
  };
}


export async function fetchAllAdminCustomers(pageSize = 100): Promise<AdminCustomerRow[]> {
  const safePageSize = [25, 50, 100].includes(pageSize) ? pageSize : 100;
  const firstPage = await fetchAdminCustomers(1, safePageSize);
  const rows = [...firstPage.rows];
  const totalPages = Math.max(1, Math.ceil(firstPage.total / safePageSize));

  for (let page = 2; page <= totalPages; page += 1) {
    const next = await fetchAdminCustomers(page, safePageSize);
    rows.push(...next.rows);
  }

  return rows;
}
