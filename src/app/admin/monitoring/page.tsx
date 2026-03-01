// src/app/admin/monitoring/page.tsx
import "server-only";
import { db } from "@/lib/db";
import { ensureOrdersTablesSafe } from "@/lib/orders";
import { ensureRefundTablesSafe } from "@/lib/refundsSchema";
import { requireAdmin } from "@/lib/guards";
import { cookies } from "next/headers";

export const runtime = "nodejs";

async function cookieHeader(): Promise<string> {
  const c = await cookies();
  const parts: string[] = [];
  for (const item of c.getAll()) parts.push(`${item.name}=${item.value}`);
  return parts.join("; ");
}

export default async function MonitoringPage() {
  await ensureOrdersTablesSafe();
  await ensureRefundTablesSafe();

  const req = new Request("http://local.admin/monitoring", {
    headers: { cookie: await cookieHeader() },
  });

  const auth = requireAdmin(req);
  if (!auth.ok) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Monitoring</h1>
        <p>Unauthorized</p>
      </main>
    );
  }

  const ordersByStatus = await db.query(
    `select status, count(*)::int as count
       from orders
      where created_at > now() - interval '30 days'
      group by status
      order by count desc`
  );

  const paidButNotCommitted = await db.query(
    `select id, cart_id, created_at, updated_at
       from orders
      where status in ('PAID','PAID_COD')
        and inventory_committed_at is null
      order by updated_at desc
      limit 50`
  );

  const refundFunnel = await db.query(
    `select status, count(*)::int as count
       from refunds
      where requested_at > now() - interval '30 days'
      group by status
      order by count desc`
  );

  const restockBacklog = await db.query(
    `select status, count(*)::int as count
       from restock_jobs
      group by status
      order by count desc`
  );

  const stuckPaytabsPending = await db.query(
    `select cart_id, status, paytabs_tran_ref, updated_at
       from orders
      where status='PENDING_PAYMENT'
        and payment_method='PAYTABS'
        and updated_at < now() - interval '30 minutes'
      order by updated_at asc
      limit 100`
  );

  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ marginBottom: 8 }}>Monitoring</h1>
      <p style={{ opacity: 0.7, marginTop: 0 }}>High-signal health queries (last 30 days where relevant)</p>

      <section style={{ marginTop: 24 }}>
        <h2>Orders by status</h2>
        <pre>{JSON.stringify(ordersByStatus.rows, null, 2)}</pre>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Paid but inventory not committed (should be 0)</h2>
        <pre>{JSON.stringify(paidButNotCommitted.rows, null, 2)}</pre>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Refund funnel</h2>
        <pre>{JSON.stringify(refundFunnel.rows, null, 2)}</pre>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Restock jobs backlog</h2>
        <pre>{JSON.stringify(restockBacklog.rows, null, 2)}</pre>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Stuck PayTabs pending &gt; 30 min</h2>
        <pre>{JSON.stringify(stuckPaytabsPending.rows, null, 2)}</pre>
      </section>
    </main>
  );
}