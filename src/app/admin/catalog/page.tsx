import { db } from "@/lib/db";
import { ensureCatalogTables } from "@/lib/catalog";
import { getAdminLang } from "@/lib/admin-lang";
import styles from "./page.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CategoryRow = {
  key: string;
  name_en: string;
  name_ar: string;
  sort_order: number;
  is_active: boolean;
  is_promoted: boolean;
};

type ProductRow = {
  id: number;
  slug: string;
  name_en: string;
  name_ar: string;
  price_jod: string;
  compare_at_price_jod: string | null;
  inventory_qty: number;
  category_key: string;
  is_active: boolean;
  image_count: number;
};

type PromoRow = {
  id: number;
  code: string;
  title_en: string;
  title_ar: string;
  discount_type: "PERCENT" | "FIXED" | string;
  discount_value: string;
  is_active: boolean;
  category_keys: string[] | null;
};

function labelCategory(lang: "en" | "ar", c: CategoryRow) {
  return lang === "ar" ? c.name_ar : c.name_en;
}

export default async function AdminCatalogPage() {
  await ensureCatalogTables();
  const lang = await getAdminLang();

  const L =
    lang === "ar"
      ? {
          title: "الكتالوج",
          sub: "إدارة المنتجات والمخزون والأسعار والخصومات والعروض في مكان واحد.",
          categories: "الفئات",
          addCategory: "إضافة / تحديث فئة",
          saveCategory: "حفظ الفئة",
          catKey: "مفتاح الفئة (Key)",
          catNameEn: "الاسم (EN)",
          catNameAr: "الاسم (AR)",
          catSort: "الترتيب",
          catActive: "مفعّل",
          catPromoted: "مُروّج",
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
          active: "مفعّل",
          hidden: "مخفي",
          update: "تحديث",
          del: "حذف",
          noProducts: "لا توجد منتجات بعد.",
          was: "كان",
          ph_slug: "مثال: nivran-fresh-01",
          ph_name_en: "اسم المنتج بالإنجليزية",
          ph_name_ar: "اسم المنتج بالعربية",
          ph_desc_en: "وصف (EN) اختياري",
          ph_desc_ar: "وصف (AR) اختياري",
          ph_compare: "سعر قبل الخصم (اختياري)",
          cat: "الفئة",
          images: "صور",
          uploadImages: "رفع صور (استبدال)",
          imageHelp: "حد أقصى 5 صور لكل منتج. رفع جديد سيستبدل الصور القديمة.",
          addPromoCats: "تطبيق العرض على الفئات",
          allCats: "كل الفئات",
          ph_code: "كود (مثل NIVRAN10)",
          percent: "نسبة %",
          fixed: "مبلغ ثابت",
          ph_disc: "قيمة الخصم",
          ph_limit: "حد الاستخدام (اختياري)",
          ph_title_en: "عنوان العرض (EN)",
          ph_title_ar: "عنوان العرض (AR)",
          promoCatsLabel: "الفئات",
        }
      : {
          title: "Catalog",
          sub: "Manage products, inventory, pricing, discounts & promotions in one place.",
          categories: "Categories",
          addCategory: "Add / Update Category",
          saveCategory: "Save category",
          catKey: "Category key",
          catNameEn: "Name (EN)",
          catNameAr: "Name (AR)",
          catSort: "Sort",
          catActive: "Active",
          catPromoted: "Promoted",
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
          noProducts: "No products yet.",
          was: "was",
          ph_slug: "e.g. nivran-fresh-01",
          ph_name_en: "Product name (EN)",
          ph_name_ar: "Product name (AR)",
          ph_desc_en: "Description (EN) optional",
          ph_desc_ar: "Description (AR) optional",
          ph_compare: "Compare at price (optional)",
          cat: "Category",
          images: "Images",
          uploadImages: "Upload images (replace)",
          imageHelp: "Max 5 images per product. Upload will replace existing images.",
          addPromoCats: "Apply promo to categories",
          allCats: "All categories",
          ph_code: "Code (e.g. NIVRAN10)",
          percent: "Percent",
          fixed: "Fixed",
          ph_disc: "Discount value",
          ph_limit: "Usage limit (optional)",
          ph_title_en: "Promotion title (EN)",
          ph_title_ar: "Promotion title (AR)",
          promoCatsLabel: "Categories",
        };

  const categoriesRes = await db.query<CategoryRow>(
    `select key, name_en, name_ar, sort_order, is_active, is_promoted
       from categories
      order by sort_order asc, key asc`
  );

  const productsRes = await db.query<ProductRow>(
    `select p.id,
            p.slug,
            p.name_en,
            p.name_ar,
            p.price_jod::text as price_jod,
            p.compare_at_price_jod::text as compare_at_price_jod,
            p.inventory_qty,
            p.category_key,
            p.is_active,
            coalesce((select count(*) from product_images pi where pi.product_id=p.id), 0)::int as image_count
       from products p
      order by p.created_at desc
      limit 500`
  );

  const promosRes = await db.query<PromoRow>(
    `select id, code, title_en, title_ar, discount_type, discount_value::text as discount_value, is_active, category_keys
       from promotions
      order by created_at desc
      limit 200`
  );

  const byKey = new Map<string, CategoryRow>();
  for (const c of categoriesRes.rows) byKey.set(c.key, c);

  return (
    <main className={`${styles.adminPage} ${lang === "ar" ? styles.rtl : ""}`}>
      <header className={styles.adminHeader}>
        <div>
          <h1 style={{ margin: 0 }}>{L.title}</h1>
          <p style={{ margin: "6px 0 0", opacity: 0.8 }}>{L.sub}</p>
        </div>
      </header>

      <section className={styles.adminCard}>
        <h2 style={{ marginTop: 0 }}>{L.categories}</h2>

        <form action="/api/admin/catalog/categories" method="post" className={styles.adminGrid}>
          <input type="hidden" name="action" value="create" />
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(4,minmax(0,1fr))" }}>
            <input name="key" required placeholder={L.catKey} className={`${styles.adminInput} ${styles.ltr}`} />
            <input name="name_en" required placeholder={L.catNameEn} className={styles.adminInput} />
            <input name="name_ar" required placeholder={L.catNameAr} className={styles.adminInput} />
            <input name="sort_order" type="number" placeholder={L.catSort} className={`${styles.adminInput} ${styles.ltr}`} />
          </div>

          <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input type="checkbox" name="is_active" defaultChecked /> {L.catActive}
            </label>
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input type="checkbox" name="is_promoted" defaultChecked /> {L.catPromoted}
            </label>
          </div>

          <button className={`${styles.adminBtn} ${styles.adminBtnPrimary}`} style={{ width: "fit-content" }}>
            {L.saveCategory}
          </button>
        </form>

        <div className={styles.adminTableWrap} style={{ marginTop: 14 }}>
          <table className={styles.adminTable}>
            <thead>
              <tr>
                <th className={styles.ltr}>{L.catKey}</th>
                <th>{L.catNameEn}</th>
                <th>{L.catNameAr}</th>
                <th className={styles.ltr}>{L.catSort}</th>
                <th>{L.catActive}</th>
                <th>{L.catPromoted}</th>
                <th>{L.actions}</th>
              </tr>
            </thead>
            <tbody>
              {categoriesRes.rows.map((c) => (
                <tr key={c.key}>
                  <td className={styles.ltr}>{c.key}</td>
                  <td>{c.name_en}</td>
                  <td>{c.name_ar}</td>
                  <td className={styles.ltr}>{c.sort_order}</td>
                  <td>{c.is_active ? "✓" : "—"}</td>
                  <td>{c.is_promoted ? "✓" : "—"}</td>
                  <td>
                    <form
                      action="/api/admin/catalog/categories"
                      method="post"
                      style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}
                    >
                      <input type="hidden" name="action" value="update" />
                      <input type="hidden" name="key" value={c.key} />

                      <input name="name_en" defaultValue={c.name_en} className={styles.adminInput} style={{ width: 180 }} />
                      <input name="name_ar" defaultValue={c.name_ar} className={styles.adminInput} style={{ width: 180 }} />
                      <input
                        name="sort_order"
                        type="number"
                        defaultValue={c.sort_order}
                        className={`${styles.adminInput} ${styles.ltr}`}
                        style={{ width: 110 }}
                      />

                      <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <input type="checkbox" name="is_active" defaultChecked={c.is_active} /> {L.catActive}
                      </label>
                      <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <input type="checkbox" name="is_promoted" defaultChecked={c.is_promoted} /> {L.catPromoted}
                      </label>

                      <button className={styles.adminBtn} type="submit">
                        {L.update}
                      </button>
                    </form>

                    <form action="/api/admin/catalog/categories" method="post" style={{ marginTop: 8 }}>
                      <input type="hidden" name="action" value="delete" />
                      <input type="hidden" name="key" value={c.key} />
                      <button className={styles.adminBtn} type="submit">
                        {L.del}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {categoriesRes.rows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 12, opacity: 0.7 }}>
                    —
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.adminCard}>
        <h2 style={{ marginTop: 0 }}>{L.addProduct}</h2>

        <form action="/api/admin/catalog/products" method="post" className={styles.adminGrid}>
          <input type="hidden" name="action" value="create" />

          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}>
            <input name="slug" required placeholder={L.ph_slug} className={`${styles.adminInput} ${styles.ltr}`} />
            <select name="category_key" defaultValue="perfume" className={styles.adminSelect}>
              {categoriesRes.rows.map((c) => (
                <option key={c.key} value={c.key}>
                  {labelCategory(lang, c)} ({c.key})
                </option>
              ))}
            </select>

            <input name="name_en" required placeholder={L.ph_name_en} className={styles.adminInput} />
            <input name="name_ar" required placeholder={L.ph_name_ar} className={styles.adminInput} />

            <input name="price_jod" type="number" min="0" step="0.01" required placeholder={L.price} className={`${styles.adminInput} ${styles.ltr}`} />
            <input
              name="compare_at_price_jod"
              type="number"
              step="0.01"
              placeholder={L.ph_compare}
              className={`${styles.adminInput} ${styles.ltr}`}
            />

            <input name="inventory_qty" type="number" min="0" defaultValue={0} placeholder={L.inv} className={`${styles.adminInput} ${styles.ltr}`} />
            <span />
            <textarea name="description_en" placeholder={L.ph_desc_en} className={styles.adminTextarea} rows={3} />
            <textarea name="description_ar" placeholder={L.ph_desc_ar} className={styles.adminTextarea} rows={3} />
          </div>

          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" name="is_active" defaultChecked /> {L.active}
          </label>

          <button className={`${styles.adminBtn} ${styles.adminBtnPrimary}`} style={{ width: "fit-content" }}>
            {L.saveProduct}
          </button>
        </form>
      </section>

      <section className={styles.adminCard}>
        <h2 style={{ marginTop: 0 }}>{L.products}</h2>
        <div className={styles.adminTableWrap}>
          <table className={styles.adminTable}>
            <thead>
              <tr>
                <th>{L.slug}</th>
                <th>{L.name}</th>
                <th>{L.cat}</th>
                <th>{L.price}</th>
                <th>{L.inv}</th>
                <th>{L.images}</th>
                <th>{L.status}</th>
                <th>{L.actions}</th>
              </tr>
            </thead>
            <tbody>
              {productsRes.rows.map((p) => (
                <tr key={p.id}>
                  <td className={styles.ltr}>{p.slug}</td>
                  <td>
                    {p.name_en}
                    <br />
                    {p.name_ar}
                  </td>
                  <td>
                    {byKey.get(p.category_key) ? labelCategory(lang, byKey.get(p.category_key)!) : p.category_key}
                  </td>
                  <td className={styles.ltr}>
                    {p.price_jod} JOD{" "}
                    {p.compare_at_price_jod ? `(${L.was} ${p.compare_at_price_jod})` : ""}
                  </td>
                  <td className={styles.ltr}>{p.inventory_qty}</td>
                  <td className={styles.ltr}>
                    {p.image_count}/5
                    <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85 }}>{L.imageHelp}</div>
                    <form
                      action="/api/admin/catalog/product-images"
                      method="post"
                      encType="multipart/form-data"
                      style={{ display: "grid", gap: 8, marginTop: 10 }}
                    >
                      <input type="hidden" name="product_id" value={p.id} />
                      <input name="images" type="file" multiple accept="image/*" className={styles.adminInput} />
                      <button className={styles.adminBtn} type="submit" style={{ width: "fit-content" }}>
                        {L.uploadImages}
                      </button>
                    </form>
                  </td>
                  <td>{p.is_active ? L.active : L.hidden}</td>
                  <td>
                    <form
                      action="/api/admin/catalog/products"
                      method="post"
                      style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}
                    >
                      <input type="hidden" name="action" value="update" />
                      <input type="hidden" name="id" value={p.id} />

                      <select name="category_key" defaultValue={p.category_key} className={styles.adminSelect}>
                        {categoriesRes.rows.map((c) => (
                          <option key={c.key} value={c.key}>
                            {labelCategory(lang, c)} ({c.key})
                          </option>
                        ))}
                      </select>

                      <input
                        name="price_jod"
                        type="number"
                        step="0.01"
                        defaultValue={Number(p.price_jod || "0")}
                        className={`${styles.adminInput} ${styles.ltr}`}
                        style={{ width: 120 }}
                      />

                      <input
                        name="compare_at_price_jod"
                        type="number"
                        step="0.01"
                        defaultValue={p.compare_at_price_jod ? Number(p.compare_at_price_jod) : ""}
                        placeholder={L.ph_compare}
                        className={`${styles.adminInput} ${styles.ltr}`}
                        style={{ width: 160 }}
                      />

                      <input
                        name="inventory_qty"
                        type="number"
                        min="0"
                        defaultValue={p.inventory_qty}
                        className={`${styles.adminInput} ${styles.ltr}`}
                        style={{ width: 120 }}
                      />

                      <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <input type="checkbox" name="is_active" defaultChecked={p.is_active} /> {L.active}
                      </label>

                      <button className={styles.adminBtn} type="submit">
                        {L.update}
                      </button>
                    </form>

                    <form action="/api/admin/catalog/products" method="post" style={{ marginTop: 8 }}>
                      <input type="hidden" name="action" value="delete" />
                      <input type="hidden" name="id" value={p.id} />
                      <button className={styles.adminBtn} type="submit">
                        {L.del}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}

              {productsRes.rows.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 12, opacity: 0.7 }}>
                    {L.noProducts}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.adminCard}>
        <h2 style={{ marginTop: 0 }}>{L.addPromo}</h2>
        <form action="/api/admin/catalog/promotions" method="post" className={styles.adminGrid}>
          <input type="hidden" name="action" value="create" />

          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}>
            <input name="code" required placeholder={L.ph_code} className={`${styles.adminInput} ${styles.ltr}`} />
            <select name="discount_type" defaultValue="PERCENT" className={styles.adminSelect}>
              <option value="PERCENT">{L.percent}</option>
              <option value="FIXED">{L.fixed}</option>
            </select>

            <input
              name="discount_value"
              type="number"
              min="0"
              step="0.01"
              required
              placeholder={L.ph_disc}
              className={`${styles.adminInput} ${styles.ltr}`}
            />
            <input name="usage_limit" type="number" min="1" placeholder={L.ph_limit} className={`${styles.adminInput} ${styles.ltr}`} />

            <input name="title_en" required placeholder={L.ph_title_en} className={styles.adminInput} />
            <input name="title_ar" required placeholder={L.ph_title_ar} className={styles.adminInput} />

            <input name="starts_at" type="datetime-local" className={`${styles.adminInput} ${styles.ltr}`} />
            <input name="ends_at" type="datetime-local" className={`${styles.adminInput} ${styles.ltr}`} />
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 600 }}>{L.addPromoCats}</div>

            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" name="category_keys" value="__ALL__" defaultChecked /> {L.allCats}
            </label>

            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              {categoriesRes.rows.map((c) => (
                <label key={c.key} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="checkbox" name="category_keys" value={c.key} /> {labelCategory(lang, c)}
                </label>
              ))}
            </div>
          </div>

          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" name="is_active" defaultChecked /> {L.active}
          </label>

          <button className={`${styles.adminBtn} ${styles.adminBtnPrimary}`} style={{ width: "fit-content" }}>
            {L.savePromo}
          </button>
        </form>
      </section>

      <section className={styles.adminCard}>
        <h2 style={{ marginTop: 0 }}>{L.promos}</h2>
        <ul style={{ margin: 0, paddingInlineStart: 18 }}>
          {promosRes.rows.map((r) => (
            <li key={r.id} style={{ marginBottom: 10 }}>
              <strong className={styles.ltr}>{r.code}</strong> —{" "}
              <span className={styles.ltr}>
                {r.discount_type === "PERCENT" ? `${r.discount_value}%` : `${r.discount_value} JOD`}
              </span>{" "}
              — {lang === "ar" ? r.title_ar : r.title_en}
              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
                {L.promoCatsLabel}:{" "}
                {!r.category_keys || r.category_keys.length === 0
                  ? L.allCats
                  : r.category_keys.map((k) => byKey.get(k) ? labelCategory(lang, byKey.get(k)!) : k).join(", ")}
              </div>

              <form action="/api/admin/catalog/promotions" method="post" style={{ marginTop: 8 }}>
                <input type="hidden" name="action" value="toggle" />
                <input type="hidden" name="id" value={r.id} />
                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="checkbox" name="is_active" defaultChecked={r.is_active} /> {L.active}
                </label>
                <button className={styles.adminBtn} type="submit" style={{ marginTop: 8 }}>
                  {L.update}
                </button>
              </form>
            </li>
          ))}
          {promosRes.rows.length === 0 ? (
            <li style={{ opacity: 0.7 }}>—</li>
          ) : null}
        </ul>
      </section>
</main>
  );
}