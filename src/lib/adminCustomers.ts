import "server-only";
import { db } from "@/lib/db";
import { ensureIdentityTables } from "@/lib/identity";

export type AdminCustomerRow = {
  id: number;
  email: string;
  full_name: string | null;
  phone: string | null;
  address_line1: string | null;
  city: string | null;
  country: string | null;
  email_verified_at: string | null;
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

export type AdminCustomerOrderRow = {
  id: number;
  status: string;
  amount_jod: string;
  created_at: string;
};

export type AdminCustomerDetails = {
  customer: {
    id: number;
    email: string;
    full_name: string | null;
    phone: string | null;
    address_line1: string | null;
    city: string | null;
    country: string | null;
    email_verified_at: string | null;
    created_at: string;
    is_active: boolean;
  } | null;
  orders: AdminCustomerOrderRow[];
  sessions: {
    count: number;
    last_seen_at: string | null;
    max_expires_at: string | null;
  };
};

function clampPageSize(pageSize: number): number {
  if (pageSize === 25 || pageSize === 50 || pageSize === 100) return pageSize;
  return 25;
}

function safePage(page: number): number {
  if (!Number.isFinite(page) || page <= 0) return 1;
  return Math.trunc(page);
}

export async function fetchAdminCustomers(page: number, pageSize: number): Promise<CustomersPage> {
  await ensureIdentityTables();

  const safeSize = clampPageSize(pageSize);
  const safePg = safePage(page);
  const offset = (safePg - 1) * safeSize;

  const [rowsRes, countRes] = await Promise.all([
    db.query<AdminCustomerRow>(
      `
      select
        c.id::int as id,
        c.email,
        c.full_name,
        c.phone,
        c.address_line1,
        c.city,
        c.country,
        c.email_verified_at::text as email_verified_at,
        c.created_at::text as created_at,
        coalesce(o.orders_count, 0)::int as orders_count,
        coalesce(o.total_spent, 0)::text as total_spent,
        o.last_order_at::text as last_order_at
      from customers c
      left join (
        select
          customer_id,
          count(*)::int as orders_count,
          sum(coalesce(total_jod, amount)) as total_spent,
          max(created_at) as last_order_at
        from orders
        where customer_id is not null
        group by customer_id
      ) o on o.customer_id = c.id
      order by o.last_order_at desc nulls last, c.created_at desc
      limit $1
      offset $2
      `,
      [safeSize, offset],
    ),
    db.query<{ total: string }>(`select count(*)::text as total from customers`),
  ]);

  return {
    rows: rowsRes.rows,
    total: Number(countRes.rows[0]?.total || 0),
    page: safePg,
    pageSize: safeSize,
  };
}

export async function fetchAllAdminCustomers(pageSize = 100): Promise<AdminCustomerRow[]> {
  const safeSize = clampPageSize(pageSize);
  const firstPage = await fetchAdminCustomers(1, safeSize);
  const rows: AdminCustomerRow[] = [...firstPage.rows];

  const totalPages = Math.max(1, Math.ceil(firstPage.total / safeSize));
  for (let p = 2; p <= totalPages; p += 1) {
    const next = await fetchAdminCustomers(p, safeSize);
    rows.push(...next.rows);
  }

  return rows;
}

export async function fetchAdminCustomerDetails(
  customerId: number,
): Promise<AdminCustomerDetails> {
  await ensureIdentityTables();

  const [cRes, ordersRes, sessionsRes] = await Promise.all([
    db.query<{
      id: number;
      email: string;
      full_name: string | null;
      phone: string | null;
      address_line1: string | null;
      city: string | null;
      country: string | null;
      email_verified_at: string | null;
      created_at: string;
      is_active: boolean;
    }>(
      `
      select
        id::int as id,
        email,
        full_name,
        phone,
        address_line1,
        city,
        country,
        email_verified_at::text as email_verified_at,
        created_at::text as created_at,
        is_active
      from customers
      where id = $1
      limit 1
      `,
      [customerId],
    ),

    db.query<AdminCustomerOrderRow>(
      `
      select
        id::int as id,
        status,
        coalesce(total_jod, amount)::text as amount_jod,
        created_at::text as created_at
      from orders
      where customer_id = $1
      order by created_at desc
      limit 10
      `,
      [customerId],
    ),

    db.query<{
      count: string;
      last_seen_at: string | null;
      max_expires_at: string | null;
    }>(
      `
      select
        count(*)::text as count,
        max(created_at)::text as last_seen_at,
        max(expires_at)::text as max_expires_at
      from customer_sessions
      where customer_id = $1
        and revoked_at is null
      `,
      [customerId],
    ),
  ]);

  const customer =
    cRes.rows.length > 0 ? cRes.rows[0] : null;

  const sessionsRow =
    sessionsRes.rows.length > 0 ? sessionsRes.rows[0] : null;

  return {
    customer,
    orders: ordersRes.rows,
    sessions: {
      count: sessionsRow ? Number(sessionsRow.count) : 0,
      last_seen_at: sessionsRow?.last_seen_at ?? null,
      max_expires_at: sessionsRow?.max_expires_at ?? null,
    },
  };
}