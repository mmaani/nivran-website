import Link from "next/link";
import { db } from "@/lib/db";
import { ensureOrdersTables } from "@/lib/orders";
import { ensureInboxTables } from "@/lib/inbox";
import { getAdminLang } from "@/lib/admin-lang";
import RequireAdmin from "./_components/RequireAdmin";

type CountRow = { count: string };
type RevenueRow = { total: string | null };

type RecentOrderRow = {
  id: number;
  cart_id: string;
  status: string;
  amount: string;
  currency: string;
  created_at: string;
};

type RecentContactRow = {
  id: number;
  name: string;
  email: string;
  subject: string | null;
  created_at: string;
};

type RecentCallbackRow = {
  id: number;
  cart_id: string | null;
  tran_ref: string | null;
  signature_valid: boolean;
  created_at: string;
};

type DashboardStats = {
  totalOrders: number;
  paidOrders: number;
  pendingPayment: number;
  failedOrCanceled: number;
  subscribers: number;
  messages: number;
  callbacks: number;
  revenueJod: number;
  recentOrders: RecentOrderRow[];
  recentContacts: RecentContactRow[];
  recentCallbacks: RecentCallbackRow[];
};

function toNum(v: string | null | undefined): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

async function getStats(): Promise<DashboardStats> {
  await Promise.all([ensureOrdersTables(), ensureInboxTables()]);

  const [
    totalOrders,
    paidOrders,
    pendingPayment,
    failedOrCanceled,
    subscribers,
    messages,
    callbacks,
    revenue,
    recentOrders,
    recentContacts,
    recentCallbacks,
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
    db.query<RecentOrderRow>(
      `select id, cart_id, status, amount::text, currency, created_at::text
       from orders
       order by created_at desc
       limit 6`
    ),
    db.query<RecentContactRow>(
      `select id, name, email, subject, created_at::text
       from contact_submissions
       order by created_at desc
       limit 5`
    ),
    db.query<RecentCallbackRow>(
      `select id, cart_id, tran_ref, signature_valid, created_at::text
       from paytabs_callbacks
       order by created_at desc
       limit 5`
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
    recentOrders: recentOrders.rows,
    recentContacts: recentContacts.rows,
    recentCallbacks: recentCallbacks.rows,
  };
}

function fmtDate(value: string, locale: "en" | "ar"): string {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-JO" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(dt);
}

export default async function AdminDashboardPage() {
  const [s, lang] = await Promise.all([getStats(), getAdminLang()]);
  const ar = lang === "ar";

  const cards = [
    { label: ar ? "إجمالي الطلبات" : "Total orders", value: s.totalOrders, hint: ar ? "منذ البداية" : "All-time", tone: "indigo" },
    { label: ar ? "الإيراد" : "Revenue", value: `${s.revenueJod.toFixed(2)} JOD`, hint: ar ? "مدفوع + COD" : "Paid + COD paid", tone: "gold" },
    { label: ar ? "طلبات مدفوعة" : "Paid orders", value: s.paidOrders, hint: ar ? "مدفوعات مؤكدة" : "Confirmed payments", tone: "green" },
    { label: ar ? "بانتظار الدفع" : "Pending payment", value: s.pendingPayment, hint: ar ? "تحتاج متابعة" : "Needs reconciliation", tone: "amber" },
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
            <h1 className="admin-h1">{ar ? "لوحة التحكم" : "Admin Dashboard"}</h1>
            <p className="admin-muted">
              {ar
                ? "مركز موحّد لمتابعة الطلبات والمدفوعات والرسائل مع قرارات سريعة لفريق العمليات."
                : "Unified command center for order health, payment flow, and customer communication."}
            </p>
          </div>
          <div className="admin-quick-actions">
            <Link className="btn btn-primary" href="/admin/catalog">
              {ar ? "إضافة منتج" : "Add product"}
            </Link>
            <Link className="btn" href="/admin/orders">
              {ar ? "أحدث الطلبات" : "Latest orders"}
            </Link>
            <Link className="btn" href="/admin/inbox">
              {ar ? "صندوق الوارد" : "Inbox"}
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

        <div className="admin-dashboard-columns">
          <article className="admin-card">
            <div className="admin-row" style={{ justifyContent: "space-between" }}>
              <h2 className="admin-section-title">{ar ? "أحدث الطلبات" : "Recent orders"}</h2>
              <Link href="/admin/orders" className="admin-inline-link">
                {ar ? "عرض الكل" : "View all"}
              </Link>
            </div>
            <div className="admin-list">
              {s.recentOrders.length === 0 ? (
                <p className="admin-muted">{ar ? "لا توجد طلبات حديثة." : "No recent orders."}</p>
              ) : (
                s.recentOrders.map((order) => (
                  <div className="admin-list-item" key={order.id}>
                    <div>
                      <p className="admin-list-title mono">#{order.id} · {order.cart_id}</p>
                      <p className="admin-list-meta">{fmtDate(order.created_at, lang)}</p>
                    </div>
                    <div style={{ textAlign: ar ? "left" : "right" }}>
                      <p className="admin-list-title">{order.status}</p>
                      <p className="admin-list-meta mono">{Number(order.amount).toFixed(2)} {order.currency}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="admin-card">
            <h2 className="admin-section-title">{ar ? "آخر النشاط" : "Recent activity"}</h2>
            <div className="admin-activity-grid">
              <div>
                <p className="admin-mini-title">{ar ? "رسائل جديدة" : "Latest messages"}</p>
                {s.recentContacts.length === 0 ? (
                  <p className="admin-muted">{ar ? "لا توجد رسائل." : "No messages yet."}</p>
                ) : (
                  s.recentContacts.map((msg) => (
                    <div className="admin-list-item compact" key={msg.id}>
                      <div>
                        <p className="admin-list-title">{msg.name}</p>
                        <p className="admin-list-meta ltr">{msg.email}</p>
                      </div>
                      <p className="admin-list-meta">{msg.subject || (ar ? "بدون عنوان" : "No subject")}</p>
                    </div>
                  ))
                )}
              </div>

              <div>
                <p className="admin-mini-title">{ar ? "آخر إشعارات PayTabs" : "Latest PayTabs callbacks"}</p>
                {s.recentCallbacks.length === 0 ? (
                  <p className="admin-muted">{ar ? "لا توجد إشعارات." : "No callbacks yet."}</p>
                ) : (
                  s.recentCallbacks.map((cb) => (
                    <div className="admin-list-item compact" key={cb.id}>
                      <div>
                        <p className="admin-list-title mono">{cb.tran_ref || "—"}</p>
                        <p className="admin-list-meta mono">{cb.cart_id || "—"}</p>
                      </div>
                      <span className="badge">{cb.signature_valid ? (ar ? "توقيع صحيح" : "Valid sig") : ar ? "توقيع غير صالح" : "Invalid sig"}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </article>
        </div>
      </section>
    </RequireAdmin>
  );
}
