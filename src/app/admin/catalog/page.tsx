import Link from "next/link";
import { db, isDbConnectivityError } from "@/lib/db";
import { ensureCatalogTablesSafe } from "@/lib/catalog";
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
  description_en: string | null;
  description_ar: string | null;
  price_jod: string;
  compare_at_price_jod: string | null;
  inventory_qty: number;
  category_key: string;
  is_active: boolean;
  image_count: number;
  auto_promo_count: number;
  wear_times: string[];
  seasons: string[];
  audiences: string[];
};

type CatalogVariantRow = {
  id: number;
  product_id: number;
  product_slug: string;
  product_name_en: string;
  product_name_ar: string;
  label: string;
  size_ml: number | null;
  price_jod: string;
  compare_at_price_jod: string | null;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
};

type PromoRow = {
  id: number;
  promo_kind: "AUTO" | "CODE" | string;
  code: string | null;
  title_en: string;
  title_ar: string;
  discount_type: "PERCENT" | "FIXED" | string;
  discount_value: string;
  is_active: boolean;
  category_keys: string[] | null;
  usage_limit: number | null;
  used_count: number | null;
  min_order_jod: string | null;
  priority: number | null;
  product_slugs: string[] | null;
};

function labelCategory(lang: "en" | "ar", c: CategoryRow) {
  return lang === "ar" ? c.name_ar : c.name_en;
}


type CatalogPageData = {
  health: "db" | "fallback" | "error";
  categories: CategoryRow[];
  products: ProductRow[];
  variants: CatalogVariantRow[];
  promos: PromoRow[];
  bootstrapNote?: string;
  errorMessage?: string;
};

async function loadCatalogPageData(): Promise<CatalogPageData> {
  const bootstrap = await ensureCatalogTablesSafe();
  const bootstrapNote = bootstrap.ok ? undefined : bootstrap.reason;

  try {
    const [categoriesRes, productsRes, variantsRes, promosRes] = await Promise.all([
      db.query<CategoryRow>(
        `select key, name_en, name_ar, sort_order, is_active, is_promoted
           from categories
          order by sort_order asc, key asc`
      ),
      db.query<ProductRow>(
        `select p.id,
                p.slug,
                p.name_en,
                p.name_ar,
                p.description_en,
                p.description_ar,
                p.price_jod::text as price_jod,
                p.compare_at_price_jod::text as compare_at_price_jod,
                p.inventory_qty,
                p.category_key,
                p.is_active,
                coalesce(i.image_count,0)::int as image_count,
                coalesce(ap.auto_promo_count,0)::int as auto_promo_count,
                coalesce(p.wear_times, '{}'::text[]) as wear_times,
                coalesce(p.seasons, '{}'::text[]) as seasons,
                coalesce(p.audiences, '{}'::text[]) as audiences
           from products p
      left join (
             select product_id, count(*)::int as image_count
               from product_images
              group by product_id
           ) i on i.product_id = p.id
      left join lateral (
             select count(*)::int as auto_promo_count
               from promotions pr
              where pr.is_active=true
                and pr.promo_kind='AUTO'
                and (pr.starts_at is null or pr.starts_at <= now())
                and (pr.ends_at is null or pr.ends_at >= now())
                and (pr.category_keys is null or array_length(pr.category_keys,1) is null or p.category_key = any(pr.category_keys))
                and (pr.product_slugs is null or array_length(pr.product_slugs,1) is null or p.slug = any(pr.product_slugs))
           ) ap on true
          order by p.created_at desc
          limit 300`
      ),
      db.query<CatalogVariantRow>(
        `select v.id,
                v.product_id,
                p.slug as product_slug,
                p.name_en as product_name_en,
                p.name_ar as product_name_ar,
                v.label,
                v.size_ml,
                v.price_jod::text as price_jod,
                v.compare_at_price_jod::text as compare_at_price_jod,
                v.is_default,
                v.is_active,
                v.sort_order
           from product_variants v
           join products p on p.id=v.product_id
          order by p.created_at desc, v.sort_order asc, v.id asc
          limit 1200`
      ),
      db.query<PromoRow>(
        `select id, promo_kind, code, title_en, title_ar, discount_type, discount_value::text,
                is_active, category_keys, usage_limit, used_count, min_order_jod::text, priority, product_slugs
           from promotions
          order by created_at desc`
      ),
    ]);

    return {
      health: "db",
      categories: categoriesRes.rows,
      products: productsRes.rows,
      variants: variantsRes.rows,
      promos: promosRes.rows,
      bootstrapNote,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error || "Unknown catalog error");
    if (!isDbConnectivityError(error)) {
      return {
        health: "error",
        categories: [],
        products: [],
        variants: [],
        promos: [],
        bootstrapNote,
        errorMessage: message,
      };
    }

    return {
      health: "fallback",
      categories: [],
      products: [],
      variants: [],
      promos: [],
      bootstrapNote,
      errorMessage: message,
    };
  }
}

