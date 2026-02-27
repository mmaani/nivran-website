// src/app/admin/catalog/page.tsx
import Link from "next/link";
import { db, isDbConnectivityError } from "@/lib/db";
import { hasColumn } from "@/lib/dbSchema";
import { ensureCatalogTablesSafe } from "@/lib/catalog";
import { DEFAULT_FREE_SHIPPING_THRESHOLD_JOD, readFreeShippingThresholdJod } from "@/lib/shipping";
import { getAdminLang } from "@/lib/admin-lang";

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
  promo_kind: "AUTO" | "CODE" | "SEASONAL" | "PROMO" | "REFERRAL" | string;
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
  starts_at: string | null;
  ends_at: string | null;
  product_slugs: string[] | null;
};

const WEAR_TIME_TAGS = ["day", "night", "anytime"] as const;
const SEASON_TAGS = ["spring", "summer", "fall", "winter", "all-season"] as const;
const AUDIENCE_TAGS = ["unisex", "unisex-men-leaning", "unisex-women-leaning", "men", "women"] as const;

function isSeasonalPromoKind(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const k = value.trim().toUpperCase();
  return k === "AUTO" || k === "SEASONAL";
}

function normalizePromoKind(value: unknown): "SEASONAL" | "CODE" {
  const kind = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (kind === "CODE" || kind === "PROMO" || kind === "REFERRAL") return "CODE";
  return "SEASONAL";
}

function labelCategory(lang: "en" | "ar", c: CategoryRow) {
  return lang === "ar" ? c.name_ar : c.name_en;
}

function promoStatusLabel(lang: "en" | "ar", row: PromoRow): string {
  if (!row.is_active) return lang === "ar" ? "متوقف" : "Paused";
  const now = Date.now();
  const starts = row.starts_at ? new Date(String(row.starts_at)).getTime() : null;
  const ends = row.ends_at ? new Date(String(row.ends_at)).getTime() : null;
  if (starts && starts > now) return lang === "ar" ? "مجدول" : "Scheduled";
  if (ends && ends < now) return lang === "ar" ? "منتهي" : "Ended";
  return lang === "ar" ? "مباشر" : "Live";
}

function toDatetimeLocalValue(value: string | null): string {
  if (!value) return "";
  const d = new Date(String(value));
  if (!Number.isFinite(d.getTime())) return "";
  return d.toISOString().slice(0, 16);
}

function promoEstimatedCoverage(row: PromoRow, products: ProductRow[]): number {
  const productSlugs = row.product_slugs || [];
  const categoryKeys = row.category_keys || [];
  return products.filter((product) => {
    const bySlug = productSlugs.length === 0 || productSlugs.includes(product.slug);
    const byCategory = categoryKeys.length === 0 || categoryKeys.includes(product.category_key);
    return bySlug && byCategory;
  }).length;
}

type CatalogPageData = {
  health: "db" | "fallback" | "error";
  categories: CategoryRow[];
  products: ProductRow[];
  variants: CatalogVariantRow[];
  promos: PromoRow[];
  freeShippingThresholdJod: number;
  bootstrapNote?: string;
  errorMessage?: string;
};

async function loadCatalogPageData(): Promise<CatalogPageData> {
  let bootstrapNote: string | undefined;

  try {
    const bootstrap = await ensureCatalogTablesSafe();
    bootstrapNote = bootstrap.ok ? undefined : bootstrap.reason;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error || "Unknown catalog bootstrap error");
    if (isDbConnectivityError(error)) {
      return {
        health: "fallback",
        categories: [],
        products: [],
        variants: [],
        promos: [],
        freeShippingThresholdJod: DEFAULT_FREE_SHIPPING_THRESHOLD_JOD,
        bootstrapNote: "DB_CONNECTIVITY",
        errorMessage: message,
      };
    }
    return {
      health: "error",
      categories: [],
      products: [],
      variants: [],
      promos: [],
      freeShippingThresholdJod: DEFAULT_FREE_SHIPPING_THRESHOLD_JOD,
      bootstrapNote: "CATALOG_BOOTSTRAP_UNAVAILABLE",
      errorMessage: message,
    };
  }

  try {
    const [hasWearTimes, hasSeasons, hasAudiences] = await Promise.all([
      hasColumn("products", "wear_times").catch(() => false),
      hasColumn("products", "seasons").catch(() => false),
      hasColumn("products", "audiences").catch(() => false),
    ]);

    const [categoriesRes, productsRes, variantsRes, promosRes, shippingThreshold] = await Promise.all([
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
                ${hasWearTimes ? "coalesce(p.wear_times, '{}'::text[])" : "'{}'::text[]"} as wear_times,
                ${hasSeasons ? "coalesce(p.seasons, '{}'::text[])" : "'{}'::text[]"} as seasons,
                ${hasAudiences ? "coalesce(p.audiences, '{}'::text[])" : "'{}'::text[]"} as audiences
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
                and pr.promo_kind in ('AUTO','SEASONAL')
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
        `select id::int as id, promo_kind, code, title_en, title_ar, discount_type, discount_value::text,
                is_active, category_keys, usage_limit, used_count, min_order_jod::text, priority,
                starts_at::text as starts_at, ends_at::text as ends_at, product_slugs
           from promotions
          order by created_at desc`
      ),
      readFreeShippingThresholdJod(),
    ]);

    return {
      health: "db",
      categories: categoriesRes.rows,
      products: productsRes.rows,
      variants: variantsRes.rows,
      promos: promosRes.rows,
      freeShippingThresholdJod: shippingThreshold.value,
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
        freeShippingThresholdJod: DEFAULT_FREE_SHIPPING_THRESHOLD_JOD,
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
      freeShippingThresholdJod: DEFAULT_FREE_SHIPPING_THRESHOLD_JOD,
      bootstrapNote,
      errorMessage: message,
    };
  }
}

// --- AdminShell UI helpers (global admin.css) ---
function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

