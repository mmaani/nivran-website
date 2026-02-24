import Link from "next/link";
import { getAdminLang } from "@/lib/admin-lang";
import { fetchAdminCustomers } from "@/lib/adminCustomers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toInt(v: string | undefined, fallback: number): number {
  const n = Number(v ?? fallback);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function pickFirst(v: string | string[] | undefined): string {
  return Array.isArray(v) ? String(v[0] ?? "") : String(v ?? "");
}

function buildCustomersHref(params: { page: number; pageSize: number; scope?: "page" | "all" }) {
  const sp = new URLSearchParams();
  sp.set("page", String(params.page));
  sp.set("pageSize", String(params.pageSize));
  if (params.scope) sp.set("scope", params.scope);
  return `/admin/customers?${sp.toString()}`;
}

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const lang = await getAdminLang();
  const isAr = lang === "ar";
  const query = (await searchParams) || {};

  const pageRaw = pickFirst(query.page);
  const pageSizeRaw = pickFirst(query.pageSize);
  const scopeRaw = pickFirst(query.scope);

  const page = Math.max(1, toInt(pageRaw || undefined, 1));
  const pageSizeCandidate = toInt(pageSizeRaw || undefined, 25);
  const pageSize = [25, 50, 100].includes(pageSizeCandidate) ? pageSizeCandidate : 25;

  const exportScope: "page" | "all" = String(scopeRaw || "page").toLowerCase() === "all" ? "all" : "page";

  const data = await fetchAdminCustomers(page, pageSize);
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  const L = isAr
    ? {
        title: "العملاء",
        subtitle: "عرض بيانات العملاء وملخص المشتريات.",
        refresh: "تحديث",
        export: "تصدير Excel",
        filters: "إعدادات",
        pageSize: "عدد الصفوف",
        exportScope: "نطاق التصدير",
        exportPage: "الصفحة الحالية",
        exportAll: "كل العملاء",
        apply: "تطبيق",
        showing: "المعروض",
        total: "الإجمالي",
        page: "الصفحة",
        prev: "السابق",
        next: "التالي",
        thId: "المعرّف",
        thEmail: "البريد",
        thName: "الاسم",
        thPhone: "الهاتف",
        thAddress: "العنوان",
        thOrders: "الطلبات",
        thTotal: "إجمالي الإنفاق",
        thLast: "آخر طلب",
        thCreated: "تاريخ الإنشاء",
        na: "—",
      }
    : {
        title: "Customers",
        subtitle: "Shows customer contact/location + purchase history summary.",
        refresh: "Refresh",
        export: "Export Excel",
        filters: "Settings",
        pageSize: "Rows",
        exportScope: "Export scope",
        exportPage: "Current page",
        exportAll: "All customers",
        apply: "Apply",
        showing: "Showing",
        total: "Total",
        page: "Page",
        prev: "Previous",
        next: "Next",
        thId: "ID",
        thEmail: "Email",
        thName: "Name",
        thPhone: "Phone",
        thAddress: "Address",
        thOrders: "Orders",
        thTotal: "Total Spent",
        thLast: "Last Order",
        thCreated: "Created",
        na: "—",
      };

  const exportHref =
    exportScope === "all"
      ? `/api/admin/customers/export?scope=all`
      : `/api/admin/customers/export?scope=page&page=${data.page}&pageSize=${data.pageSize}`;

  return (
    <div className="admin-grid">
      <div className="admin-card" style={{ display: "grid", gap: 10 }}>
        <div className="admin-row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <p className="admin-kicker" style={{ margin: 0 }}>
              {L.title}
            </p>
            <p className="admin-muted" style={{ margin: 0 }}>
              {L.subtitle}
            </p>
          </div>

          <div className="admin-row" style={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
            <span className="admin-pill admin-pill-title">
              {L.showing}: <span className="ltr">{data.rows.length}</span>
            </span>
            <span className="admin-pill admin-pill-muted">
              {L.total}: <span className="ltr">{data.total}</span>
            </span>
            <Link className="btn" href={buildCustomersHref({ page: 1, pageSize: data.pageSize, scope: exportScope })}>
              {L.refresh}
            </Link>
            <a className="btn btn-primary" href={exportHref}>
              {L.export}
            </a>
          </div>
        </div>

        <div className="admin-row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <form method="get" className="admin-row" style={{ flexWrap: "wrap" }}>
            <input type="hidden" name="page" value="1" />
            <input type="hidden" name="scope" value={exportScope} />
            <label htmlFor="pageSize" className="admin-muted" style={{ fontSize: 13 }}>
              {L.pageSize}
            </label>
            <select id="pageSize" name="pageSize" className="admin-select" defaultValue={String(data.pageSize)} style={{ width: 140 }}>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
            <button className="btn" type="submit">
              {L.apply}
            </button>
          </form>

          <form method="get" className="admin-row" style={{ flexWrap: "wrap" }}>
            <input type="hidden" name="page" value={String(data.page)} />
            <input type="hidden" name="pageSize" value={String(data.pageSize)} />
            <label htmlFor="scope" className="admin-muted" style={{ fontSize: 13 }}>
              {L.exportScope}
            </label>
            <select id="scope" name="scope" className="admin-select" defaultValue={exportScope} style={{ width: 180 }}>
              <option value="page">{L.exportPage}</option>
              <option value="all">{L.exportAll}</option>
            </select>
            <button className="btn" type="submit">
              {L.apply}
            </button>
          </form>
        </div>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{L.thId}</th>
              <th>{L.thEmail}</th>
              <th>{L.thName}</th>
              <th>{L.thPhone}</th>
              <th>{L.thAddress}</th>
              <th>{L.thOrders}</th>
              <th>{L.thTotal}</th>
              <th>{L.thLast}</th>
              <th>{L.thCreated}</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((x) => (
              <tr key={x.id}>
                <td className="ltr">{x.id}</td>
                <td className="ltr">{x.email}</td>
                <td>{x.full_name || L.na}</td>
                <td className="ltr">{x.phone || L.na}</td>
                <td>{[x.address_line1, x.city, x.country].filter(Boolean).join(", ") || L.na}</td>
                <td className="ltr">{x.orders_count}</td>
                <td className="ltr">{Number(x.total_spent || 0).toFixed(2)} JOD</td>
                <td>{x.last_order_at ? new Date(x.last_order_at).toLocaleString(isAr ? "ar-JO" : undefined) : L.na}</td>
                <td>{new Date(x.created_at).toLocaleDateString(isAr ? "ar-JO" : undefined)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="admin-row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <span className="admin-muted">
          {L.page} <span className="ltr">{data.page}</span> / <span className="ltr">{totalPages}</span>
        </span>

        <div className="admin-row" style={{ flexWrap: "wrap" }}>
          {data.page > 1 ? (
            <Link className="btn" href={buildCustomersHref({ page: data.page - 1, pageSize: data.pageSize, scope: exportScope })}>
              {L.prev}
            </Link>
          ) : (
            <button className="btn" type="button" disabled>
              {L.prev}
            </button>
          )}

          {data.page < totalPages ? (
            <Link className="btn" href={buildCustomersHref({ page: data.page + 1, pageSize: data.pageSize, scope: exportScope })}>
              {L.next}
            </Link>
          ) : (
            <button className="btn" type="button" disabled>
              {L.next}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}