export default async function AdminCatalogPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const lang = await getAdminLang();
  const isAr = lang === "ar";
  const params = (await searchParams) || {};
  const saved = String(params.saved || "") === "1";
  const errorCode = String(params.error || "").trim();
  const variantError = errorCode === "invalid-variant";
  const duplicateVariantLabelError = errorCode === "duplicate-variant-label";
  const uploaded = String(params.uploaded || "") === "1";
  const data = await loadCatalogPageData();

  const L = isAr
    ? {
        title: "الكتالوج",
        sub: "إدارة المنتجات والمخزون والعروض وكوبونات الخصم.",
        addProduct: "إضافة / تحديث منتج",
        products: "المنتجات والمخزون",
        promos: "العروض والخصومات",
        addPromo: "إضافة عرض",
        categories: "الفئات",
        addCategory: "إضافة / تحديث فئة",
        saveProduct: "حفظ المنتج",
        savePromo: "حفظ العرض",
        saveCategory: "حفظ الفئة",
        active: "مفعّل",
        hidden: "مخفي",
        update: "تحديث",
        del: "حذف",
        noProducts: "لا توجد منتجات بعد.",
        noPromos: "لا توجد عروض حتى الآن.",
        code: "كود",
        percent: "نسبة %",
        fixed: "مبلغ ثابت",
        allCats: "كل الفئات",
        promoCats: "فئات العرض",
        promoUsage: "الاستخدام",
        promoMin: "حد أدنى للطلب",
        promoPriority: "الأولوية",
        promoProducts: "منتجات محددة (Slug)",
        promoType: "نوع الخصم",
        autoPromo: "تلقائي",
        codePromo: "كوبون",
        tags: "الوسوم",
        wearTime: "وقت الاستخدام",
        season: "الموسم",
        audience: "الفئة",
      }
    : {
        title: "Catalog",
        sub: "Manage products, inventory, promotions, and categories.",
        addProduct: "Add / Update Product",
        products: "Products & Inventory",
        promos: "Promotions",
        addPromo: "Add Promotion",
        categories: "Categories",
        addCategory: "Add / Update Category",
        saveProduct: "Save product",
        savePromo: "Save promotion",
        saveCategory: "Save category",
        active: "Active",
        hidden: "Hidden",
        update: "Update",
        del: "Delete",
        noProducts: "No products yet.",
        noPromos: "No promotions yet.",
        code: "Code",
        percent: "Percent",
        fixed: "Fixed",
        allCats: "All categories",
        promoCats: "Promo categories",
        promoUsage: "Usage",
        promoMin: "Min order",
        promoPriority: "Priority",
        promoProducts: "Target product slugs",
        promoType: "Type",
        autoPromo: "Automatic",
        codePromo: "Promo code",
        tags: "Tags",
        wearTime: "Wear time",
        season: "Season",
        audience: "Audience",
      };

  const byKey = new Map(data.categories.map((c) => [c.key, c]));

  const productTotal = data.products.length;
  const productActive = data.products.filter((p) => p.is_active).length;
  const outOfStockCount = data.products.filter((p) => Number(p.inventory_qty || 0) <= 0).length;
  const variantsActive = data.variants.filter((v) => v.is_active).length;
  const activeAutoPromos = data.promos.filter((r) => String(r.promo_kind || "CODE").toUpperCase() === "AUTO" && r.is_active).length;
  const activeCodePromos = data.promos.filter((r) => String(r.promo_kind || "CODE").toUpperCase() === "CODE" && r.is_active).length;
  const productsWithAutoPromo = data.products.filter((p) => Number(p.auto_promo_count || 0) > 0).length;

  const qProducts = String(params.qProducts || "").trim().toLowerCase();
  const qVariants = String(params.qVariants || "").trim().toLowerCase();
  const qPromos = String(params.qPromos || "").trim().toLowerCase();
  const productState = String(params.productState || "all").toLowerCase();
  const variantState = String(params.variantState || "all").toLowerCase();
  const promoState = String(params.promoState || "all").toLowerCase();

  const filteredProducts = data.products.filter((p) => {
    if (productState === "active" && !p.is_active) return false;
    if (productState === "inactive" && p.is_active) return false;
    if (!qProducts) return true;
    const haystack = [p.slug, p.name_en, p.name_ar, p.category_key, ...p.wear_times, ...p.seasons, ...p.audiences].join(" ").toLowerCase();
    return haystack.includes(qProducts);
  });

  const filteredVariants = data.variants.filter((v) => {
    if (variantState === "active" && !v.is_active) return false;
    if (variantState === "inactive" && v.is_active) return false;
    if (!qVariants) return true;
    const haystack = [v.product_slug, v.product_name_en, v.product_name_ar, v.label].join(" ").toLowerCase();
    return haystack.includes(qVariants);
  });

  const variantProductIds = new Set(filteredVariants.map((v) => v.product_id));
  const productsForVariantSection = qVariants || variantState !== "all"
    ? data.products.filter((p) => variantProductIds.has(p.id))
    : data.products;

  const filteredPromos = data.promos.filter((r) => {
    const kind = String(r.promo_kind || "CODE").toUpperCase();
    if (promoState === "active" && !r.is_active) return false;
    if (promoState === "inactive" && r.is_active) return false;
    if (promoState === "auto" && kind !== "AUTO") return false;
    if (promoState === "code" && kind !== "CODE") return false;
    if (!qPromos) return true;
    const haystack = [r.code || "", r.title_en, r.title_ar, ...(r.category_keys || []), ...(r.product_slugs || [])].join(" ").toLowerCase();
    return haystack.includes(qPromos);
  });

  const selectedProductIdParam = Number(params.variantProductId || 0);
  const selectedProduct = productsForVariantSection.find((p) => p.id === selectedProductIdParam)
    || productsForVariantSection[0]
    || null;
  const selectedProductVariants = selectedProduct
    ? filteredVariants.filter((v) => v.product_id === selectedProduct.id)
    : [];

  const selectedEditProductId = Number(params.productEditId || selectedProduct?.id || 0);
  const selectedEditProduct = data.products.find((p) => p.id === selectedEditProductId) || null;

  const returnQuery = new URLSearchParams();
  const carry = ["qProducts", "qVariants", "qPromos", "productState", "variantState", "promoState"] as const;
  for (const key of carry) {
    const value = String(params[key] || "").trim();
    if (value) returnQuery.set(key, value);
  }

  const buildCatalogPath = (extra?: Record<string, string | number>) => {
    const query = new URLSearchParams(returnQuery);
    if (selectedProduct) query.set("variantProductId", String(selectedProduct.id));
    if (extra) {
      for (const [key, value] of Object.entries(extra)) query.set(key, String(value));
    }
    return query.size ? `/admin/catalog?${query.toString()}` : "/admin/catalog";
  };

  const returnTo = buildCatalogPath(selectedEditProduct ? { productEditId: selectedEditProduct.id } : undefined);
  const editReturnTo = selectedEditProduct
    ? buildCatalogPath({ productEditId: selectedEditProduct.id, variantProductId: selectedEditProduct.id })
    : returnTo;

  return (
    <main className={styles.adminGrid}>
      <header className={styles.adminCard}>
        <h1 style={{ marginTop: 0 }}>{L.title}</h1>
        <p style={{ marginBottom: 0, opacity: 0.8 }}>{L.sub}</p>
        {saved ? (
          <p style={{ marginTop: 10, marginBottom: 0, color: "seagreen", fontWeight: 600 }}>
            {isAr ? "تم الحفظ بنجاح." : "Saved successfully."}
          </p>
        ) : null}
        {variantError ? (
          <p style={{ marginTop: 10, marginBottom: 0, color: "crimson", fontWeight: 600 }}>
            {isAr ? "تحقق من المتغير: الاسم والسعر مطلوبة والسعر يجب أن يكون أكبر من صفر." : "Variant validation failed: label and price are required, and price must be greater than zero."}
          </p>
        ) : null}
        {duplicateVariantLabelError ? (
          <p style={{ marginTop: 10, marginBottom: 0, color: "crimson", fontWeight: 600 }}>
            {isAr ? "يوجد متغير بنفس الاسم لهذا المنتج. يرجى اختيار اسم مختلف." : "A variant with the same label already exists for this product. Please use a different label."}
          </p>
        ) : null}
        {uploaded ? (
          <p style={{ marginTop: 10, marginBottom: 0, color: "seagreen", fontWeight: 600 }}>
            {isAr ? "تم رفع الصور بنجاح." : "Images uploaded successfully."}
          </p>
        ) : null}
        {errorCode && !variantError ? (
          <p style={{ marginTop: 10, marginBottom: 0, color: "crimson", fontWeight: 600 }}>
            {isAr ? `حدث خطأ في العملية: ${errorCode}` : `Catalog action error: ${errorCode}`}
          </p>
        ) : null}
        {data.bootstrapNote ? (
          <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>
            {isAr ? "ملاحظة: تهيئة الجداول تم تجاوزها بسبب صلاحيات قاعدة البيانات، وتم الاستمرار بالوضع المتاح." : "Note: schema bootstrap was skipped due to DB privileges; running in compatibility mode."}
          </p>
        ) : null}
      </header>

      <section className={styles.adminCard} style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))" }}>
        <div><strong>{productTotal}</strong><div className="muted">{isAr ? "إجمالي المنتجات" : "Total products"}</div></div>
        <div><strong>{productActive}</strong><div className="muted">{isAr ? "منتجات مفعلة" : "Active products"}</div></div>
        <div><strong>{outOfStockCount}</strong><div className="muted">{isAr ? "نفدت الكمية" : "Out of stock"}</div></div>
        <div><strong>{data.promos.length}</strong><div className="muted">{isAr ? "العروض" : "Promotions"}</div></div>
        <div><strong>{variantsActive}</strong><div className="muted">{isAr ? "متغيرات مفعلة" : "Active variants"}</div></div>
              <div><strong>{activeAutoPromos}</strong><div className="muted">{isAr ? "عروض تلقائية مفعلة" : "Active AUTO promos"}</div></div>
        <div><strong>{activeCodePromos}</strong><div className="muted">{isAr ? "كوبونات مفعلة" : "Active CODE promos"}</div></div>
        <div><strong>{productsWithAutoPromo}</strong><div className="muted">{isAr ? "منتجات مشمولة بعرض تلقائي" : "Products covered by AUTO"}</div></div>
      </section>
      <section className={styles.adminCard}>
        <div className={styles.anchorRow}>
          <a className={styles.anchorChip} href="#products-section">{isAr ? "المنتجات" : "Products"}</a>
          <a className={styles.anchorChip} href="#variants-section">{isAr ? "المتغيرات" : "Variants"}</a>
          <a className={styles.anchorChip} href="#promos-section">{isAr ? "العروض" : "Promotions"}</a>
          <a className={styles.anchorChip} href="#categories-section">{isAr ? "الفئات" : "Categories"}</a>
        </div>

        <div className={styles.filterGrid}>
          <form className={styles.filterForm} method="get" action="/admin/catalog">
            <input className={styles.adminInput} name="qProducts" defaultValue={qProducts} placeholder={isAr ? "بحث بالمنتجات" : "Search products"} />
            <select className={styles.adminSelect} name="productState" defaultValue={productState}>
              <option value="all">{isAr ? "كل الحالات" : "All states"}</option>
              <option value="active">{isAr ? "مفعّل" : "Active"}</option>
              <option value="inactive">{isAr ? "مخفي" : "Hidden"}</option>
            </select>
            <button className={styles.adminBtn} type="submit">{isAr ? "تصفية المنتجات" : "Filter products"}</button>
          </form>

          <form className={styles.filterForm} method="get" action="/admin/catalog">
            <input className={styles.adminInput} name="qVariants" defaultValue={qVariants} placeholder={isAr ? "بحث بالمتغيرات" : "Search variants"} />
            <select className={styles.adminSelect} name="variantState" defaultValue={variantState}>
              <option value="all">{isAr ? "كل الحالات" : "All states"}</option>
              <option value="active">{isAr ? "مفعّل" : "Active"}</option>
              <option value="inactive">{isAr ? "مخفي" : "Hidden"}</option>
            </select>
            <button className={styles.adminBtn} type="submit">{isAr ? "تصفية المتغيرات" : "Filter variants"}</button>
          </form>

          <form className={styles.filterForm} method="get" action="/admin/catalog">
            <input className={styles.adminInput} name="qPromos" defaultValue={qPromos} placeholder={isAr ? "بحث بالعروض" : "Search promotions"} />
            <select className={styles.adminSelect} name="promoState" defaultValue={promoState}>
              <option value="all">{isAr ? "كل الأنواع" : "All types"}</option>
              <option value="active">{isAr ? "مفعّل" : "Active"}</option>
              <option value="inactive">{isAr ? "مخفي" : "Hidden"}</option>
              <option value="auto">AUTO</option>
              <option value="code">CODE</option>
            </select>
            <button className={styles.adminBtn} type="submit">{isAr ? "تصفية العروض" : "Filter promotions"}</button>
          </form>
        </div>
      </section>

      {data.health === "error" ? (
        <section className={styles.adminCard} style={{ borderColor: "#b91c1c", background: "#fef2f2" }}>
          <h2 style={{ marginTop: 0 }}>{isAr ? "خطأ في تحميل الكتالوج" : "Catalog load error"}</h2>
          <p style={{ marginBottom: 0 }}>{isAr ? "تعذر تحميل بيانات الكتالوج. تم تعطيل العمليات لحين التحقق من قاعدة البيانات." : "Catalog data could not be loaded. Mutations are disabled until database issues are fixed."}</p>
          {data.errorMessage ? <p className="muted" style={{ marginTop: 8, marginBottom: 0 }}>{data.errorMessage}</p> : null}
        </section>
      ) : null}

      {data.health === "fallback" ? (
        <section className={styles.adminCard} style={{ borderColor: "#f59e0b", background: "#fffbeb" }}>
          <h2 style={{ marginTop: 0 }}>{isAr ? "وضع الطوارئ" : "Fallback mode"}</h2>
          <p style={{ marginBottom: 0 }}>
            {isAr
              ? "تعذّر تحميل بيانات الكتالوج من قاعدة البيانات حالياً. الصفحة في وضع عرض فقط حتى عودة الاتصال."
              : "Catalog data could not be loaded from the database right now. The page is in read-only mode until connectivity is restored."}
          </p>
          <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/admin" className="btn btn-outline">{isAr ? "العودة للوحة" : "Back to dashboard"}</Link>
            <Link href="/admin/catalog" className="btn">{isAr ? "إعادة المحاولة" : "Retry"}</Link>
          </div>
        </section>
      ) : null}

