import Link from "next/link";
import { db } from "@/lib/db";
import { ensureOrdersTables } from "@/lib/orders";
import RequireAdmin from "./_components/RequireAdmin";

type CountRow = { count: string };
type RevenueRow = { total: string | null };

type DashboardStats = {
  totalOrders: number;
  paidOrders: number;
  pendingPayment: number;
  failedOrCanceled: number;
  subscribers: number;
  messages: number;
  callbacks: number;
  revenueJod: number;
};

function toNum(v: string | null | undefined): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

async function getStats(): Promise<DashboardStats> {
  await ensureOrdersTables();

  await db.query(`
    create table if not exists contact_submissions (
      id bigserial primary key,
      name text not null,
      email text not null,
      phone text,
      message text not null,
      locale text not null default 'en',
      created_at timestamptz not null default now()
    );
    create table if not exists newsletter_subscribers (
      id bigserial primary key,
      email text not null unique,
      locale text not null default 'en',
      created_at timestamptz not null default now()
    );
  `);

  const [
    totalOrders,
    paidOrders,
    pendingPayment,
    failedOrCanceled,
    subscribers,
    messages,
    callbacks,
    revenue,
  ] = await Promise.all([
    db.query<CountRow>(`select count(*)::text as count from orders`),
    db.query<CountRow>(`select count(*)::text as count from orders where status='PAID'`),
    db.query<CountRow>(`select count(*)::text as count from orders where status='PENDING_PAYMENT'`),
    db.query<CountRow>(`select count(*)::text as count from orders where status in ('FAILED','CANCELED')`),
    db.query<CountRow>(`select count(*)::text as count from newsletter_subscribers`),
    db.query<CountRow>(`select count(*)::text as count from contact_submissions`),
    db.query<CountRow>(`select count(*)::text as count from paytabs_callbacks`),
    db.query<RevenueRow>(
      `select coalesce(sum(coalesce(total_jod, amount::numeric)),0)::text as total from orders where status in ('PAID','PAID_COD')`
    ),
  ]);

  return {
    totalOrders: toNum(totalOrders.rows[0]?.count),
    paidOrders: toNum(paidOrders.rows[0]?.count),
    pendingPayment: toNum(pendingPayment.rows[0]?.count),
    failedOrCanceled: toNum(failedOrCanceled.rows[0]?.count),
    subscribers: toNum(subscribers.rows[0]?.count),
    messages: toNum(messages.rows[0]?.count),
    callbacks: toNum(callbacks.rows[0]?.count),
    revenueJod: toNum(revenue.rows[0]?.total),
  };
}

export default async function AdminDashboardPage() {
  const s = await getStats();

  const cards = [
    { label: "Total orders", value: s.totalOrders, hint: "All-time", tone: "indigo" },
    { label: "Revenue", value: `${s.revenueJod.toFixed(2)} JOD`, hint: "Paid + COD paid", tone: "gold" },
    { label: "Paid orders", value: s.paidOrders, hint: "Confirmed payments", tone: "green" },
    { label: "Pending payment", value: s.pendingPayment, hint: "Need callback/reconcile", tone: "amber" },
    { label: "Failed / canceled", value: s.failedOrCanceled, hint: "Needs follow-up", tone: "rose" },
    { label: "Subscribers", value: s.subscribers, hint: "Newsletter list", tone: "indigo" },
    { label: "Messages", value: s.messages, hint: "Contact submissions", tone: "green" },
    { label: "PayTabs callbacks", value: s.callbacks, hint: "Gateway events", tone: "amber" },
  ] as const;

  return (
    <RequireAdmin>
      <section className="admin-page">
        <div className="admin-dashboard-hero admin-card">
          <div>
            <p className="admin-kicker">NIVRAN OPERATIONS</p>
            <h1 className="admin-h1">Admin Dashboard</h1>
            <p className="admin-muted">
              Central command for orders, payments, subscribers, and support inbox. Monitor live metrics and take quick actions.
            </p>
          </div>
          <div className="admin-quick-actions">
            <Link className="btn btn-primary" href="/admin/orders">
              Review Orders
            </Link>
            <Link className="btn" href="/admin/inbox">
              Open Inbox
            </Link>
            <Link className="btn" href="/admin/catalog">
              Manage Catalog
            </Link>
          </div>
        </div>

        <div className="admin-kpi-grid">
          {cards.map((card) => (
            <article key={card.label} className={`admin-kpi-card admin-tone-${card.tone}`}>
              <div className="admin-kpi-label">{card.label}</div>
              <div className="admin-kpi-value">{card.value}</div>
              <div className="admin-kpi-hint">{card.hint}</div>
            </article>
          ))}
        </div>
      </section>
    </RequireAdmin>
  );
}
