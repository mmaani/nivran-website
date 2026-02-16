import Link from "next/link";
import { db } from "@/lib/db";
import { ensureOrdersTables } from "@/lib/orders";
import { ensureInboxTables } from "@/lib/inbox";
import { getAdminLang } from "@/lib/admin-lang";
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
  await Promise.all([ensureOrdersTables(), ensureInboxTables()]);

  const [totalOrders, paidOrders, pendingPayment, failedOrCanceled, subscribers, messages, callbacks, revenue] =
    await Promise.all([
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
  const [s, lang] = await Promise.all([getStats(), getAdminLang()]);
  const ar = lang === "ar";

  const cards = [
    { label: ar ? "إجمالي الطلبات" : "Total orders", value: s.totalOrders, hint: ar ? "منذ البداية" : "All-time", tone: "indigo" },
    { label: ar ? "الإيراد" : "Revenue", value: `${s.revenueJod.toFixed(2)} JOD`, hint: ar ? "مدفوع + COD" : "Paid + COD paid", tone: "gold" },
    { label: ar ? "طلبات مدفوعة" : "Paid orders", value: s.paidOrders, hint: ar ? "مدفوعات مؤكدة" : "Confirmed payments", tone: "green" },
    { label: ar ? "بانتظار الدفع" : "Pending payment", value: s.pendingPayment, hint: ar ? "تحتاج متابعة" : "Need callback/reconcile", tone: "amber" },
    { label: ar ? "فشل / إلغاء" : "Failed / canceled", value: s.failedOrCanceled, hint: ar ? "تحتاج متابعة" : "Needs follow-up", tone: "rose" },
    { label: ar ? "المشتركون" : "Subscribers", value: s.subscribers, hint: ar ? "قائمة النشرة" : "Newsletter list", tone: "indigo" },
    { label: ar ? "الرسائل" : "Messages", value: s.messages, hint: ar ? "رسائل التواصل" : "Contact submissions", tone: "green" },
    { label: ar ? "إشعارات PayTabs" : "PayTabs callbacks", value: s.callbacks, hint: ar ? "أحداث البوابة" : "Gateway events", tone: "amber" },
  ] as const;

  return (
    <RequireAdmin>
      <section className="admin-page">
        <div className="admin-dashboard-hero admin-card">
          <div>
            <p className="admin-kicker">{ar ? "تشغيل NIVRAN" : "NIVRAN OPERATIONS"}</p>
            <h1 className="admin-h1">{ar ? "لوحة الإدارة" : "Admin Dashboard"}</h1>
            <p className="admin-muted">
              {ar
                ? "مركز موحد للطلبات، المدفوعات، المشتركين، ورسائل الدعم مع إجراءات سريعة."
                : "Central command for orders, payments, subscribers, and support inbox with quick actions."}
            </p>
          </div>
          <div className="admin-quick-actions">
            <Link className="btn btn-primary" href="/admin/orders">
              {ar ? "مراجعة الطلبات" : "Review Orders"}
            </Link>
            <Link className="btn" href="/admin/inbox">
              {ar ? "فتح الوارد" : "Open Inbox"}
            </Link>
            <Link className="btn" href="/admin/catalog">
              {ar ? "إدارة الكتالوج" : "Manage Catalog"}
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