const UI = {
  shell: "admin-shell",
  container: "admin-container", // if not present in your CSS, it will harmlessly do nothing
  topbar: "admin-topbar",
  topbarInner: "admin-topbar-inner",
  card: "admin-card",
  h1: "admin-h1",
  h2: "admin-h2",
  muted: "muted",
  grid: "admin-grid",
  row: "admin-row",
  pillRow: "admin-pill-row",
  pill: "admin-pill",
  input: "admin-input",
  select: "admin-select",
  textarea: "admin-textarea",
  btn: "admin-btn",
  btnPrimary: "admin-btn-primary",
  btnOutline: "admin-btn-outline",
  tableWrap: "admin-table-wrap",
  table: "admin-table",
  ltr: "ltr",
};

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
  const errorPgCode = String(Array.isArray(params.error_code) ? (params.error_code[0] ?? "") : (params.error_code ?? "")).trim();
  const errorDetail = String(Array.isArray(params.error_detail) ? (params.error_detail[0] ?? "") : (params.error_detail ?? "")).trim();
  const variantError = errorCode === "invalid-variant";
  const duplicateVariantLabelError = errorCode === "duplicate-variant-label";
  const uploaded = String(params.uploaded || "") === "1";

  const data = await loadCatalogPageData();

  const L = isAr
    ? {
        title: "الكتالوج",
        sub: "إدارة المنتجات والمخزون والعروض وكوبونات الخصم.",
        products: "المنتجات والمخزون",
        promos: "العروض والخصومات",
        categories: "الفئات",
        addProduct: "إضافة / تحديث منتج",
        addCategory: "إضافة / تحديث فئة",
        freeShipping: "الحد المجاني للتوصيل",
        saveProduct: "حفظ المنتج",
        savePromo: "حفظ العرض",
        saveCategory: "حفظ الفئة",
        update: "تحديث",
        del: "حذف",
        active: "مفعّل",
        hidden: "مخفي",
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
        back: "العودة للوحة",
        retry: "إعادة المحاولة",
        filterProducts: "تصفية المنتجات",
        filterVariants: "تصفية المتغيرات",
        filterPromos: "تصفية العروض",
      }
    : {
        title: "Catalog",
        sub: "Manage products, inventory, promotions, and categories.",
        products: "Products & Inventory",
        promos: "Promotions",
        categories: "Categories",
        addProduct: "Add / Update Product",
        addCategory: "Add / Update Category",
        freeShipping: "Free-shipping threshold",
        saveProduct: "Save product",
        savePromo: "Save promotion",
        saveCategory: "Save category",
        update: "Update",
        del: "Delete",
        active: "Active",
        hidden: "Hidden",
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
        back: "Back to dashboard",
        retry: "Retry",
        filterProducts: "Filter products",
        filterVariants: "Filter variants",
        filterPromos: "Filter promotions",
      };

  const byKey = new Map(data.categories.map((c) => [c.key, c]));

  const productTotal = data.products.length;
  const productActive = data.products.filter((p) => p.is_active).length;
  const outOfStockCount = data.products.filter((p) => Number(p.inventory_qty || 0) <= 0).length;
  const variantsActive = data.variants.filter((v) => v.is_active).length;
  const activeSeasonalPromos = data.promos.filter(
    (r: { promo_kind: unknown; is_active: boolean }) => isSeasonalPromoKind(r.promo_kind) && r.is_active
  ).length;
  const activePromoCodes = data.promos.filter((r) => normalizePromoKind(r.promo_kind) === "CODE" && r.is_active).length;
  const activeReferralCodes = data.promos.filter((r) => String(r.promo_kind || "").toUpperCase() === "REFERRAL" && r.is_active).length;
  const productsWithSeasonalCampaign = data.products.filter((p) => Number(p.auto_promo_count || 0) > 0).length;

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
    const haystack = [p.slug, p.name_en, p.name_ar, p.category_key, ...p.wear_times, ...p.seasons, ...p.audiences]
      .join(" ")
      .toLowerCase();
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
  const productsForVariantSection =
    qVariants || variantState !== "all" ? data.products.filter((p) => variantProductIds.has(p.id)) : data.products;

  const filteredPromos = data.promos.filter((r) => {
    const rawKind = String(r.promo_kind || "").toUpperCase();
    const kind = normalizePromoKind(rawKind);
    if (promoState === "active" && !r.is_active) return false;
    if (promoState === "inactive" && r.is_active) return false;
    if (promoState === "seasonal" && kind !== "SEASONAL") return false;
    if (promoState === "promo" && kind !== "CODE") return false;
    if (promoState === "referral" && rawKind !== "REFERRAL") return false;
    if (!qPromos) return true;
    const haystack = [r.code || "", r.title_en, r.title_ar, ...(r.category_keys || []), ...(r.product_slugs || [])]
      .join(" ")
      .toLowerCase();
    return haystack.includes(qPromos);
  });

  const promoInsights = filteredPromos.map((promo) => ({
    id: Number(promo.id),
    status: promoStatusLabel(lang, promo),
    estimatedCoverage: promoEstimatedCoverage(promo, data.products),
  }));

  const selectedProductIdParam = Number(params.variantProductId || 0);
  const selectedProduct =
    productsForVariantSection.find((p) => Number(p.id) === selectedProductIdParam) ||
    productsForVariantSection[0] ||
    null;

  const selectedProductVariants = selectedProduct ? filteredVariants.filter((v) => v.product_id === selectedProduct.id) : [];

  const selectedEditProductId = Number(params.productEditId || (selectedProduct ? Number(selectedProduct.id) : 0) || 0);
  const selectedEditProduct = data.products.find((p) => Number(p.id) === selectedEditProductId) || null;

  const selectedPromoEditId = Number(params.promoEditId || 0);
  const selectedPromo = data.promos.find((r) => Number(r.id) === selectedPromoEditId) || null;

  const returnQuery = new URLSearchParams();
  const carry = ["qProducts", "qVariants", "qPromos", "productState", "variantState", "promoState", "productEditId", "promoEditId"] as const;
  for (const key of carry) {
    const value = String(params[key] || "").trim();
    if (value) returnQuery.set(key, value);
  }

  const buildCatalogPath = (extra?: Record<string, string | number>) => {
    const query = new URLSearchParams(returnQuery);
    if (selectedProduct) query.set("variantProductId", String(selectedProduct.id));
    if (extra) for (const [key, value] of Object.entries(extra)) query.set(key, String(value));
    return query.size ? `/admin/catalog?${query.toString()}` : "/admin/catalog";
  };

  const returnExtra: Record<string, string | number> = {};
  if (selectedEditProduct) returnExtra.productEditId = Number(selectedEditProduct.id);
  if (selectedPromo) returnExtra.promoEditId = Number(selectedPromo.id);

  const returnTo = buildCatalogPath(Object.keys(returnExtra).length ? returnExtra : undefined);
  const editReturnTo = selectedEditProduct
    ? buildCatalogPath({ ...returnExtra, productEditId: Number(selectedEditProduct.id), variantProductId: Number(selectedEditProduct.id) })
    : returnTo;

  return (
    <div className={UI.shell} dir={isAr ? "rtl" : "ltr"}>
      {/* Topbar (AdminShell style) */}
      <div className={UI.topbar}>
        <div className={cx(UI.topbarInner, UI.container)}>
          <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
            <Link href="/admin" className="admin-logo" style={{ textDecoration: "none" }}>
              NIVRAN
            </Link>
            <span className={UI.muted}>
              {isAr ? "لوحة التحكم" : "Admin"}
            </span>
          </div>

          <div style={{ marginInlineStart: "auto", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <Link href="/admin" className={cx(UI.btn, UI.btnOutline)}>
              {L.back}
            </Link>
            <Link href="/admin/catalog" className={UI.btn}>
              {isAr ? "تحديث الصفحة" : "Refresh"}
            </Link>
          </div>
        </div>
      </div>

      <main className={cx(UI.container)} style={{ padding: "18px 16px 40px" }}>
        {/* Header card */}
        <section className={UI.card}>
          <div style={{ display: "grid", gap: 6 }}>
            <h1 className={UI.h1} style={{ margin: 0 }}>
              {L.title}
            </h1>
            <p className={UI.muted} style={{ margin: 0 }}>
              {L.sub}
            </p>

            {saved ? (
              <div style={{ padding: "10px 12px", borderRadius: 12, background: "rgba(34,197,94,.10)", border: "1px solid rgba(34,197,94,.25)" }}>
                <strong style={{ color: "seagreen" }}>{isAr ? "تم الحفظ بنجاح." : "Saved successfully."}</strong>
              </div>
            ) : null}

            {variantError ? (
              <div style={{ padding: "10px 12px", borderRadius: 12, background: "rgba(220,38,38,.08)", border: "1px solid rgba(220,38,38,.25)" }}>
                <strong style={{ color: "#b91c1c" }}>
                  {isAr
                    ? "تحقق من المتغير: الاسم والسعر مطلوبة والسعر يجب أن يكون أكبر من صفر."
                    : "Variant validation failed: label and price are required, and price must be greater than zero."}
                </strong>
              </div>
            ) : null}

            {duplicateVariantLabelError ? (
              <div style={{ padding: "10px 12px", borderRadius: 12, background: "rgba(220,38,38,.08)", border: "1px solid rgba(220,38,38,.25)" }}>
                <strong style={{ color: "#b91c1c" }}>
                  {isAr
                    ? "يوجد متغير بنفس الاسم لهذا المنتج. يرجى اختيار اسم مختلف."
                    : "A variant with the same label already exists for this product. Please use a different label."}
                </strong>
              </div>
            ) : null}

            {uploaded ? (
              <div style={{ padding: "10px 12px", borderRadius: 12, background: "rgba(34,197,94,.10)", border: "1px solid rgba(34,197,94,.25)" }}>
                <strong style={{ color: "seagreen" }}>{isAr ? "تم رفع الصور بنجاح." : "Images uploaded successfully."}</strong>
              </div>
            ) : null}

            {errorCode && !variantError ? (
              <div style={{ padding: "10px 12px", borderRadius: 12, background: "rgba(220,38,38,.08)", border: "1px solid rgba(220,38,38,.25)" }}>
                <strong style={{ color: "#b91c1c" }}>
                  {isAr
                    ? `حدث خطأ في العملية: ${errorCode}${errorPgCode ? ` (${errorPgCode})` : ""}`
                    : `Catalog action error: ${errorCode}${errorPgCode ? ` (${errorPgCode})` : ""}`}
                </strong>
                {errorDetail ? <div className={UI.muted} style={{ marginTop: 6, color: "#b91c1c" }}>{errorDetail}</div> : null}
              </div>
            ) : null}

            {data.bootstrapNote ? (
              <div className={UI.muted} style={{ marginTop: 6 }}>
                {isAr
                  ? "ملاحظة: تهيئة الجداول تم تجاوزها بسبب صلاحيات قاعدة البيانات، وتم الاستمرار بالوضع المتاح."
                  : "Note: schema bootstrap was skipped due to DB privileges; running in compatibility mode."}
              </div>
            ) : null}
          </div>
        </section>

        {/* Stats */}
        <section className={UI.card} style={{ marginTop: 14 }}>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))" }}>
            <div>
              <strong style={{ fontSize: 20 }}>{productTotal}</strong>
              <div className={UI.muted}>{isAr ? "إجمالي المنتجات" : "Total products"}</div>
            </div>
            <div>
              <strong style={{ fontSize: 20 }}>{productActive}</strong>
              <div className={UI.muted}>{isAr ? "منتجات مفعلة" : "Active products"}</div>
            </div>
            <div>
              <strong style={{ fontSize: 20 }}>{outOfStockCount}</strong>
              <div className={UI.muted}>{isAr ? "نفدت الكمية" : "Out of stock"}</div>
            </div>
            <div>
              <strong style={{ fontSize: 20 }}>{data.promos.length}</strong>
              <div className={UI.muted}>{isAr ? "العروض" : "Promotions"}</div>
            </div>
            <div>
              <strong style={{ fontSize: 20 }}>{variantsActive}</strong>
              <div className={UI.muted}>{isAr ? "متغيرات مفعلة" : "Active variants"}</div>
            </div>
            <div>
              <strong style={{ fontSize: 20 }}>{activeSeasonalPromos}</strong>
              <div className={UI.muted}>{isAr ? "حملات تلقائية مفعلة" : "Active auto campaigns"}</div>
            </div>
            <div>
              <strong style={{ fontSize: 20 }}>{activePromoCodes}</strong>
              <div className={UI.muted}>{isAr ? "أكواد ترويجية مفعلة" : "Active promo codes"}</div>
            </div>
            <div>
              <strong style={{ fontSize: 20 }}>{productsWithSeasonalCampaign}</strong>
              <div className={UI.muted}>{isAr ? "منتجات مشمولة بحملة تلقائية" : "Products covered by auto campaign"}</div>
            </div>
            <div>
              <strong style={{ fontSize: 20 }}>{activeReferralCodes}</strong>
              <div className={UI.muted}>{isAr ? "أكواد إحالة مفعلة" : "Active referral codes"}</div>
            </div>
          </div>
        </section>

        {/* Anchors + Filters */}
        <section className={UI.card} style={{ marginTop: 14 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a className={UI.btn} href="#products-section">{isAr ? "المنتجات" : "Products"}</a>
            <a className={UI.btn} href="#variants-section">{isAr ? "المتغيرات" : "Variants"}</a>
            <a className={UI.btn} href="#promos-section">{isAr ? "العروض" : "Promotions"}</a>
            <a className={UI.btn} href="#categories-section">{isAr ? "الفئات" : "Categories"}</a>
          </div>

          <div style={{ marginTop: 12, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))" }}>
            <form method="get" action="/admin/catalog" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input className={UI.input} name="qProducts" defaultValue={qProducts} placeholder={isAr ? "بحث بالمنتجات" : "Search products"} />
              <select className={UI.select} name="productState" defaultValue={productState}>
                <option value="all">{isAr ? "كل الحالات" : "All states"}</option>
                <option value="active">{isAr ? "مفعّل" : "Active"}</option>
                <option value="inactive">{isAr ? "مخفي" : "Hidden"}</option>
              </select>
              <button className={cx(UI.btn, UI.btnPrimary)} type="submit">{L.filterProducts}</button>
            </form>

            <form method="get" action="/admin/catalog" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input className={UI.input} name="qVariants" defaultValue={qVariants} placeholder={isAr ? "بحث بالمتغيرات" : "Search variants"} />
              <select className={UI.select} name="variantState" defaultValue={variantState}>
                <option value="all">{isAr ? "كل الحالات" : "All states"}</option>
                <option value="active">{isAr ? "مفعّل" : "Active"}</option>
                <option value="inactive">{isAr ? "مخفي" : "Hidden"}</option>
              </select>
              <button className={cx(UI.btn, UI.btnPrimary)} type="submit">{L.filterVariants}</button>
            </form>

            <form method="get" action="/admin/catalog" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input className={UI.input} name="qPromos" defaultValue={qPromos} placeholder={isAr ? "بحث بالعروض" : "Search promotions"} />
              <select className={UI.select} name="promoState" defaultValue={promoState}>
                <option value="all">{isAr ? "كل الأنواع" : "All types"}</option>
                <option value="active">{isAr ? "مفعّل" : "Active"}</option>
                <option value="inactive">{isAr ? "مخفي" : "Hidden"}</option>
                <option value="seasonal">{L.autoPromo}</option>
                <option value="promo">{L.codePromo}</option>
              </select>
              <button className={cx(UI.btn, UI.btnPrimary)} type="submit">{L.filterPromos}</button>
            </form>
          </div>
        </section>

        {/* Health states */}
        {data.health === "error" ? (
          <section className={UI.card} style={{ marginTop: 14, border: "1px solid rgba(220,38,38,.35)", background: "rgba(220,38,38,.06)" }}>
            <h2 className={UI.h2} style={{ marginTop: 0 }}>{isAr ? "خطأ في تحميل الكتالوج" : "Catalog load error"}</h2>
            <p style={{ marginBottom: 0 }}>
              {isAr ? "تعذر تحميل بيانات الكتالوج. تم تعطيل العمليات لحين التحقق من قاعدة البيانات." : "Catalog data could not be loaded. Mutations are disabled until database issues are fixed."}
            </p>
            {data.errorMessage ? <p className={UI.muted} style={{ marginTop: 8, marginBottom: 0 }}>{data.errorMessage}</p> : null}
          </section>
        ) : null}

        {data.health === "fallback" ? (
          <section className={UI.card} style={{ marginTop: 14, border: "1px solid rgba(245,158,11,.35)", background: "rgba(245,158,11,.08)" }}>
            <h2 className={UI.h2} style={{ marginTop: 0 }}>{isAr ? "وضع الطوارئ" : "Fallback mode"}</h2>
            <p style={{ marginBottom: 0 }}>
              {isAr
                ? "تعذّر تحميل بيانات الكتالوج من قاعدة البيانات حالياً. الصفحة في وضع عرض فقط حتى عودة الاتصال."
                : "Catalog data could not be loaded from the database right now. The page is in read-only mode until connectivity is restored."}
            </p>
            <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link href="/admin" className={cx(UI.btn, UI.btnOutline)}>{L.back}</Link>
              <Link href="/admin/catalog" className={cx(UI.btn, UI.btnPrimary)}>{L.retry}</Link>
            </div>
          </section>
        ) : null}

        {data.health === "db" ? (
          <>
            {/* Free shipping */}
            <section className={UI.card} style={{ marginTop: 14 }}>
              <h2 className={UI.h2} style={{ marginTop: 0 }}>{L.freeShipping}</h2>
              <form action="/api/admin/catalog/settings" method="post" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <input type="hidden" name="return_to" value={returnTo} />
                <input
                  name="free_shipping_threshold_jod"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={Number(data.freeShippingThresholdJod || DEFAULT_FREE_SHIPPING_THRESHOLD_JOD)}
                  className={cx(UI.input, UI.ltr)}
                  style={{ width: 220 }}
                />
                <button className={cx(UI.btn, UI.btnPrimary)} type="submit">{L.update}</button>
                <span className={UI.muted}>{isAr ? "عند هذا الحد يصبح الشحن مجانياً في صفحة الدفع." : "At this threshold, shipping becomes free in checkout."}</span>
              </form>
            </section>

            {/* Add product */}
            <section className={UI.card} style={{ marginTop: 14 }}>
              <h2 className={UI.h2} style={{ marginTop: 0 }}>{L.addProduct}</h2>

              <form action="/api/admin/catalog/products" method="post" style={{ display: "grid", gap: 12 }}>
                <input type="hidden" name="return_to" value={returnTo} />
                <input type="hidden" name="action" value="create" />

                <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}>
                  <input name="slug" required placeholder="e.g. nivran-care-hand-gel-60ml" className={cx(UI.input, UI.ltr)} />
                  <select name="category_key" defaultValue="perfume" className={UI.select}>
                    {data.categories.map((c) => (
                      <option key={c.key} value={c.key}>
                        {labelCategory(lang, c)} ({c.key})
                      </option>
                    ))}
                  </select>

                  <input name="name_en" required placeholder="Product name (EN)" className={UI.input} />
                  <input name="name_ar" required placeholder="اسم المنتج (AR)" className={UI.input} />

                  <input name="price_jod" type="number" min="0.01" step="0.01" required placeholder="Price" className={cx(UI.input, UI.ltr)} />
                  <input name="compare_at_price_jod" type="number" step="0.01" placeholder="Compare at price" className={cx(UI.input, UI.ltr)} />

                  <input name="inventory_qty" type="number" min="0" defaultValue={0} placeholder="Inventory" className={cx(UI.input, UI.ltr)} />
                  <span />

                  <textarea name="description_en" placeholder="Description (EN)" className={UI.textarea} rows={3} />
                  <textarea name="description_ar" placeholder="Description (AR)" className={UI.textarea} rows={3} />
                </div>

                <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(3,minmax(0,1fr))" }}>
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>{L.wearTime}</div>
                    <label className="admin-tag-chip"><input type="checkbox" name="wear_times" value="day" /> Day</label>
                    <label className="admin-tag-chip"><input type="checkbox" name="wear_times" value="night" /> Night</label>
                    <label className="admin-tag-chip"><input type="checkbox" name="wear_times" value="anytime" /> Anytime</label>
                  </div>

                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>{L.season}</div>
                    {SEASON_TAGS.map((s) => (
                      <label key={s} className="admin-tag-chip">
                        <input type="checkbox" name="seasons" value={s} /> {s}
                      </label>
                    ))}
                  </div>

                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>{L.audience}</div>
                    {AUDIENCE_TAGS.map((a) => (
                      <label key={a} className="admin-tag-chip">
                        <input type="checkbox" name="audiences" value={a} /> {a}
                      </label>
                    ))}
                  </div>
                </div>

                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="checkbox" name="is_active" defaultChecked /> {L.active}
                </label>

                <button className={cx(UI.btn, UI.btnPrimary)} style={{ width: "fit-content" }}>
                  {L.saveProduct}
                </button>
              </form>
            </section>

            {/* Product workspace */}
            <section className={UI.card} style={{ marginTop: 14 }}>
              <h2 className={UI.h2} style={{ marginTop: 0 }}>{isAr ? "مساحة عمل المنتج" : "Product workspace"}</h2>
              <p className={UI.muted} style={{ marginTop: -4 }}>
                {isAr ? "اختر منتجًا واحدًا لتحديث الاسم/الوصف/السعر/الوسوم دون فقدان السياق." : "Pick one product and update name/description/pricing/tags without losing your current admin context."}
              </p>

              <form method="get" action="/admin/catalog" style={{ display: "grid", gap: 10, marginBottom: 12 }}>
                <div style={{ display: "grid", gap: 8, gridTemplateColumns: "minmax(0,1fr) auto" }}>
                  <select name="productEditId" className={UI.select} defaultValue={selectedEditProduct ? String(selectedEditProduct.id) : ""}>
                    {data.products.map((p) => (
                      <option key={`edit-${p.id}`} value={p.id}>
                        {p.slug} — {isAr ? p.name_ar : p.name_en}
                      </option>
                    ))}
                  </select>
                  <button className={cx(UI.btn, UI.btnPrimary)} type="submit">
                    {isAr ? "تحميل المنتج" : "Load product"}
                  </button>
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
                <form action="/api/admin/catalog/products" method="post" style={{ display: "grid", gap: 12 }}>
                  <input type="hidden" name="return_to" value={editReturnTo} />
                  <input type="hidden" name="action" value="update" />
                  <input type="hidden" name="id" value={selectedEditProduct.id} />

                  <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}>
                    <input name="name_en" defaultValue={selectedEditProduct.name_en} required className={UI.input} />
                    <input name="name_ar" defaultValue={selectedEditProduct.name_ar} required className={UI.input} />

                    <input name="price_jod" type="number" min="0.01" step="0.01" defaultValue={Number(selectedEditProduct.price_jod || "0")} className={cx(UI.input, UI.ltr)} />
                    <input
                      name="compare_at_price_jod"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={selectedEditProduct.compare_at_price_jod ? Number(selectedEditProduct.compare_at_price_jod) : ""}
                      className={cx(UI.input, UI.ltr)}
                    />

                    <input name="inventory_qty" type="number" min="0" defaultValue={selectedEditProduct.inventory_qty} className={cx(UI.input, UI.ltr)} />

                    <select name="category_key" defaultValue={selectedEditProduct.category_key} className={UI.select}>
                      {data.categories.map((c) => (
                        <option key={`cat-edit-${c.key}`} value={c.key}>
                          {labelCategory(lang, c)} ({c.key})
                        </option>
                      ))}
                    </select>

                    <textarea name="description_en" defaultValue={selectedEditProduct.description_en || ""} className={UI.textarea} rows={3} />
                    <textarea name="description_ar" defaultValue={selectedEditProduct.description_ar || ""} className={UI.textarea} rows={3} />
                  </div>

                  <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(3,minmax(0,1fr))" }}>
                    <div>
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>{L.wearTime}</div>
                      {WEAR_TIME_TAGS.map((key) => (
                        <label key={`ws-${key}`} className="admin-tag-chip">
                          <input type="checkbox" name="wear_times" value={key} defaultChecked={selectedEditProduct.wear_times.includes(key)} /> {key}
                        </label>
                      ))}
                    </div>

                    <div>
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>{L.season}</div>
                      {SEASON_TAGS.map((key) => (
                        <label key={`ss-${key}`} className="admin-tag-chip">
                          <input type="checkbox" name="seasons" value={key} defaultChecked={selectedEditProduct.seasons.includes(key)} /> {key}
                        </label>
                      ))}
                    </div>

                    <div>
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>{L.audience}</div>
                      {AUDIENCE_TAGS.map((key) => (
                        <label key={`as-${key}`} className="admin-tag-chip">
                          <input type="checkbox" name="audiences" value={key} defaultChecked={selectedEditProduct.audiences.includes(key)} /> {key}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input type="checkbox" name="is_active" defaultChecked={selectedEditProduct.is_active} /> {L.active}
                    </label>
                    <button className={cx(UI.btn, UI.btnPrimary)} type="submit">
                      {isAr ? "تحديث المنتج بالكامل" : "Update full product"}
                    </button>
                  </div>
                </form>
              ) : null}
            </section>

            {/* Products table */}
            <section id="products-section" className={UI.card} style={{ marginTop: 14 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                <h2 className={UI.h2} style={{ margin: 0 }}>{L.products}</h2>
                <span className={UI.muted}>{isAr ? `نتائج: ${filteredProducts.length}` : `Results: ${filteredProducts.length}`}</span>
              </div>

              <div className={UI.tableWrap} style={{ marginTop: 10 }}>
                <table className={UI.table}>
                  <thead>
                    <tr>
                      <th>Slug</th>
                      <th>{isAr ? "الاسم" : "Name"}</th>
                      <th>{isAr ? "الفئة" : "Category"}</th>
                      <th>{isAr ? "السعر" : "Price"}</th>
                      <th>{isAr ? "المخزون" : "Inventory"}</th>
                      <th>{isAr ? "الصور" : "Images"}</th>
                      <th>{isAr ? "الحالة" : "Status"}</th>
                      <th>{isAr ? "إجراءات" : "Actions"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((p) => (
                      <tr key={p.id}>
                        <td className={UI.ltr}>{p.slug}</td>
                        <td>
                          {p.name_en}
                          <br />
                          {p.name_ar}
                        </td>
                        <td>
                          {byKey.get(p.category_key) ? labelCategory(lang, byKey.get(p.category_key)!) : p.category_key}
                          <div className={UI.muted} style={{ fontSize: 12, marginTop: 4 }}>
                            {[...p.wear_times, ...p.seasons, ...p.audiences].slice(0, 4).join(" • ")}
                          </div>
                        </td>
                        <td className={UI.ltr}>
                          {p.price_jod} JOD {p.compare_at_price_jod ? `(was ${p.compare_at_price_jod})` : ""}
                        </td>
                        <td className={UI.ltr}>{p.inventory_qty}</td>
                        <td className={UI.ltr}>
                          {p.image_count}/5
                          <div className={UI.muted} style={{ fontSize: 12 }}>
                            {isAr ? `عروض تلقائية: ${p.auto_promo_count}` : `Auto promos: ${p.auto_promo_count}`}
                          </div>
                        </td>
                        <td>{p.is_active ? L.active : L.hidden}</td>
                        <td style={{ minWidth: 460 }}>
                          <form action="/api/admin/catalog/products" method="post" style={{ display: "grid", gap: 10 }}>
                            <input type="hidden" name="return_to" value={returnTo} />
                            <input type="hidden" name="action" value="update" />
                            <input type="hidden" name="id" value={p.id} />

                            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "minmax(200px,1fr) 110px 110px auto" }}>
                              <select name="category_key" defaultValue={p.category_key} className={UI.select}>
                                {data.categories.map((c) => (
                                  <option key={c.key} value={c.key}>
                                    {labelCategory(lang, c)} ({c.key})
                                  </option>
                                ))}
                              </select>

                              <input name="price_jod" type="number" step="0.01" defaultValue={Number(p.price_jod || "0")} className={cx(UI.input, UI.ltr)} />
                              <input name="inventory_qty" type="number" min="0" defaultValue={p.inventory_qty} className={cx(UI.input, UI.ltr)} />
                              <label style={{ display: "flex", gap: 8, alignItems: "center", whiteSpace: "nowrap" }}>
                                <input type="checkbox" name="is_active" defaultChecked={p.is_active} /> {L.active}
                              </label>
                            </div>

                            <details>
                              <summary className={UI.muted} style={{ cursor: "pointer" }}>{L.tags}</summary>
                              <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                  {WEAR_TIME_TAGS.map((key) => (
                                    <label key={`wt-${p.id}-${key}`} className="admin-tag-chip">
                                      <input type="checkbox" name="wear_times" value={key} defaultChecked={p.wear_times.includes(key)} /> {key}
                                    </label>
                                  ))}
                                </div>
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                  {SEASON_TAGS.map((key) => (
                                    <label key={`ss-${p.id}-${key}`} className="admin-tag-chip">
                                      <input type="checkbox" name="seasons" value={key} defaultChecked={p.seasons.includes(key)} /> {key}
                                    </label>
                                  ))}
                                </div>
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                  {AUDIENCE_TAGS.map((key) => (
                                    <label key={`au-${p.id}-${key}`} className="admin-tag-chip">
                                      <input type="checkbox" name="audiences" value={key} defaultChecked={p.audiences.includes(key)} /> {key}
                                    </label>
                                  ))}
                                </div>
                              </div>
                            </details>

                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                              <button className={cx(UI.btn, UI.btnPrimary)} type="submit">{L.update}</button>
                              <Link className={UI.btn} href={buildCatalogPath({ productEditId: p.id, variantProductId: p.id })}>
                                {isAr ? "إدارة" : "Manage"}
                              </Link>
                            </div>
                          </form>

                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
                            <form action="/api/admin/catalog/products" method="post">
                              <input type="hidden" name="return_to" value={returnTo} />
                              <input type="hidden" name="action" value="clone" />
                              <input type="hidden" name="id" value={p.id} />
                              <button className={UI.btn} type="submit">{isAr ? "نسخ" : "Clone"}</button>
                            </form>

                            <form action="/api/admin/catalog/products" method="post">
                              <input type="hidden" name="return_to" value={returnTo} />
                              <input type="hidden" name="action" value="delete" />
                              <input type="hidden" name="id" value={p.id} />
                              <button className={UI.btn} type="submit">{L.del}</button>
                            </form>
                          </div>

                        </td>
                      </tr>
                    ))}
                    {filteredProducts.length === 0 ? (
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

            {/* Images */}
            <section className={UI.card} style={{ marginTop: 14 }}>
              <h2 className={UI.h2} style={{ marginTop: 0 }}>{isAr ? "إدارة الصور" : "Product images"}</h2>
              <p className={UI.muted} style={{ marginTop: -4 }}>
                {isAr ? "استبدل صور المنتج المختار (حد أقصى 5 صور)." : "Replace images for the selected product (max 5 files)."}
              </p>

              <form
                action="/api/admin/catalog/product-images"
                method="post"
                encType="multipart/form-data"
                style={{ display: "grid", gap: 10, gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr) auto", alignItems: "center" }}
              >
                <input type="hidden" name="return_to" value={returnTo} />
                <select name="product_id" className={UI.select} defaultValue={selectedProduct ? String(selectedProduct.id) : ""}>
                  {data.products.map((p) => (
                    <option key={`img-${p.id}`} value={p.id}>
                      {p.slug} — {isAr ? p.name_ar : p.name_en}
                    </option>
                  ))}
                </select>

                <input className={UI.input} type="file" name="images" multiple accept="image/*" required />
                <button className={cx(UI.btn, UI.btnPrimary)} type="submit">{isAr ? "رفع الصور" : "Upload images"}</button>
              </form>
            </section>

            {/* Variants */}
            <section id="variants-section" className={UI.card} style={{ marginTop: 14 }}>
              <h2 className={UI.h2} style={{ marginTop: 0 }}>{isAr ? "إدارة المتغيرات" : "Variant management"}</h2>
              <p className={UI.muted} style={{ marginTop: -4 }}>
                {isAr ? "اختر منتجًا واحدًا لإدارة الأحجام والأسعار بسرعة ووضوح." : "Choose one product to manage sizes and prices with a focused workflow."}
              </p>

              <form method="get" action="/admin/catalog" style={{ display: "grid", gap: 10, marginBottom: 10 }}>
                <div style={{ display: "grid", gap: 8, gridTemplateColumns: "minmax(0,1fr) auto" }}>
                  <select className={UI.select} name="variantProductId" defaultValue={selectedProduct ? String(selectedProduct.id) : ""}>
                    {productsForVariantSection.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.slug} — {isAr ? p.name_ar : p.name_en}
                      </option>
                    ))}
                  </select>
                  <button className={cx(UI.btn, UI.btnPrimary)} type="submit">{isAr ? "عرض المتغيرات" : "Load variants"}</button>
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
                  <div className={UI.card} style={{ marginBottom: 12, background: "rgba(0,0,0,.02)" }}>
                    <strong>{selectedProduct.slug}</strong> — {isAr ? selectedProduct.name_ar : selectedProduct.name_en}
                    <div className={UI.muted} style={{ marginTop: 6 }}>
                      {isAr ? `عدد المتغيرات المطابقة: ${selectedProductVariants.length}` : `Matching variants: ${selectedProductVariants.length}`}
                    </div>
                  </div>

                  <form action="/api/admin/catalog/variants" method="post" style={{ display: "grid", gap: 8 }}>
                    <input type="hidden" name="return_to" value={returnTo} />
                    <input type="hidden" name="action" value="create" />
                    <input type="hidden" name="product_id" value={selectedProduct.id} />

                    <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(8,minmax(0,1fr))", alignItems: "center" }}>
                      <input name="label" required minLength={2} placeholder={isAr ? "الاسم (مثال 50 ml)" : "Label (e.g. 50 ml)"} className={UI.input} />
                      <input name="size_ml" type="number" min="0" placeholder="ml" className={cx(UI.input, UI.ltr)} />
                      <input name="price_jod" type="number" min="0.01" step="0.01" required placeholder="Price" className={cx(UI.input, UI.ltr)} />
                      <input name="compare_at_price_jod" type="number" min="0" step="0.01" placeholder="Compare" className={cx(UI.input, UI.ltr)} />
                      <input name="sort_order" type="number" min="0" defaultValue={selectedProductVariants.length * 10} placeholder="Sort" className={cx(UI.input, UI.ltr)} />

                      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input type="checkbox" name="is_default" /> {isAr ? "افتراضي" : "Default"}
                      </label>

                      <span className={UI.muted} style={{ fontSize: 12 }}>
                        {isAr ? "افتراضي واحد فقط لكل منتج." : "Only one default variant per product."}
                      </span>

                      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input type="checkbox" name="is_active" defaultChecked /> {L.active}
                      </label>
                    </div>

                    <button className={cx(UI.btn, UI.btnPrimary)} type="submit" style={{ width: "fit-content" }}>
                      {isAr ? "إضافة متغير" : "Add variant"}
                    </button>
                  </form>

                  <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                    {selectedProductVariants.map((v) => (
                      <div key={v.id} className={UI.card} style={{ background: "rgba(0,0,0,.02)" }}>
                        <form action="/api/admin/catalog/variants" method="post" style={{ display: "grid", gap: 8 }}>
                          <input type="hidden" name="return_to" value={returnTo} />
                          <input type="hidden" name="action" value="update" />
                          <input type="hidden" name="id" value={v.id} />
                          <input type="hidden" name="product_id" value={selectedProduct.id} />

                          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(8,minmax(0,1fr))", alignItems: "center" }}>
                            <input name="label" required minLength={2} defaultValue={v.label} className={UI.input} />
                            <input name="size_ml" type="number" min="0" defaultValue={v.size_ml ?? ""} className={cx(UI.input, UI.ltr)} />
                            <input name="price_jod" type="number" min="0.01" step="0.01" required defaultValue={Number(v.price_jod || "0")} className={cx(UI.input, UI.ltr)} />
                            <input
                              name="compare_at_price_jod"
                              type="number"
                              min="0"
                              step="0.01"
                              defaultValue={v.compare_at_price_jod ? Number(v.compare_at_price_jod) : ""}
                              className={cx(UI.input, UI.ltr)}
                            />
                            <input name="sort_order" type="number" min="0" defaultValue={v.sort_order} className={cx(UI.input, UI.ltr)} />

                            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <input type="checkbox" name="is_default" defaultChecked={v.is_default} /> {isAr ? "افتراضي" : "Default"}
                            </label>

                            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <input type="checkbox" name="is_active" defaultChecked={v.is_active} /> {L.active}
                            </label>

                            <button className={cx(UI.btn, UI.btnPrimary)} type="submit">{L.update}</button>
                          </div>
                        </form>

                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                          <form action="/api/admin/catalog/variants" method="post">
                            <input type="hidden" name="return_to" value={returnTo} />
                            <input type="hidden" name="action" value="set-default" />
                            <input type="hidden" name="id" value={v.id} />
                            <input type="hidden" name="product_id" value={selectedProduct.id} />
                            <button className={UI.btn} type="submit">{isAr ? "تعيين كافتراضي" : "Set default"}</button>
                          </form>

                          <form action="/api/admin/catalog/variants" method="post">
                            <input type="hidden" name="return_to" value={returnTo} />
                            <input type="hidden" name="action" value="delete" />
                            <input type="hidden" name="id" value={v.id} />
                            <button className={UI.btn} type="submit">{L.del}</button>
                          </form>
                        </div>
                      </div>
                    ))}

                    {selectedProductVariants.length === 0 ? (
                      <p className={UI.muted} style={{ margin: 0 }}>
                        {isAr ? "لا توجد متغيرات لهذا المنتج بعد." : "No variants for this product yet."}
                      </p>
                    ) : null}
                  </div>
                </>
              ) : (
                <p className={UI.muted} style={{ margin: 0 }}>
                  {isAr ? "لا توجد منتجات لإدارة المتغيرات." : "No products available for variant management."}
                </p>
              )}
            </section>

            {/* Promotions (Add/Edit) */}
            <section id="promos-section" className={UI.card} style={{ marginTop: 14 }}>
              <h2 className={UI.h2} style={{ marginTop: 0 }}>{isAr ? "إضافة / تعديل عرض" : "Add / Edit promotion"}</h2>

              {selectedPromo ? (
                <div style={{ marginTop: 10, padding: 10, borderRadius: 12, border: "1px solid rgba(220,38,38,.35)", background: "rgba(220,38,38,.06)", color: "#b91c1c", fontWeight: 700 }}>
                  {isAr ? `تم تحميل عرض موجود للتعديل (ID: ${selectedPromo.id}). سيتم استبدال القيم عند الحفظ.` : `Loaded existing promotion for editing (ID: ${selectedPromo.id}). Saving will overwrite its values.`}
                </div>
              ) : null}

              <form method="get" action="/admin/catalog" style={{ display: "grid", gap: 10, marginTop: 12 }}>
                <div style={{ display: "grid", gap: 8, gridTemplateColumns: "minmax(0,1fr) auto" }}>
                  <select name="promoEditId" className={UI.select} defaultValue={selectedPromo ? String(selectedPromo.id) : "0"}>
                    <option value="0">{isAr ? "عرض جديد" : "New promotion"}</option>
                    {data.promos.map((p) => (
                      <option key={`promo-edit-${p.id}`} value={p.id}>
                        {(isAr ? p.title_ar : p.title_en) || p.code || `PROMO #${p.id}`}
                      </option>
                    ))}
                  </select>
                  <button className={cx(UI.btn, UI.btnPrimary)} type="submit">{isAr ? "تحميل العرض" : "Load promotion"}</button>
                </div>

                <input type="hidden" name="qProducts" value={qProducts} />
                <input type="hidden" name="qVariants" value={qVariants} />
                <input type="hidden" name="qPromos" value={qPromos} />
                <input type="hidden" name="productState" value={productState} />
                <input type="hidden" name="variantState" value={variantState} />
                <input type="hidden" name="promoState" value={promoState} />
                {selectedEditProduct ? <input type="hidden" name="productEditId" value={String(selectedEditProduct.id)} /> : null}
                {selectedProduct ? <input type="hidden" name="variantProductId" value={String(selectedProduct.id)} /> : null}
              </form>

              <form action="/api/admin/catalog/promotions" method="post" style={{ display: "grid", gap: 12, marginTop: 12 }}>
                <input type="hidden" name="return_to" value={returnTo} />
                <input type="hidden" name="action" value={selectedPromo ? "update" : "create"} />
                {selectedPromo ? <input type="hidden" name="id" value={selectedPromo.id} /> : null}

                <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}>
                  <select name="promo_kind" defaultValue={selectedPromo ? normalizePromoKind(selectedPromo.promo_kind) : "CODE"} className={UI.select}>
                    <option value="SEASONAL">{isAr ? "موسمي (خصم تلقائي)" : "Seasonal (automatic discount)"}</option>
                    <option value="CODE">{isAr ? "كود خصم" : "Discount code"}</option>
                  </select>

                  <input name="code" placeholder="NIVRAN10" defaultValue={selectedPromo?.code || ""} className={cx(UI.input, UI.ltr)} />

                  <select name="discount_type" defaultValue={selectedPromo ? String(selectedPromo.discount_type || "PERCENT") : "PERCENT"} className={UI.select}>
                    <option value="PERCENT">{L.percent}</option>
                    <option value="FIXED">{L.fixed}</option>
                  </select>

                  <input
                    name="discount_value"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    placeholder="Discount value"
                    defaultValue={selectedPromo ? Number(selectedPromo.discount_value || 0) : ""}
                    className={cx(UI.input, UI.ltr)}
                  />

                  <input name="usage_limit" type="number" min="1" placeholder="Usage limit" defaultValue={selectedPromo?.usage_limit ?? ""} className={cx(UI.input, UI.ltr)} />
                  <input name="min_order_jod" type="number" min="0" step="0.01" placeholder="Min order (JOD)" defaultValue={selectedPromo?.min_order_jod ?? ""} className={cx(UI.input, UI.ltr)} />

                  <input name="priority" type="number" defaultValue={selectedPromo?.priority ?? 0} placeholder={L.promoPriority} className={cx(UI.input, UI.ltr)} />

                  <input
                    name="product_slugs"
                    placeholder={L.promoProducts}
                    defaultValue={selectedPromo?.product_slugs?.join(", ") || ""}
                    className={cx(UI.input, UI.ltr)}
                    style={{ gridColumn: "1 / -1" }}
                  />

                  <input name="title_en" required placeholder="Promotion title (EN)" defaultValue={selectedPromo?.title_en || ""} className={UI.input} />
                  <input name="title_ar" required placeholder="عنوان العرض (AR)" defaultValue={selectedPromo?.title_ar || ""} className={UI.input} />

                  <input name="starts_at" type="datetime-local" defaultValue={toDatetimeLocalValue(selectedPromo?.starts_at ?? null)} className={cx(UI.input, UI.ltr)} />
                  <input name="ends_at" type="datetime-local" defaultValue={toDatetimeLocalValue(selectedPromo?.ends_at ?? null)} className={cx(UI.input, UI.ltr)} />
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ fontWeight: 700 }}>{L.promoCats}</div>

                  <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="checkbox" name="category_keys" value="__ALL__" defaultChecked={!selectedPromo?.category_keys || selectedPromo.category_keys.length === 0} />
                    {L.allCats}
                  </label>

                  <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                    {data.categories.map((c) => (
                      <label key={c.key} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input type="checkbox" name="category_keys" value={c.key} defaultChecked={!!selectedPromo?.category_keys?.includes(c.key)} />
                        {labelCategory(lang, c)}
                      </label>
                    ))}
                  </div>
                </div>

                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="checkbox" name="is_active" defaultChecked={selectedPromo ? selectedPromo.is_active : true} /> {L.active}
                </label>

                <button className={cx(UI.btn, UI.btnPrimary)} style={{ width: "fit-content" }}>
                  {selectedPromo ? (isAr ? "تحديث العرض" : "Update promotion") : L.savePromo}
                </button>
              </form>
            </section>

            {/* Campaign effectiveness */}
            <section className={UI.card} style={{ marginTop: 14 }}>
              <h2 className={UI.h2} style={{ marginTop: 0 }}>{isAr ? "فعالية الحملات" : "Campaign effectiveness"}</h2>
              <div className={UI.tableWrap} style={{ marginTop: 10 }}>
                <table className={UI.table}>
                  <thead>
                    <tr>
                      <th>{isAr ? "الحملة" : "Campaign"}</th>
                      <th>{isAr ? "الحالة" : "Status"}</th>
                      <th>{isAr ? "التغطية المتوقعة" : "Estimated coverage"}</th>
                      <th>{isAr ? "الاستخدام" : "Usage"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPromos.map((promo) => {
                      const insight = promoInsights.find((x) => x.id === Number(promo.id));
                      return (
                        <tr key={`insight-${promo.id}`}>
                          <td>{(isAr ? promo.title_ar : promo.title_en) || promo.code || "PROMO"}</td>
                          <td>{insight?.status}</td>
                          <td>{insight?.estimatedCoverage || 0} {isAr ? "منتج" : "products"}</td>
                          <td>
                            {promo.used_count || 0}
                            {promo.usage_limit ? ` / ${promo.usage_limit}` : ""}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Promotions list */}
            <section className={UI.card} style={{ marginTop: 14 }}>
              <h2 className={UI.h2} style={{ marginTop: 0 }}>{L.promos}</h2>

              <div style={{ display: "grid", gap: 10 }}>
                {filteredPromos.map((r) => (
                  <div key={r.id} className={UI.card} style={{ background: "rgba(0,0,0,.02)" }}>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
                      <strong className={UI.ltr}>{r.code || "(PROMO)"}</strong>
                      <span className={cx(UI.muted, UI.ltr)}>
                        {r.discount_type === "PERCENT" ? `${r.discount_value}%` : `${r.discount_value} JOD`}
                      </span>
                      <span className={UI.muted}>
                        • {L.promoType}: {normalizePromoKind(r.promo_kind)} • {L.promoPriority}: {r.priority || 0}
                      </span>
                    </div>

                    <div className={UI.muted} style={{ fontSize: 13, marginTop: 6 }}>
                      {isAr ? r.title_ar : r.title_en}
                    </div>

                    <div className={UI.muted} style={{ fontSize: 13, marginTop: 6 }}>
                      {L.promoCats}: {!r.category_keys || r.category_keys.length === 0 ? L.allCats : r.category_keys.join(", ")}
                    </div>

                    <div className={UI.muted} style={{ fontSize: 13, marginTop: 2 }}>
                      {L.promoProducts}: {!r.product_slugs || r.product_slugs.length === 0 ? L.allCats : r.product_slugs.join(", ")}
                    </div>

                    <div className={UI.muted} style={{ fontSize: 13, marginTop: 6 }}>
                      {L.promoUsage}: {r.used_count || 0}
                      {r.usage_limit ? ` / ${r.usage_limit}` : ""} • {L.promoMin}: {r.min_order_jod || "0"} JOD
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                      <Link className={UI.btn} href={buildCatalogPath({ promoEditId: Number(r.id) })}>
                        {isAr ? "تعديل" : "Edit"}
                      </Link>

                      <form action="/api/admin/catalog/promotions" method="post" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <input type="hidden" name="return_to" value={returnTo} />
                        <input type="hidden" name="action" value="toggle" />
                        <input type="hidden" name="id" value={r.id} />
                        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <input type="checkbox" name="is_active" defaultChecked={r.is_active} /> {L.active}
                        </label>
                        <button className={cx(UI.btn, UI.btnPrimary)} type="submit">{L.update}</button>
                      </form>

                      <form action="/api/admin/catalog/promotions" method="post">
                        <input type="hidden" name="return_to" value={returnTo} />
                        <input type="hidden" name="action" value="delete" />
                        <input type="hidden" name="id" value={r.id} />
                        <button className={UI.btn} type="submit">{L.del}</button>
                      </form>
                    </div>
                  </div>
                ))}

                {filteredPromos.length === 0 ? <div className={UI.muted}>{L.noPromos}</div> : null}
              </div>
            </section>

            {/* Categories */}
            <section id="categories-section" className={UI.card} style={{ marginTop: 14 }}>
              <h2 className={UI.h2} style={{ marginTop: 0 }}>{L.addCategory}</h2>

              <form action="/api/admin/catalog/categories" method="post" style={{ display: "grid", gap: 12 }}>
                <input type="hidden" name="return_to" value={returnTo} />
                <input type="hidden" name="action" value="create" />

                <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}>
                  <input name="key" required placeholder="hand-gel" className={cx(UI.input, UI.ltr)} />
                  <input name="sort_order" type="number" defaultValue={100} className={cx(UI.input, UI.ltr)} />
                  <input name="name_en" required placeholder="Name EN" className={UI.input} />
                  <input name="name_ar" required placeholder="الاسم AR" className={UI.input} />
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="checkbox" name="is_active" defaultChecked /> {L.active}
                  </label>
                  <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="checkbox" name="is_promoted" defaultChecked /> Promoted
                  </label>
                </div>

                <button className={cx(UI.btn, UI.btnPrimary)} style={{ width: "fit-content" }}>
                  {L.saveCategory}
                </button>
              </form>

              <form action="/api/admin/catalog/categories" method="post" style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <input type="hidden" name="return_to" value={returnTo} />
                <input type="hidden" name="action" value="normalize-all" />
                <button className={UI.btn} type="submit">
                  {isAr ? "توحيد مفاتيح الفئات (نقرة واحدة)" : "Normalize category keys (one click)"}
                </button>
                <span className={UI.muted} style={{ fontSize: 12 }}>
                  {isAr ? "سيتم دمج hand_gel/hand-gel وغيرها وتحديث المنتجات والعروض." : "Merges hand_gel/hand-gel etc, updates products & promotions."}
                </span>
              </form>

              <h2 className={UI.h2} style={{ marginTop: 16 }}>{L.categories}</h2>

              <div className={UI.tableWrap} style={{ marginTop: 10 }}>
                <table className={UI.table}>
                  <thead>
                    <tr>
                      <th>Key</th>
                      <th>Name EN</th>
                      <th>Name AR</th>
                      <th>Sort</th>
                      <th>{L.active}</th>
                      <th>Promoted</th>
                      <th>{isAr ? "إجراءات" : "Actions"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.categories.map((c) => (
                      <tr key={c.key}>
                        <td className={UI.ltr}>{c.key}</td>
                        <td>{c.name_en}</td>
                        <td>{c.name_ar}</td>
                        <td className={UI.ltr}>{c.sort_order}</td>
                        <td>{c.is_active ? "✓" : "—"}</td>
                        <td>{c.is_promoted ? "✓" : "—"}</td>
                        <td style={{ minWidth: 420 }}>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                            <form action="/api/admin/catalog/categories" method="post" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                              <input type="hidden" name="return_to" value={returnTo} />
                              <input type="hidden" name="action" value="update" />
                              <input type="hidden" name="key" value={c.key} />

                              <input name="name_en" defaultValue={c.name_en} className={UI.input} style={{ width: 160 }} />
                              <input name="name_ar" defaultValue={c.name_ar} className={UI.input} style={{ width: 160 }} />
                              <input name="sort_order" type="number" defaultValue={c.sort_order} className={cx(UI.input, UI.ltr)} style={{ width: 110 }} />

                              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                <input type="checkbox" name="is_active" defaultChecked={c.is_active} /> {L.active}
                              </label>

                              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                <input type="checkbox" name="is_promoted" defaultChecked={c.is_promoted} /> Promoted
                              </label>

                              <button className={cx(UI.btn, UI.btnPrimary)} type="submit">{L.update}</button>
                            </form>

                            <form action="/api/admin/catalog/categories" method="post" style={{ margin: 0 }}>
                              <input type="hidden" name="return_to" value={returnTo} />
                              <input type="hidden" name="action" value="delete" />
                              <input type="hidden" name="key" value={c.key} />
                              <button className={UI.btn} type="submit">{L.del}</button>
                            </form>
                          </div>
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
    </div>
  );
}