{data.health === "db" ? (
      <>
      <section className={styles.adminCard}>
        <h2 style={{ marginTop: 0 }}>{L.addProduct}</h2>
        <form action="/api/admin/catalog/products" method="post" className={styles.adminGrid}>
                <input type="hidden" name="return_to" value={returnTo} />
          <input type="hidden" name="action" value="create" />
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}>
            <input name="slug" required placeholder="e.g. nivran-care-hand-gel-60ml" className={`${styles.adminInput} ${styles.ltr}`} />
            <select name="category_key" defaultValue="perfume" className={styles.adminSelect}>
              {data.categories.map((c) => (
                <option key={c.key} value={c.key}>{labelCategory(lang, c)} ({c.key})</option>
              ))}
            </select>
            <input name="name_en" required placeholder="Product name (EN)" className={styles.adminInput} />
            <input name="name_ar" required placeholder="اسم المنتج (AR)" className={styles.adminInput} />
            <input name="price_jod" type="number" min="0.01" step="0.01" required placeholder="Price" className={`${styles.adminInput} ${styles.ltr}`} />
            <input name="compare_at_price_jod" type="number" step="0.01" placeholder="Compare at price" className={`${styles.adminInput} ${styles.ltr}`} />
            <input name="inventory_qty" type="number" min="0" defaultValue={0} placeholder="Inventory" className={`${styles.adminInput} ${styles.ltr}`} />
            <span />
            <textarea name="description_en" placeholder="Description (EN)" className={styles.adminTextarea} rows={3} />
            <textarea name="description_ar" placeholder="Description (AR)" className={styles.adminTextarea} rows={3} />
          </div>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(3,minmax(0,1fr))" }}>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>{L.wearTime}</div>
              <label><input type="checkbox" name="wear_times" value="day" /> Day</label>
              <label style={{ marginInlineStart: 8 }}><input type="checkbox" name="wear_times" value="night" /> Night</label>
              <label style={{ marginInlineStart: 8 }}><input type="checkbox" name="wear_times" value="anytime" /> Anytime</label>
            </div>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>{L.season}</div>
              <label><input type="checkbox" name="seasons" value="spring" /> Spring</label>
              <label style={{ marginInlineStart: 8 }}><input type="checkbox" name="seasons" value="summer" /> Summer</label>
              <label style={{ marginInlineStart: 8 }}><input type="checkbox" name="seasons" value="fall" /> Fall</label>
              <label style={{ marginInlineStart: 8 }}><input type="checkbox" name="seasons" value="winter" /> Winter</label>
              <label style={{ marginInlineStart: 8 }}><input type="checkbox" name="seasons" value="all-season" /> All-season</label>
            </div>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>{L.audience}</div>
              <label><input type="checkbox" name="audiences" value="unisex" /> Unisex</label>
              <label style={{ marginInlineStart: 8 }}><input type="checkbox" name="audiences" value="unisex-men-leaning" /> Unisex (Men-leaning)</label>
              <label style={{ marginInlineStart: 8 }}><input type="checkbox" name="audiences" value="unisex-women-leaning" /> Unisex (Women-leaning)</label>
              <label style={{ marginInlineStart: 8 }}><input type="checkbox" name="audiences" value="men" /> Men</label>
              <label style={{ marginInlineStart: 8 }}><input type="checkbox" name="audiences" value="women" /> Women</label>
            </div>
          </div>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" name="is_active" defaultChecked /> {L.active}
          </label>
          <button className={`${styles.adminBtn} ${styles.adminBtnPrimary}`} style={{ width: "fit-content" }}>{L.saveProduct}</button>
        </form>
      </section>

      <section className={styles.adminCard}>
        <h2 style={{ marginTop: 0 }}>{isAr ? "مساحة عمل المنتج" : "Product workspace"}</h2>
        <p className="muted" style={{ marginTop: -4 }}>
          {isAr ? "اختر منتجًا واحدًا لتحديث الاسم/الوصف/السعر/الوسوم دون فقدان السياق." : "Pick one product and update name/description/pricing/tags without losing your current admin context."}
        </p>
        <form method="get" action="/admin/catalog" className={styles.adminGrid} style={{ marginBottom: 12 }}>
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "minmax(0,1fr) auto" }}>
            <select name="productEditId" className={styles.adminSelect} defaultValue={selectedEditProduct ? String(selectedEditProduct.id) : ""}>
              {data.products.map((p) => (
                <option key={`edit-${p.id}`} value={p.id}>{p.slug} — {isAr ? p.name_ar : p.name_en}</option>
              ))}
            </select>
            <button className={styles.adminBtn} type="submit">{isAr ? "تحميل المنتج" : "Load product"}</button>
          </div>
          <input type="hidden" name="qProducts" value={qProducts} />
          <input type="hidden" name="qVariants" value={qVariants} />
          <input type="hidden" name="qPromos" value={qPromos} />
          <input type="hidden" name="productState" value={productState} />
          <input type="hidden" name="variantState" value={variantState} />
          <input type="hidden" name="promoState" value={promoState} />
          {selectedProduct ? <input type="hidden" name="variantProductId" value={selectedProduct.id} /> : null}
        </form>

        {selectedEditProduct ? (
          <form action="/api/admin/catalog/products" method="post" className={styles.adminGrid}>
            <input type="hidden" name="return_to" value={editReturnTo} />
            <input type="hidden" name="action" value="update" />
            <input type="hidden" name="id" value={selectedEditProduct.id} />
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}>
              <input name="name_en" defaultValue={selectedEditProduct.name_en} required className={styles.adminInput} />
              <input name="name_ar" defaultValue={selectedEditProduct.name_ar} required className={styles.adminInput} />
              <input name="price_jod" type="number" min="0.01" step="0.01" defaultValue={Number(selectedEditProduct.price_jod || "0")} className={`${styles.adminInput} ${styles.ltr}`} />
              <input name="compare_at_price_jod" type="number" min="0" step="0.01" defaultValue={selectedEditProduct.compare_at_price_jod ? Number(selectedEditProduct.compare_at_price_jod) : ""} className={`${styles.adminInput} ${styles.ltr}`} />
              <input name="inventory_qty" type="number" min="0" defaultValue={selectedEditProduct.inventory_qty} className={`${styles.adminInput} ${styles.ltr}`} />
              <select name="category_key" defaultValue={selectedEditProduct.category_key} className={styles.adminSelect}>
                {data.categories.map((c) => (
                  <option key={`cat-edit-${c.key}`} value={c.key}>{labelCategory(lang, c)} ({c.key})</option>
                ))}
              </select>
              <textarea name="description_en" defaultValue={selectedEditProduct.description_en || ""} className={styles.adminTextarea} rows={3} />
              <textarea name="description_ar" defaultValue={selectedEditProduct.description_ar || ""} className={styles.adminTextarea} rows={3} />
            </div>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(3,minmax(0,1fr))" }}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>{L.wearTime}</div>
                {["day","night","anytime"].map((key) => (<label key={`ws-${key}`} style={{ marginInlineEnd: 8 }}><input type="checkbox" name="wear_times" value={key} defaultChecked={selectedEditProduct.wear_times.includes(key)} /> {key}</label>))}
              </div>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>{L.season}</div>
                {["spring","summer","fall","winter","all-season"].map((key) => (<label key={`ss-${key}`} style={{ marginInlineEnd: 8 }}><input type="checkbox" name="seasons" value={key} defaultChecked={selectedEditProduct.seasons.includes(key)} /> {key}</label>))}
              </div>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>{L.audience}</div>
                {["unisex","unisex-men-leaning","unisex-women-leaning","men","women"].map((key) => (<label key={`as-${key}`} style={{ marginInlineEnd: 8 }}><input type="checkbox" name="audiences" value={key} defaultChecked={selectedEditProduct.audiences.includes(key)} /> {key}</label>))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" name="is_active" defaultChecked={selectedEditProduct.is_active} /> {L.active}</label>
              <button className={`${styles.adminBtn} ${styles.adminBtnPrimary}`} type="submit">{isAr ? "تحديث المنتج بالكامل" : "Update full product"}</button>
            </div>
          </form>
        ) : null}
      </section>

      <section id="products-section" className={styles.adminCard}>
        <h2 style={{ marginTop: 0 }}>{L.products}</h2>
        <p className="muted" style={{ marginTop: -4 }}>{isAr ? `نتائج: ${filteredProducts.length}` : `Results: ${filteredProducts.length}`}</p>
        <div className={styles.adminTableWrap}>
          <table className={styles.adminTable}>
            <thead>
              <tr><th>Slug</th><th>Name</th><th>Category</th><th>Price</th><th>Inventory</th><th>Images</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filteredProducts.map((p) => (
                <tr key={p.id}>
                  <td className={styles.ltr}>{p.slug}</td>
                  <td>{p.name_en}<br />{p.name_ar}</td>
                  <td>{byKey.get(p.category_key) ? labelCategory(lang, byKey.get(p.category_key)!) : p.category_key}<div style={{ fontSize: 12, opacity: 0.78, marginTop: 4 }}>{[...p.wear_times, ...p.seasons, ...p.audiences].slice(0,4).join(" • ")}</div></td>
                  <td className={styles.ltr}>{p.price_jod} JOD {p.compare_at_price_jod ? `(was ${p.compare_at_price_jod})` : ""}</td>
                  <td className={styles.ltr}>{p.inventory_qty}</td>
                  <td className={styles.ltr}>{p.image_count}/5<div style={{ fontSize: 12, opacity: 0.78 }}>{isAr ? `عروض تلقائية: ${p.auto_promo_count}` : `Auto promos: ${p.auto_promo_count}`}</div></td>
                  <td>{p.is_active ? L.active : L.hidden}</td>
                  <td>
                    <form action="/api/admin/catalog/products" method="post" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <input type="hidden" name="return_to" value={returnTo} />
                      <input type="hidden" name="action" value="update" />
                      <input type="hidden" name="id" value={p.id} />
                      <select name="category_key" defaultValue={p.category_key} className={styles.adminSelect}>
                        {data.categories.map((c) => (
                          <option key={c.key} value={c.key}>{labelCategory(lang, c)} ({c.key})</option>
                        ))}
                      </select>
                      <input name="price_jod" type="number" step="0.01" defaultValue={Number(p.price_jod || "0")} className={`${styles.adminInput} ${styles.ltr}`} style={{ width: 120 }} />
                      <input name="inventory_qty" type="number" min="0" defaultValue={p.inventory_qty} className={`${styles.adminInput} ${styles.ltr}`} style={{ width: 100 }} />
                      <div style={{ display: "grid", gap: 6 }}>
                        <div style={{ fontSize: 12, opacity: 0.8 }}>{L.tags}</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {["day","night","anytime"].map((key) => (<label key={`wt-${p.id}-${key}`}><input type="checkbox" name="wear_times" value={key} defaultChecked={p.wear_times.includes(key)} /> {key}</label>))}
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {["spring","summer","fall","winter","all-season"].map((key) => (<label key={`ss-${p.id}-${key}`}><input type="checkbox" name="seasons" value={key} defaultChecked={p.seasons.includes(key)} /> {key}</label>))}
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {["unisex","unisex-men-leaning","unisex-women-leaning","men","women"].map((key) => (<label key={`au-${p.id}-${key}`}><input type="checkbox" name="audiences" value={key} defaultChecked={p.audiences.includes(key)} /> {key}</label>))}
                        </div>
                      </div>
                      <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <input type="checkbox" name="is_active" defaultChecked={p.is_active} /> {L.active}
                      </label>
                      <button className={styles.adminBtn} type="submit">{L.update}</button>
                      <Link className={styles.adminBtn} href={buildCatalogPath({ productEditId: p.id, variantProductId: p.id })}>{isAr ? "إدارة" : "Manage"}</Link>
                    </form>
                    <form action="/api/admin/catalog/products" method="post" style={{ marginTop: 8 }}>
                <input type="hidden" name="return_to" value={returnTo} />
                      <input type="hidden" name="action" value="clone" />
                      <input type="hidden" name="id" value={p.id} />
                      <button className={styles.adminBtn} type="submit">{isAr ? "نسخ" : "Clone"}</button>
                    </form>
                    <form action="/api/admin/catalog/products" method="post" style={{ marginTop: 8 }}>
                <input type="hidden" name="return_to" value={returnTo} />
                      <input type="hidden" name="action" value="delete" />
                      <input type="hidden" name="id" value={p.id} />
                      <button className={styles.adminBtn} type="submit">{L.del}</button>
                    </form>
                  </td>
                </tr>
              ))}
              {filteredProducts.length === 0 ? <tr><td colSpan={8} style={{ padding: 12, opacity: 0.7 }}>{L.noProducts}</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>


      <section className={styles.adminCard}>
        <h2 style={{ marginTop: 0 }}>{isAr ? "إدارة الصور" : "Product images"}</h2>
        <p className="muted" style={{ marginTop: -4 }}>{isAr ? "استبدل صور المنتج المختار (حد أقصى 5 صور)." : "Replace images for the selected product (max 5 files)."}</p>
        <form action="/api/admin/catalog/product-images" method="post" encType="multipart/form-data" style={{ display: "grid", gap: 10, gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr) auto", alignItems: "center" }}>
          <input type="hidden" name="return_to" value={returnTo} />
          <select name="product_id" className={styles.adminSelect} defaultValue={selectedProduct ? String(selectedProduct.id) : ""}>
            {data.products.map((p) => (
              <option key={`img-${p.id}`} value={p.id}>{p.slug} — {isAr ? p.name_ar : p.name_en}</option>
            ))}
          </select>
          <input className={styles.adminInput} type="file" name="images" multiple accept="image/*" required />
          <button className={`${styles.adminBtn} ${styles.adminBtnPrimary}`} type="submit">{isAr ? "رفع الصور" : "Upload images"}</button>
        </form>
      </section>

      <section id="variants-section" className={styles.adminCard}>
        <h2 style={{ marginTop: 0 }}>{isAr ? "إدارة المتغيرات" : "Variant management"}</h2>
        <p className="muted" style={{ marginTop: -4 }}>
          {isAr ? "اختر منتجًا واحدًا لإدارة الأحجام والأسعار بسرعة ووضوح." : "Choose one product to manage sizes and prices with a focused workflow."}
        </p>

        <form method="get" action="/admin/catalog" className={styles.adminGrid} style={{ marginBottom: 10 }}>
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "minmax(0,1fr) auto" }}>
            <select className={styles.adminSelect} name="variantProductId" defaultValue={selectedProduct ? String(selectedProduct.id) : ""}>
              {productsForVariantSection.map((p) => (
                <option key={p.id} value={p.id}>{p.slug} — {isAr ? p.name_ar : p.name_en}</option>
              ))}
            </select>
            <button className={styles.adminBtn} type="submit">{isAr ? "عرض المتغيرات" : "Load variants"}</button>
          </div>
          <input type="hidden" name="qProducts" value={qProducts} />
          <input type="hidden" name="qVariants" value={qVariants} />
          <input type="hidden" name="qPromos" value={qPromos} />
          <input type="hidden" name="productState" value={productState} />
          <input type="hidden" name="variantState" value={variantState} />
          <input type="hidden" name="promoState" value={promoState} />
        </form>

        {selectedProduct ? (
          <>
            <div className={styles.adminCard} style={{ marginBottom: 12, background: "#fafafa" }}>
              <strong>{selectedProduct.slug}</strong> — {isAr ? selectedProduct.name_ar : selectedProduct.name_en}
              <p className="muted" style={{ marginBottom: 0, marginTop: 6 }}>
                {isAr ? `عدد المتغيرات المطابقة: ${selectedProductVariants.length}` : `Matching variants: ${selectedProductVariants.length}`}
              </p>
            </div>

            <form action="/api/admin/catalog/variants" method="post" style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(8,minmax(0,1fr))", marginBottom: 10 }}>
                <input type="hidden" name="return_to" value={returnTo} />
              <input type="hidden" name="action" value="create" />
              <input type="hidden" name="product_id" value={selectedProduct.id} />
              <input name="label" required minLength={2} placeholder={isAr ? "الاسم (مثال 50 ml)" : "Label (e.g. 50 ml)"} className={styles.adminInput} />
              <input name="size_ml" type="number" min="0" placeholder="ml" className={`${styles.adminInput} ${styles.ltr}`} />
              <input name="price_jod" type="number" min="0.01" step="0.01" required placeholder="Price" className={`${styles.adminInput} ${styles.ltr}`} />
              <input name="compare_at_price_jod" type="number" min="0" step="0.01" placeholder="Compare" className={`${styles.adminInput} ${styles.ltr}`} />
              <input name="sort_order" type="number" min="0" defaultValue={selectedProductVariants.length * 10} placeholder="Sort" className={`${styles.adminInput} ${styles.ltr}`} />
              <label style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" name="is_default" /> {isAr ? "افتراضي" : "Default"}</label>
              <span className="muted" style={{ fontSize: 12 }}>{isAr ? "افتراضي واحد فقط لكل منتج." : "Only one default variant per product."}</span>
              <label style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" name="is_active" defaultChecked /> {L.active}</label>
              <button className={styles.adminBtn} type="submit" style={{ gridColumn: "1 / -1", width: "fit-content" }}>{isAr ? "إضافة متغير" : "Add variant"}</button>
            </form>

            <div style={{ display: "grid", gap: 8 }}>
              {selectedProductVariants.map((v) => (
                <div key={v.id} style={{ borderTop: "1px dashed #eee", paddingTop: 8 }}>
                  <form action="/api/admin/catalog/variants" method="post" style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(8,minmax(0,1fr))", alignItems: "center" }}>
                    <input type="hidden" name="return_to" value={returnTo} />
                    <input type="hidden" name="action" value="update" />
                    <input type="hidden" name="id" value={v.id} />
                    <input type="hidden" name="product_id" value={selectedProduct.id} />
                    <input name="label" required minLength={2} defaultValue={v.label} className={styles.adminInput} />
                    <input name="size_ml" type="number" min="0" defaultValue={v.size_ml ?? ""} className={`${styles.adminInput} ${styles.ltr}`} />
                    <input name="price_jod" type="number" min="0.01" step="0.01" required defaultValue={Number(v.price_jod || "0")} className={`${styles.adminInput} ${styles.ltr}`} />
                    <input name="compare_at_price_jod" type="number" min="0" step="0.01" defaultValue={v.compare_at_price_jod ? Number(v.compare_at_price_jod) : ""} className={`${styles.adminInput} ${styles.ltr}`} />
                    <input name="sort_order" type="number" min="0" defaultValue={v.sort_order} className={`${styles.adminInput} ${styles.ltr}`} />
                    <label style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" name="is_default" defaultChecked={v.is_default} /> {isAr ? "افتراضي" : "Default"}</label>
                    <label style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" name="is_active" defaultChecked={v.is_active} /> {L.active}</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className={styles.adminBtn} type="submit">{L.update}</button>
                    </div>
                  </form>
                  <form action="/api/admin/catalog/variants" method="post" style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <input type="hidden" name="return_to" value={returnTo} />
                    <input type="hidden" name="action" value="set-default" />
                    <input type="hidden" name="id" value={v.id} />
                    <input type="hidden" name="product_id" value={selectedProduct.id} />
                    <button className={styles.adminBtn} type="submit">{isAr ? "تعيين كافتراضي" : "Set default"}</button>
                  </form>
                  <form action="/api/admin/catalog/variants" method="post" style={{ marginTop: 8 }}>
                    <input type="hidden" name="return_to" value={returnTo} />
                    <input type="hidden" name="action" value="delete" />
                    <input type="hidden" name="id" value={v.id} />
                    <button className={styles.adminBtn} type="submit">{L.del}</button>
                  </form>
                </div>
              ))}
              {selectedProductVariants.length === 0 ? <p className="muted" style={{ margin: 0 }}>{isAr ? "لا توجد متغيرات لهذا المنتج بعد." : "No variants for this product yet."}</p> : null}
            </div>
          </>
        ) : (
          <p className="muted" style={{ margin: 0 }}>{isAr ? "لا توجد منتجات لإدارة المتغيرات." : "No products available for variant management."}</p>
        )}
      </section>

