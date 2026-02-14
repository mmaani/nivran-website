import { db } from "@/lib/db";
import { ensureCatalogTables } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProductRow = {
  id: number;
  slug: string;
  name_en: string;
  name_ar: string;
  price_jod: string;
  compare_at_price_jod: string | null;
  inventory_qty: number;
  is_active: boolean;
};

type PromoRow = {
  id: number;
  code: string;
  title_en: string;
  title_ar: string;
  discount_type: "PERCENT" | "FIXED" | string;
  discount_value: string;
  is_active: boolean;
};

function T({ en, ar }: { en: string; ar: string }) {
  return (
    <>
      <span className="t-en">{en}</span>
      <span className="t-ar">{ar}</span>
    </>
  );
}

export default async function AdminCatalogPage() {
  await ensureCatalogTables();

  const [productsRes, promosRes] = await Promise.all([
    db.query<ProductRow>(`
      select
        id,
        slug,
        coalesce(name_en,'') as name_en,
        coalesce(name_ar,'') as name_ar,
        coalesce(price_jod, 0)::text as price_jod,
        compare_at_price_jod::text as compare_at_price_jod,
        inventory_qty,
        is_active
      from products
      order by created_at desc
      limit 200
    `),
    db.query<PromoRow>(`
      select
        id,
        coalesce(code,'') as code,
        coalesce(title_en,'') as title_en,
        coalesce(title_ar,'') as title_ar,
        coalesce(discount_type,'PERCENT') as discount_type,
        coalesce(discount_value, 0)::text as discount_value,
        is_active
      from promotions
      order by created_at desc
      limit 200
    `),
  ]);

  const products = productsRes.rows || [];
  const promos = promosRes.rows || [];

  return (
    <div className="admin-grid">
      <div className="admin-card">
        <h1 className="admin-h1">
          <T en="Catalog & Promotions" ar="الكتالوج والعروض" />
        </h1>
        <p className="admin-muted">
          <T
            en="Manage products, inventory, prices, and promotion codes."
            ar="إدارة المنتجات والمخزون والأسعار وأكواد الخصم."
          />
        </p>
      </div>

      {/* Product form */}
      <section className="admin-card admin-grid">
        <h2 style={{ margin: 0 }}>
          <T en="Add / Update Product" ar="إضافة / تحديث منتج" />
        </h2>

        <form action="/api/admin/catalog/products" method="post" className="admin-grid">
          <input type="hidden" name="action" value="create" />

          <div className="admin-grid" style={{ gridTemplateColumns: "repeat(2, minmax(0,1fr))" as any }}>
            <input className="admin-input" name="slug" required placeholder="slug (e.g. nivran-calm-100ml)" />
            <input className="admin-input" name="price_jod" type="number" step="0.01" min="0" required placeholder="price (JOD)" />
            <input className="admin-input" name="name_en" required placeholder="English name" />
            <input className="admin-input" name="name_ar" required placeholder="Arabic name" />
            <input className="admin-input" name="compare_at_price_jod" type="number" step="0.01" min="0" placeholder="compare at price (optional)" />
            <input className="admin-input" name="inventory_qty" type="number" min="0" defaultValue={0} required placeholder="inventory qty" />
            <input className="admin-input" name="description_en" placeholder="English description" />
            <input className="admin-input" name="description_ar" placeholder="Arabic description" />
          </div>

          <label className="admin-row" style={{ gap: 8 }}>
            <input type="checkbox" name="is_active" defaultChecked />
            <span>
              <T en="Active" ar="نشط" />
            </span>
          </label>

          <button className="btn btn-primary" style={{ width: "fit-content" }} type="submit">
            <T en="Save product" ar="حفظ المنتج" />
          </button>
        </form>
      </section>

      {/* Products table */}
      <section className="admin-card admin-grid">
        <h2 style={{ margin: 0 }}>
          <T en="Products & Inventory" ar="المنتجات والمخزون" />
        </h2>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th><T en="Slug" ar="المعرف" /></th>
                <th><T en="Name" ar="الاسم" /></th>
                <th><T en="Price" ar="السعر" /></th>
                <th><T en="Inventory" ar="المخزون" /></th>
                <th><T en="Status" ar="الحالة" /></th>
                <th><T en="Actions" ar="إجراءات" /></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td className="mono">{p.slug}</td>
                  <td>
                    {p.name_en}
                    <br />
                    {p.name_ar}
                  </td>
                  <td>
                    {p.price_jod} JOD{" "}
                    {p.compare_at_price_jod ? (
                      <span style={{ opacity: 0.75 }}>
                        <T en={`(was ${p.compare_at_price_jod})`} ar={`(السابق ${p.compare_at_price_jod})`} />
                      </span>
                    ) : null}
                  </td>
                  <td>{p.inventory_qty}</td>
                  <td>
                    {p.is_active ? <T en="Active" ar="نشط" /> : <T en="Hidden" ar="مخفي" />}
                  </td>
                  <td>
                    <form action="/api/admin/catalog/products" method="post" className="admin-row" style={{ gap: 8 }}>
                      <input type="hidden" name="action" value="update" />
                      <input type="hidden" name="id" value={p.id} />

                      <input className="admin-input" name="price_jod" type="number" step="0.01" defaultValue={p.price_jod} style={{ width: 110 }} />
                      <input className="admin-input" name="compare_at_price_jod" type="number" step="0.01" defaultValue={p.compare_at_price_jod ?? ""} placeholder="compare" style={{ width: 110 }} />
                      <input className="admin-input" name="inventory_qty" type="number" min="0" defaultValue={p.inventory_qty} style={{ width: 110 }} />

                      <label className="admin-row" style={{ gap: 6 }}>
                        <input type="checkbox" name="is_active" defaultChecked={p.is_active} />
                        <span><T en="Active" ar="نشط" /></span>
                      </label>

                      <button className="btn btn-primary" type="submit">
                        <T en="Update" ar="تحديث" />
                      </button>
                    </form>

                    <form action="/api/admin/catalog/products" method="post" style={{ marginTop: 8 }}>
                      <input type="hidden" name="action" value="delete" />
                      <input type="hidden" name="id" value={p.id} />
                      <button className="btn" type="submit">
                        <T en="Delete" ar="حذف" />
                      </button>
                    </form>
                  </td>
                </tr>
              ))}

              {products.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 14, opacity: 0.7 }}>
                    <T en="No products yet." ar="لا توجد منتجات بعد." />
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {/* Promotion form */}
      <section className="admin-card admin-grid">
        <h2 style={{ margin: 0 }}>
          <T en="Add Promotion" ar="إضافة عرض" />
        </h2>

        <form action="/api/admin/catalog/promotions" method="post" className="admin-grid">
          <input type="hidden" name="action" value="create" />

          <div className="admin-grid" style={{ gridTemplateColumns: "repeat(2, minmax(0,1fr))" as any }}>
            <input className="admin-input" name="code" required placeholder="Promo code (e.g. RAMADAN10)" />
            <select className="admin-select" name="discount_type" defaultValue="PERCENT">
              <option value="PERCENT">Percent %</option>
              <option value="FIXED">Fixed JOD</option>
            </select>

            <input className="admin-input" name="discount_value" type="number" min="0" step="0.01" required placeholder="Discount value" />
            <input className="admin-input" name="usage_limit" type="number" min="1" placeholder="Usage limit (optional)" />

            <input className="admin-input" name="title_en" required placeholder="Title EN" />
            <input className="admin-input" name="title_ar" required placeholder="Title AR" />

            <input className="admin-input" name="starts_at" type="datetime-local" />
            <input className="admin-input" name="ends_at" type="datetime-local" />
          </div>

          <label className="admin-row" style={{ gap: 8 }}>
            <input type="checkbox" name="is_active" defaultChecked />
            <span><T en="Active" ar="نشط" /></span>
          </label>

          <button className="btn btn-primary" style={{ width: "fit-content" }} type="submit">
            <T en="Save promotion" ar="حفظ العرض" />
          </button>
        </form>
      </section>

      {/* Promotions list */}
      <section className="admin-card admin-grid">
        <h2 style={{ margin: 0 }}>
          <T en="Promotions" ar="العروض" />
        </h2>

        <ul style={{ margin: 0, paddingInlineStart: 18 }}>
          {promos.map((r) => (
            <li key={r.id} style={{ marginBottom: 10 }}>
              <strong>{r.code}</strong>{" "}
              —{" "}
              {r.discount_type === "PERCENT" ? `${r.discount_value}%` : `${r.discount_value} JOD`}
              {" — "}
              {r.title_en} / {r.title_ar}
              {" — "}
              {r.is_active ? <T en="Active" ar="نشط" /> : <T en="Inactive" ar="غير نشط" />}

              <form action="/api/admin/catalog/promotions" method="post" className="admin-row" style={{ gap: 10, marginTop: 8 }}>
                <input type="hidden" name="action" value="toggle" />
                <input type="hidden" name="id" value={r.id} />

                <label className="admin-row" style={{ gap: 6 }}>
                  <input type="checkbox" name="is_active" defaultChecked={r.is_active} />
                  <span><T en="Active" ar="نشط" /></span>
                </label>

                <button className="btn btn-primary" type="submit">
                  <T en="Save" ar="حفظ" />
                </button>
              </form>
            </li>
          ))}

          {promos.length === 0 ? (
            <li style={{ opacity: 0.7 }}>
              <T en="No promotions yet." ar="لا توجد عروض بعد." />
            </li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
