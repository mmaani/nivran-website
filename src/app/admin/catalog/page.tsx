import { db } from "@/lib/db";
import { ensureCatalogTables } from "@/lib/catalog";
import { getAdminLang } from "@/lib/admin-lang";

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

export default async function AdminCatalogPage() {
  await ensureCatalogTables();
  const lang = await getAdminLang();

  const L =
    lang === "ar"
      ? {
          title: "الكتالوج",
          sub: "إدارة المنتجات والمخزون والأسعار والخصومات والعروض في مكان واحد.",
          addProduct: "إضافة / تحديث منتج",
          saveProduct: "حفظ المنتج",
          products: "المنتجات والمخزون",
          addPromo: "إضافة عرض",
          savePromo: "حفظ العرض",
          promos: "العروض",
          slug: "المعرّف (Slug)",
          name: "الاسم",
          price: "السعر",
          inv: "المخزون",
          status: "الحالة",
          actions: "إجراءات",
          active: "نشط",
          hidden: "مخفي",
          update: "تحديث",
          del: "حذف",
          save: "حفظ",
          noProducts: "لا توجد منتجات بعد.",
          noPromos: "لا توجد عروض بعد.",
          // placeholders
          ph_slug: "المعرّف (مثل nivran-calm-100ml)",
          ph_price: "السعر (JOD)",
          ph_name_en: "الاسم (EN)",
          ph_name_ar: "الاسم (AR)",
          ph_compare: "سعر قبل الخصم (اختياري)",
          ph_qty: "الكمية",
          ph_desc_en: "وصف (EN)",
          ph_desc_ar: "وصف (AR)",
          ph_code: "كود العرض (مثل RAMADAN10)",
          ph_disc: "قيمة الخصم",
          ph_limit: "حد الاستخدام (اختياري)",
          ph_title_en: "العنوان (EN)",
          ph_title_ar: "العنوان (AR)",
          percent: "نسبة %",
          fixed: "مبلغ ثابت (JOD)",
          was: "كان",
        }
      : {
          title: "Catalog",
          sub: "Manage products, inventory, prices, discounts, and promotions in one place.",
          addProduct: "Add / Update Product",
          saveProduct: "Save product",
          products: "Products & Inventory",
          addPromo: "Add Promotion",
          savePromo: "Save promotion",
          promos: "Promotions",
          slug: "Slug",
          name: "Name",
          price: "Price",
          inv: "Inventory",
          status: "Status",
          actions: "Actions",
          active: "Active",
          hidden: "Hidden",
          update: "Update",
          del: "Delete",
          save: "Save",
          noProducts: "No products yet.",
          noPromos: "No promotions yet.",
          // placeholders
          ph_slug: "slug (e.g. nivran-calm-100ml)",
          ph_price: "price (JOD)",
          ph_name_en: "English name",
          ph_name_ar: "Arabic name",
          ph_compare: "compare at price (optional)",
          ph_qty: "inventory qty",
          ph_desc_en: "English description",
          ph_desc_ar: "Arabic description",
          ph_code: "Promo code (e.g. RAMADAN10)",
          ph_disc: "Discount value",
          ph_limit: "Usage limit (optional)",
          ph_title_en: "Title EN",
          ph_title_ar: "Title AR",
          percent: "Percent %",
          fixed: "Fixed JOD",
          was: "was",
        };

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

  return (
    <div className="admin-grid">
      <div>
        <h1 className="admin-h1">{L.title}</h1>
        <p className="admin-muted">{L.sub}</p>
      </div>

      <section className="admin-card">
        <h2 style={{ marginTop: 0 }}>{L.addProduct}</h2>
        <form action="/api/admin/catalog/products" method="post" className="admin-grid">
          <input type="hidden" name="action" value="create" />

          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}>
            <input name="slug" required placeholder={L.ph_slug} className="admin-input ltr" />
            <input name="price_jod" type="number" step="0.01" min="0" required placeholder={L.ph_price} className="admin-input ltr" />
            <input name="name_en" required placeholder={L.ph_name_en} className="admin-input" />
            <input name="name_ar" required placeholder={L.ph_name_ar} className="admin-input" />
            <input name="compare_at_price_jod" type="number" step="0.01" min="0" placeholder={L.ph_compare} className="admin-input ltr" />
            <input name="inventory_qty" type="number" min="0" defaultValue={0} required placeholder={L.ph_qty} className="admin-input ltr" />
            <input name="description_en" placeholder={L.ph_desc_en} className="admin-input" />
            <input name="description_ar" placeholder={L.ph_desc_ar} className="admin-input" />
          </div>

          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" name="is_active" defaultChecked /> {L.active}
          </label>

          <button className="admin-btn admin-btn-primary" style={{ width: "fit-content" }}>
            {L.saveProduct}
          </button>
        </form>
      </section>

      <section className="admin-card">
        <h2 style={{ marginTop: 0 }}>{L.products}</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{L.slug}</th>
                <th>{L.name}</th>
                <th>{L.price}</th>
                <th>{L.inv}</th>
                <th>{L.status}</th>
                <th>{L.actions}</th>
              </tr>
            </thead>
            <tbody>
              {productsRes.rows.map((p) => (
                <tr key={p.id}>
                  <td className="ltr">{p.slug}</td>
                  <td>
                    {p.name_en}
                    <br />
                    {p.name_ar}
                  </td>
                  <td className="ltr">
                    {p.price_jod} JOD{" "}
                    {p.compare_at_price_jod ? `(${L.was} ${p.compare_at_price_jod})` : ""}
                  </td>
                  <td className="ltr">{p.inventory_qty}</td>
                  <td>{p.is_active ? L.active : L.hidden}</td>
                  <td>
                    <form
                      action="/api/admin/catalog/products"
                      method="post"
                      style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}
                    >
                      <input type="hidden" name="action" value="update" />
                      <input type="hidden" name="id" value={p.id} />

                      <input
                        name="price_jod"
                        type="number"
                        step="0.01"
                        defaultValue={Number(p.price_jod || "0")}
                        className="admin-input ltr"
                        style={{ width: 120 }}
                      />

                      <input
                        name="compare_at_price_jod"
                        type="number"
                        step="0.01"
                        defaultValue={p.compare_at_price_jod ? Number(p.compare_at_price_jod) : ""}
                        placeholder={L.ph_compare}
                        className="admin-input ltr"
                        style={{ width: 160 }}
                      />

                      <input
                        name="inventory_qty"
                        type="number"
                        min="0"
                        defaultValue={p.inventory_qty}
                        className="admin-input ltr"
                        style={{ width: 120 }}
                      />

                      <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <input type="checkbox" name="is_active" defaultChecked={p.is_active} /> {L.active}
                      </label>

                      <button className="admin-btn" type="submit">
                        {L.update}
                      </button>
                    </form>

                    <form action="/api/admin/catalog/products" method="post" style={{ marginTop: 8 }}>
                      <input type="hidden" name="action" value="delete" />
                      <input type="hidden" name="id" value={p.id} />
                      <button className="admin-btn" type="submit">
                        {L.del}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}

              {productsRes.rows.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 12, opacity: 0.7 }}>
                    {L.noProducts}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-card">
        <h2 style={{ marginTop: 0 }}>{L.addPromo}</h2>
        <form action="/api/admin/catalog/promotions" method="post" className="admin-grid">
          <input type="hidden" name="action" value="create" />

          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}>
            <input name="code" required placeholder={L.ph_code} className="admin-input ltr" />
            <select name="discount_type" defaultValue="PERCENT" className="admin-select">
              <option value="PERCENT">{L.percent}</option>
              <option value="FIXED">{L.fixed}</option>
            </select>

            <input name="discount_value" type="number" min="0" step="0.01" required placeholder={L.ph_disc} className="admin-input ltr" />
            <input name="usage_limit" type="number" min="1" placeholder={L.ph_limit} className="admin-input ltr" />

            <input name="title_en" required placeholder={L.ph_title_en} className="admin-input" />
            <input name="title_ar" required placeholder={L.ph_title_ar} className="admin-input" />

            <input name="starts_at" type="datetime-local" className="admin-input ltr" />
            <input name="ends_at" type="datetime-local" className="admin-input ltr" />
          </div>

          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" name="is_active" defaultChecked /> {L.active}
          </label>

          <button className="admin-btn admin-btn-primary" style={{ width: "fit-content" }}>
            {L.savePromo}
          </button>
        </form>
      </section>

      <section className="admin-card">
        <h2 style={{ marginTop: 0 }}>{L.promos}</h2>
        <ul style={{ margin: 0, paddingInlineStart: 18 }}>
          {promosRes.rows.map((r) => (
            <li key={r.id} style={{ marginBottom: 10 }}>
              <strong className="ltr">{r.code}</strong> —{" "}
              <span className="ltr">
                {r.discount_type === "PERCENT" ? `${r.discount_value}%` : `${r.discount_value} JOD`}
              </span>{" "}
              — {r.title_en} / {r.title_ar} ({r.is_active ? L.active : L.hidden})
              <form action="/api/admin/catalog/promotions" method="post" style={{ display: "inline-flex", gap: 8, marginInlineStart: 10 }}>
                <input type="hidden" name="action" value="toggle" />
                <input type="hidden" name="id" value={r.id} />
                <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input type="checkbox" name="is_active" defaultChecked={r.is_active} /> {L.active}
                </label>
                <button className="admin-btn" type="submit">
                  {L.save}
                </button>
              </form>
            </li>
          ))}
          {promosRes.rows.length === 0 ? <li style={{ opacity: 0.7 }}>{L.noPromos}</li> : null}
        </ul>
      </section>
    </div>
  );
}
