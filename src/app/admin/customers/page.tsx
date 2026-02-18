import Link from "next/link";
import { getAdminLang } from "@/lib/admin-lang";
import { fetchAdminCustomers } from "@/lib/adminCustomers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toInt(v: string | undefined, fallback: number): number {
  const n = Number(v || fallback);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const lang = await getAdminLang();
  const query = (await searchParams) || {};

  const pageRaw = Array.isArray(query.page) ? query.page[0] : query.page;
  const pageSizeRaw = Array.isArray(query.pageSize) ? query.pageSize[0] : query.pageSize;

  const scopeRaw = Array.isArray(query.scope) ? query.scope[0] : query.scope;

  const page = Math.max(1, toInt(pageRaw, 1));
  const pageSize = [25, 50, 100].includes(toInt(pageSizeRaw, 25)) ? toInt(pageSizeRaw, 25) : 25;
  const exportScope = String(scopeRaw || "page").toLowerCase() === "all" ? "all" : "page";

  const data = await fetchAdminCustomers(page, pageSize);
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  const L =
    lang === "ar"
      ? {
          title: "العملاء",
          sub: "عرض بيانات العملاء وملخص المشتريات.",
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
          prev: "السابق",
          next: "التالي",
          export: "تصدير Excel",
          pageSize: "عدد الصفوف",
          page: "الصفحة",
          exportScope: "نطاق التصدير",
          exportPage: "الصفحة الحالية",
          exportAll: "كل العملاء",
        }
      : {
          title: "Customers",
          sub: "Shows customer contact/location + purchase history summary.",
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
          prev: "Previous",
          next: "Next",
          export: "Export Excel",
          pageSize: "Rows",
          page: "Page",
          exportScope: "Export scope",
          exportPage: "Current page",
          exportAll: "All customers",
        };

  return (
    <div className="admin-grid">
      <div className="admin-card">
        <h1 className="admin-h1">{L.title}</h1>
        <p className="admin-muted">{L.sub}</p>

        <div className="admin-row" style={{ justifyContent: "space-between", marginTop: 12 }}>
          <form method="get" className="admin-row">
            <input type="hidden" name="page" value="1" />
            <label htmlFor="pageSize" className="admin-muted" style={{ fontSize: 13 }}>
              {L.pageSize}
            </label>
            <select id="pageSize" name="pageSize" className="admin-select" defaultValue={String(data.pageSize)} style={{ width: 120 }}>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
            <button className="btn" type="submit">Apply</button>
          </form>

          <form method="get" className="admin-row">
            <input type="hidden" name="page" value={String(data.page)} />
            <input type="hidden" name="pageSize" value={String(data.pageSize)} />
            <label htmlFor="scope" className="admin-muted" style={{ fontSize: 13 }}>
              {L.exportScope}
            </label>
            <select id="scope" name="scope" className="admin-select" defaultValue={exportScope} style={{ width: 170 }}>
              <option value="page">{L.exportPage}</option>
              <option value="all">{L.exportAll}</option>
            </select>
            <button className="btn" type="submit">Apply</button>
            <a className="btn" href={`/api/admin/customers/export?scope=${exportScope}&page=${data.page}&pageSize=${data.pageSize}`}>
              {L.export}
            </a>
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
                <td>{x.last_order_at ? new Date(x.last_order_at).toLocaleString() : L.na}</td>
                <td>{new Date(x.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="admin-row" style={{ justifyContent: "space-between" }}>
        <span className="admin-muted">{L.page} {data.page} / {totalPages}</span>
        <div className="admin-row">
          {data.page > 1 ? (
            <Link className="btn" href={`/admin/customers?page=${data.page - 1}&pageSize=${data.pageSize}`}>
              {L.prev}
            </Link>
          ) : (
            <button className="btn" type="button" disabled>{L.prev}</button>
          )}

          {data.page < totalPages ? (
            <Link className="btn" href={`/admin/customers?page=${data.page + 1}&pageSize=${data.pageSize}`}>
              {L.next}
            </Link>
          ) : (
            <button className="btn" type="button" disabled>{L.next}</button>
          )}
        </div>
      </div>
    </div>
  );
}
