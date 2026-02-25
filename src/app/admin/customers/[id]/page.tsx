import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminLang } from "@/lib/admin-lang";
import { fetchAdminCustomerDetails } from "@/lib/adminCustomers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeDateTime(value: string | null | undefined, locale?: string): string | null {
  if (!value) return null;
  const d = new Date(String(value));
  if (!Number.isFinite(d.getTime())) return null;
  return d.toLocaleString(locale);
}

function safeDate(value: string | null | undefined, locale?: string): string | null {
  if (!value) return null;
  const d = new Date(String(value));
  if (!Number.isFinite(d.getTime())) return null;
  return d.toLocaleDateString(locale);
}

function pickBackParam(q: Record<string, string | string[] | undefined>): string {
  const raw = q.back;
  if (typeof raw === "string" && raw.trim()) return raw;
  if (Array.isArray(raw) && typeof raw[0] === "string" && raw[0].trim()) return raw[0];
  return "/admin/customers";
}

export default async function AdminCustomerDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const lang = await getAdminLang();
  const isAr = lang === "ar";
  const locale = isAr ? "ar-JO" : undefined;

  const { id } = await params;
  const customerId = Number(id);
  if (!Number.isFinite(customerId) || customerId <= 0) notFound();

  const data = await fetchAdminCustomerDetails(customerId);
  if (!data.customer) notFound();

  const q = (await searchParams) || {};
  const backTo = pickBackParam(q);

  const L = isAr
    ? {
        title: "تفاصيل العميل",
        back: "رجوع",
        profile: "الملف الشخصي",
        orders: "آخر الطلبات",
        security: "الأمان والجلسات",
        id: "المعرّف",
        email: "البريد",
        name: "الاسم",
        phone: "الهاتف",
        address: "العنوان",
        created: "تاريخ الإنشاء",
        verified: "موثّق",
        unverified: "غير موثّق",
        emailVerifiedAt: "توثيق البريد",
        sessions: "جلسات",
        lastSeen: "آخر نشاط",
        expires: "انتهاء",
        none: "—",
        orderId: "رقم الطلب",
        status: "الحالة",
        total: "الإجمالي",
        createdAt: "تاريخ الطلب",
        viewOrder: "عرض",
        viewAllOrders: "عرض كل طلبات هذا العميل",
      }
    : {
        title: "Customer details",
        back: "Back",
        profile: "Profile",
        orders: "Recent orders",
        security: "Security & sessions",
        id: "ID",
        email: "Email",
        name: "Name",
        phone: "Phone",
        address: "Address",
        created: "Created",
        verified: "Verified",
        unverified: "Unverified",
        emailVerifiedAt: "Email verified",
        sessions: "Sessions",
        lastSeen: "Last seen",
        expires: "Expires",
        none: "—",
        orderId: "Order ID",
        status: "Status",
        total: "Total",
        createdAt: "Created",
        viewOrder: "View",
        viewAllOrders: "View all this customer’s orders",
      };

  const c = data.customer;

  const address = [c.address_line1, c.city, c.country].filter(Boolean).join(", ");
  const isVerified = c.email_verified_at !== null;

  // If your orders admin page supports filtering by customerId, this is ready.
  const allOrdersHref = `/admin/orders?customerId=${c.id}`;

  return (
    <div className="admin-grid">
      <div className="admin-card" style={{ display: "grid", gap: 10 }}>
        <div className="admin-row" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <p className="admin-kicker" style={{ margin: 0 }}>
              {L.title}
            </p>
            <p className="admin-muted" style={{ margin: 0 }}>
              <span className="ltr">#{c.id}</span> — <span className="ltr">{c.email}</span>
            </p>
          </div>

          <div className="admin-row" style={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
            <Link className="btn" href={backTo}>
              {L.back}
            </Link>
            <Link className="btn" href="/admin/customers">
              {isAr ? "قائمة العملاء" : "Customers list"}
            </Link>
          </div>
        </div>
      </div>

      <div className="admin-card" style={{ display: "grid", gap: 12 }}>
        <h2 style={{ margin: 0 }}>{L.profile}</h2>

        <div className="admin-row" style={{ gap: 10, flexWrap: "wrap" }}>
          <span className="admin-pill admin-pill-title">
            {L.id}: <span className="ltr">{c.id}</span>
          </span>
          <span className="admin-pill admin-pill-muted">
            {L.created}: <span className="ltr">{safeDate(c.created_at, locale) || L.none}</span>
          </span>
          <span className={`admin-pill ${isVerified ? "admin-pill-ok" : "admin-pill-warn"}`}>
            {isVerified ? L.verified : L.unverified}
          </span>
          <span className="admin-pill admin-pill-muted">
            {L.emailVerifiedAt}: <span className="ltr">{safeDateTime(c.email_verified_at, locale) || L.none}</span>
          </span>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <tbody>
              <tr>
                <th style={{ width: 180 }}>{L.email}</th>
                <td className="ltr">{c.email}</td>
              </tr>
              <tr>
                <th>{L.name}</th>
                <td>{c.full_name || L.none}</td>
              </tr>
              <tr>
                <th>{L.phone}</th>
                <td className="ltr">{c.phone || L.none}</td>
              </tr>
              <tr>
                <th>{L.address}</th>
                <td>{address || L.none}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="admin-card" style={{ display: "grid", gap: 12 }}>
        <div className="admin-row" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
          <h2 style={{ margin: 0 }}>{L.orders}</h2>
          <Link className="btn" href={allOrdersHref}>
            {L.viewAllOrders}
          </Link>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{L.orderId}</th>
                <th>{L.status}</th>
                <th>{L.total}</th>
                <th>{L.createdAt}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.orders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="admin-muted" style={{ padding: 12 }}>
                    {isAr ? "لا توجد طلبات بعد." : "No orders yet."}
                  </td>
                </tr>
              ) : (
                data.orders.map((o) => (
                  <tr key={o.id}>
                    <td className="ltr">{o.id}</td>
                    <td className="ltr">{o.status}</td>
                    <td className="ltr">{Number(o.amount_jod || 0).toFixed(2)} JOD</td>
                    <td>{safeDateTime(o.created_at, locale) || L.none}</td>
                    <td>
                      <Link className="btn" href={`/admin/orders/${o.id}`}>
                        {L.viewOrder}
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="admin-card" style={{ display: "grid", gap: 12 }}>
        <h2 style={{ margin: 0 }}>{L.security}</h2>

        <div className="admin-row" style={{ gap: 10, flexWrap: "wrap" }}>
          <span className="admin-pill admin-pill-muted">
            {L.sessions}: <span className="ltr">{data.sessions.count}</span>
          </span>
          <span className="admin-pill admin-pill-muted">
            {L.lastSeen}: <span className="ltr">{safeDateTime(data.sessions.last_seen_at, locale) || L.none}</span>
          </span>
          <span className="admin-pill admin-pill-muted">
            {L.expires}: <span className="ltr">{safeDateTime(data.sessions.max_expires_at, locale) || L.none}</span>
          </span>
        </div>

        <p className="admin-muted" style={{ margin: 0 }}>
          {isAr
            ? "يعرض هذا القسم الجلسات النشطة فقط (غير الملغاة)."
            : "This section shows active sessions only (not revoked)."}
        </p>
      </div>
    </div>
  );
}