<section id="promos-section" className={styles.adminCard}>
        <h2 style={{ marginTop: 0 }}>{L.addPromo}</h2>
        <p className="muted" style={{ marginTop: -4 }}>{isAr ? `نتائج: ${filteredPromos.length}` : `Results: ${filteredPromos.length}`}</p>
        <form action="/api/admin/catalog/promotions" method="post" className={styles.adminGrid}>
                <input type="hidden" name="return_to" value={returnTo} />
          <input type="hidden" name="action" value="create" />
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}>
            <select name="promo_kind" defaultValue="CODE" className={styles.adminSelect}>
              <option value="CODE">{L.codePromo}</option>
              <option value="AUTO">{L.autoPromo}</option>
            </select>
            <input name="code" placeholder="NIVRAN10 (for promo code type)" className={`${styles.adminInput} ${styles.ltr}`} />
            <select name="discount_type" defaultValue="PERCENT" className={styles.adminSelect}>
              <option value="PERCENT">{L.percent}</option>
              <option value="FIXED">{L.fixed}</option>
            </select>
            <input name="discount_value" type="number" min="0" step="0.01" required placeholder="Discount value" className={`${styles.adminInput} ${styles.ltr}`} />
            <input name="usage_limit" type="number" min="1" placeholder="Usage limit" className={`${styles.adminInput} ${styles.ltr}`} />
            <input name="min_order_jod" type="number" min="0" step="0.01" placeholder="Min order (JOD)" className={`${styles.adminInput} ${styles.ltr}`} />
            <input name="priority" type="number" defaultValue={0} placeholder={L.promoPriority} className={`${styles.adminInput} ${styles.ltr}`} />
            <input name="product_slugs" placeholder={L.promoProducts} className={`${styles.adminInput} ${styles.ltr}`} style={{ gridColumn: "1 / -1" }} />
            <input name="title_en" required placeholder="Promotion title (EN)" className={styles.adminInput} />
            <input name="title_ar" required placeholder="عنوان العرض (AR)" className={styles.adminInput} />
            <input name="starts_at" type="datetime-local" className={`${styles.adminInput} ${styles.ltr}`} />
            <input name="ends_at" type="datetime-local" className={`${styles.adminInput} ${styles.ltr}`} />
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 600 }}>{L.promoCats}</div>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" name="category_keys" value="__ALL__" defaultChecked /> {L.allCats}
            </label>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              {data.categories.map((c) => (
                <label key={c.key} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="checkbox" name="category_keys" value={c.key} /> {labelCategory(lang, c)}
                </label>
              ))}
            </div>
          </div>

          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" name="is_active" defaultChecked /> {L.active}
          </label>

          <button className={`${styles.adminBtn} ${styles.adminBtnPrimary}`} style={{ width: "fit-content" }}>{L.savePromo}</button>
        </form>
      </section>

      <section className={styles.adminCard}>
        <h2 style={{ marginTop: 0 }}>{L.promos}</h2>
        <ul style={{ margin: 0, paddingInlineStart: 18 }}>
          {filteredPromos.map((r) => (
            <li key={r.id} style={{ marginBottom: 12 }}>
              <strong className={styles.ltr}>{r.code || "(AUTO)"}</strong> — <span className={styles.ltr}>{r.discount_type === "PERCENT" ? `${r.discount_value}%` : `${r.discount_value} JOD`}</span>
              <div style={{ fontSize: 12, opacity: 0.82, marginTop: 4 }}>
                {isAr ? r.title_ar : r.title_en}
              </div>
              <div style={{ fontSize: 12, opacity: 0.82, marginTop: 4 }}>
                {L.promoCats}: {!r.category_keys || r.category_keys.length === 0 ? L.allCats : r.category_keys.join(", ")}
              </div>
              <div style={{ fontSize: 12, opacity: 0.82, marginTop: 2 }}>
                {L.promoProducts}: {!r.product_slugs || r.product_slugs.length === 0 ? L.allCats : r.product_slugs.join(", ")}
              </div>
              <div style={{ fontSize: 12, opacity: 0.82 }}>
                {L.promoType}: {String(r.promo_kind || "CODE").toUpperCase() === "AUTO" ? L.autoPromo : L.codePromo} • {L.promoPriority}: {r.priority || 0} • {L.promoUsage}: {r.used_count || 0}{r.usage_limit ? ` / ${r.usage_limit}` : ""} • {L.promoMin}: {r.min_order_jod || "0"} JOD
              </div>
              <form action="/api/admin/catalog/promotions" method="post" style={{ marginTop: 8 }}>
                <input type="hidden" name="return_to" value={returnTo} />
                <input type="hidden" name="action" value="toggle" />
                <input type="hidden" name="id" value={r.id} />
                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="checkbox" name="is_active" defaultChecked={r.is_active} /> {L.active}
                </label>
                <button className={styles.adminBtn} type="submit" style={{ marginTop: 6 }}>{L.update}</button>
              </form>
              <form action="/api/admin/catalog/promotions" method="post" style={{ marginTop: 6 }}>
                <input type="hidden" name="return_to" value={returnTo} />
                <input type="hidden" name="action" value="delete" />
                <input type="hidden" name="id" value={r.id} />
                <button className={styles.adminBtn} type="submit">{L.del}</button>
              </form>
            </li>
          ))}
          {filteredPromos.length === 0 ? <li style={{ opacity: 0.7 }}>{L.noPromos}</li> : null}
        </ul>
      </section>

      <section id="categories-section" className={styles.adminCard}>
        <h2 style={{ marginTop: 0 }}>{L.addCategory}</h2>
        <form action="/api/admin/catalog/categories" method="post" className={styles.adminGrid}>
                <input type="hidden" name="return_to" value={returnTo} />
          <input type="hidden" name="action" value="create" />
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}>
            <input name="key" required placeholder="hand-gel" className={`${styles.adminInput} ${styles.ltr}`} />
            <input name="sort_order" type="number" defaultValue={100} className={`${styles.adminInput} ${styles.ltr}`} />
            <input name="name_en" required placeholder="Name EN" className={styles.adminInput} />
            <input name="name_ar" required placeholder="الاسم AR" className={styles.adminInput} />
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" name="is_active" defaultChecked /> {L.active}</label>
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" name="is_promoted" defaultChecked /> Promoted</label>
          </div>
          <button className={`${styles.adminBtn} ${styles.adminBtnPrimary}`} style={{ width: "fit-content" }}>{L.saveCategory}</button>
        </form>

        <h2 style={{ marginBottom: 0 }}>{L.categories}</h2>
        <div className={styles.adminTableWrap}>
          <table className={styles.adminTable}>
            <thead>
              <tr><th>Key</th><th>Name EN</th><th>Name AR</th><th>Sort</th><th>{L.active}</th><th>Promoted</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {data.categories.map((c) => (
                <tr key={c.key}>
                  <td className={styles.ltr}>{c.key}</td><td>{c.name_en}</td><td>{c.name_ar}</td><td className={styles.ltr}>{c.sort_order}</td><td>{c.is_active ? "✓" : "—"}</td><td>{c.is_promoted ? "✓" : "—"}</td>
                  <td>
                    <form action="/api/admin/catalog/categories" method="post" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <input type="hidden" name="return_to" value={returnTo} />
                      <input type="hidden" name="action" value="update" />
                      <input type="hidden" name="key" value={c.key} />
                      <input name="name_en" defaultValue={c.name_en} className={styles.adminInput} style={{ width: 160 }} />
                      <input name="name_ar" defaultValue={c.name_ar} className={styles.adminInput} style={{ width: 160 }} />
                      <input name="sort_order" type="number" defaultValue={c.sort_order} className={`${styles.adminInput} ${styles.ltr}`} style={{ width: 100 }} />
                      <label style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" name="is_active" defaultChecked={c.is_active} /> {L.active}</label>
                      <label style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" name="is_promoted" defaultChecked={c.is_promoted} /> Promoted</label>
                      <button className={styles.adminBtn} type="submit">{L.update}</button>
                    </form>
                    <form action="/api/admin/catalog/categories" method="post" style={{ marginTop: 8 }}>
                <input type="hidden" name="return_to" value={returnTo} />
                      <input type="hidden" name="action" value="delete" />
                      <input type="hidden" name="key" value={c.key} />
                      <button className={styles.adminBtn} type="submit">{L.del}</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      </>
      ) : null}
    </main>
  );
}
