import ProductGridClient from "./ProductGridClient";
import { db, isDbConnectivityError } from "@/lib/db";
import { ensureCatalogTables } from "@/lib/catalog";
import {
  fallbackCatalogRows,
  fallbackCategories,
} from "@/lib/catalogFallback";

type CategoryRow = {
  key: string;
  name_en: string;
  name_ar: string;
  is_active: boolean;
  is_promoted: boolean;
  sort_order: number;
};

type ProductRow = {
  id: number;
  slug: string;
  name_en: string;
  name_ar: string;
  description_en: string | null;
  description_ar: string | null;
  price_jod: string;
  min_variant_price_jod: string | null;
  default_variant_id: number | null;
  default_variant_label: string | null;
  default_variant_price_jod: string | null;
  category_key: string;
  inventory_qty: number;
  image_id: number | null;
  promo_type: "PERCENT" | "FIXED" | null;
  promo_value: string | null;
  discounted_price_jod: string | null;
  wear_times: string[];
  seasons: string[];
  audiences: string[];
};

type CampaignRow = {
  id: number;
  promo_kind: "SEASONAL" | "PROMO" | "REFERRAL" | string;
  title_en: string | null;
  title_ar: string | null;
  discount_type: "PERCENT" | "FIXED" | null;
  discount_value: string | null;
  ends_at: string | null;
  starts_at: string | null;
  min_order_jod: string | null;
  category_keys: string[] | null;
  product_slugs: string[] | null;
};

const FALLBACK_CATS: Record<string, { en: string; ar: string }> = {
  perfume: { en: "Perfume", ar: "عطر" },
  "hand-gel": { en: "Hand Gel", ar: "معقم يدين" },
  cream: { en: "Cream", ar: "كريم" },
  "air-freshener": { en: "Air Freshener", ar: "معطر جو" },
  soap: { en: "Soap", ar: "صابون" },
};

function fallbackFromSlug(slug: string) {
  const s = String(slug || "").toLowerCase();
  const family = s.includes("noir") ? "noir" : s.includes("bloom") ? "bloom" : "calm";
  return `/products/${family}-1.svg`;
}

function toSafeNumber(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}


function tagLabel(locale: "en" | "ar", value: string): string {
  const key = String(value || "").trim().toLowerCase();
  const map: Record<string, { en: string; ar: string }> = {
    day: { en: "Day", ar: "نهاري" },
    night: { en: "Night", ar: "ليلي" },
    anytime: { en: "Anytime", ar: "أي وقت" },
    spring: { en: "Spring", ar: "ربيع" },
    summer: { en: "Summer", ar: "صيف" },
    fall: { en: "Fall", ar: "خريف" },
    winter: { en: "Winter", ar: "شتاء" },
    "all-season": { en: "All-season", ar: "كل المواسم" },
    unisex: { en: "Unisex", ar: "للجنسين" },
    "unisex-men-leaning": { en: "Unisex (Men-leaning)", ar: "للجنسين (يميل للرجال)" },
    "unisex-women-leaning": { en: "Unisex (Women-leaning)", ar: "للجنسين (يميل للنساء)" },
    men: { en: "Men", ar: "رجالي" },
    women: { en: "Women", ar: "نسائي" },
  };
  return (map[key] || { en: value, ar: value })[locale];
}


export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ProductCatalogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = rawLocale === "ar" ? "ar" : "en";
  const isAr = locale === "ar";

  let categoriesRows: CategoryRow[] = [];
  let productRows: ProductRow[] = [];
  let campaignRows: CampaignRow[] = [];

  try {
    await ensureCatalogTables();

    const categoriesRes = await db.query<CategoryRow>(
    `select key, name_en, name_ar, is_active, is_promoted, sort_order
       from categories
      where is_active=true
      order by sort_order asc, key asc`
    );
    categoriesRows = categoriesRes.rows;

    const productsRes = await db.query<ProductRow>(
    `select p.id,
            p.slug,
            p.name_en,
            p.name_ar,
            p.description_en,
            p.description_ar,
            p.price_jod::text as price_jod,
            vm.min_variant_price_jod::text as min_variant_price_jod,
            dv.id as default_variant_id,
            dv.label as default_variant_label,
            dv.price_jod::text as default_variant_price_jod,
            p.category_key,
            p.inventory_qty,
            (
              select pi.id
              from product_images pi
              where pi.product_id=p.id
              order by pi."position" asc, pi.id asc
              limit 1
            ) as image_id,
            bp.discount_type as promo_type,
            bp.discount_value::text as promo_value,
            (
              case
                when bp.id is null then null
                when bp.discount_type='PERCENT' then greatest(0, coalesce(vm.min_variant_price_jod, p.price_jod) - (coalesce(vm.min_variant_price_jod, p.price_jod) * (bp.discount_value / 100)))
                when bp.discount_type='FIXED' then greatest(0, coalesce(vm.min_variant_price_jod, p.price_jod) - bp.discount_value)
                else null
              end
            )::text as discounted_price_jod,
            coalesce(p.wear_times, '{}'::text[]) as wear_times,
            coalesce(p.seasons, '{}'::text[]) as seasons,
            coalesce(p.audiences, '{}'::text[]) as audiences
       from products p
       left join lateral (
         select min(v.price_jod) as min_variant_price_jod
         from product_variants v
         where v.product_id=p.id and v.is_active=true
       ) vm on true
       left join lateral (
         select v.id, v.label, v.price_jod
         from product_variants v
         where v.product_id=p.id and v.is_active=true
         order by v.is_default desc, v.price_jod asc, v.sort_order asc, v.id asc
         limit 1
       ) dv on true
       left join lateral (
         select pr.id, pr.discount_type, pr.discount_value, pr.priority
         from promotions pr
         where pr.promo_kind='SEASONAL'
           and pr.is_active=true
           and (pr.starts_at is null or pr.starts_at <= now())
           and (pr.ends_at is null or pr.ends_at >= now())
           and (pr.category_keys is null or array_length(pr.category_keys, 1) is null or p.category_key = any(pr.category_keys))
           and (pr.product_slugs is null or array_length(pr.product_slugs, 1) is null or p.slug = any(pr.product_slugs))
           and (pr.min_order_jod is null or pr.min_order_jod <= coalesce(vm.min_variant_price_jod, p.price_jod))
         order by pr.priority desc,
                  case
                    when pr.discount_type='PERCENT' then (coalesce(vm.min_variant_price_jod, p.price_jod) * (pr.discount_value / 100))
                    when pr.discount_type='FIXED' then pr.discount_value
                    else 0
                  end desc,
                  pr.created_at desc
         limit 1
       ) bp on true
      where p.is_active=true
      order by p.created_at desc
      limit 500`
    );
    productRows = productsRes.rows;

    const campaignsRes = await db.query<CampaignRow>(
      `select id, promo_kind, title_en, title_ar, discount_type, discount_value::text,
              ends_at::text as ends_at, starts_at::text as starts_at, min_order_jod::text as min_order_jod,
              category_keys, product_slugs
         from promotions
        where is_active=true
          and (starts_at is null or starts_at <= now())
          and (ends_at is null or ends_at >= now())
        order by priority desc, created_at desc
        limit 8`
    );
    campaignRows = campaignsRes.rows;
  } catch (error: unknown) {
    if (!isDbConnectivityError(error)) throw error;

    categoriesRows = fallbackCategories();
    productRows = fallbackCatalogRows();
    campaignRows = [];
    console.warn("[catalog] Falling back to static product catalog due to DB connectivity issue.");
  }

  const catsMap = new Map<string, { key: string; label: string }>();
  const catSource = categoriesRows.length
    ? categoriesRows.map((c) => ({ key: c.key, label: locale === "ar" ? c.name_ar : c.name_en }))
    : Object.entries(FALLBACK_CATS).map(([key, v]) => ({ key, label: v[locale] }));
  for (const cat of catSource) {
    if (!catsMap.has(cat.key)) catsMap.set(cat.key, cat);
  }
  const cats = Array.from(catsMap.values());

  const catLabel = (key: string) => {
    const found = categoriesRows.find((c) => c.key === key);
    if (found) return locale === "ar" ? found.name_ar : found.name_en;
    return (FALLBACK_CATS[key] || { en: key, ar: key })[locale];
  };



  const campaignCards = campaignRows.map((c) => ({
    discountValue: toSafeNumber(c.discount_value),
    minOrderJod: toSafeNumber(c.min_order_jod),
    ...c,
  })).filter((c) => String(c.promo_kind || "PROMO").toUpperCase() === "SEASONAL").map((c) => ({
    id: c.id,
    title: (isAr ? c.title_ar : c.title_en) || (isAr ? "عرض خاص" : "Special campaign"),
    badge: c.discount_type === "PERCENT"
      ? (isAr ? `وفر ${c.discountValue}%` : `Save ${c.discountValue}%`)
      : (isAr ? `وفر ${c.discountValue.toFixed(2)} د.أ` : `Save ${c.discountValue.toFixed(2)} JOD`),
    endsAt: c.ends_at,
    minOrderJod: c.minOrderJod,
  }));

  const productCards = productRows.map((p) => {
    const name = isAr ? p.name_ar : p.name_en;
    const desc = (isAr ? p.description_ar : p.description_en) || "";
    const baseFromPrice = Number(p.min_variant_price_jod || p.price_jod || 0);
    const defaultVariantId = typeof p.default_variant_id === "number" && Number.isFinite(p.default_variant_id) ? p.default_variant_id : null;
    const defaultVariantLabel = p.default_variant_label ? String(p.default_variant_label) : "";
    const defaultVariantPrice = Number(p.default_variant_price_jod || p.price_jod || 0);
    const discounted = p.discounted_price_jod != null ? Number(p.discounted_price_jod) : null;
    const promoValue = Number(p.promo_value || 0);
    const hasPromo = discounted != null && discounted < baseFromPrice;

    const apiSrc = p.image_id ? `/api/catalog/product-image/${p.image_id}` : "";
    const fallbackSrc = fallbackFromSlug(p.slug);

    const tags = Array.from(new Set([...p.wear_times, ...p.seasons, ...p.audiences]))
      .map((chip) => tagLabel(locale, chip))
      .filter((chip) => chip.trim().length > 0);

    return {
      slug: p.slug,
      name,
      description: desc,
      categoryKey: p.category_key,
      categoryLabel: catLabel(p.category_key),
      inventoryQty: Number(p.inventory_qty || 0),
      fromPrice: baseFromPrice,
      defaultVariantId,
      defaultVariantLabel,
      defaultVariantPrice,
      hasPromo,
      promoType: p.promo_type,
      promoValue,
      discountedPrice: discounted,
      imageSrc: apiSrc || fallbackSrc,
      fallbackSrc,
      tags,
    };
  });

  return (
    <div style={{ padding: "1.2rem 0" }}>
      <h1 className="title">{isAr ? "المتجر" : "Shop"}</h1>
      <p className="lead" style={{ marginTop: 0 }}>
        {isAr
          ? "تصفح منتجات نيفـران عبر فئات متعددة — العطور أولاً ثم التوسع لفئات العناية الشخصية والمنزلية."
          : "Browse NIVRAN products across multiple categories — perfume-first, with expansion into personal & home care."}
      </p>

      <div className="badge-row" style={{ marginBottom: ".8rem" }}>
        {cats.map((c) => (
          <span key={c.key} className="badge">
            {c.label}
          </span>
        ))}
      </div>

      <ProductGridClient
        locale={locale}
        categories={cats}
        products={productCards}
        campaigns={campaignCards}
      />

      {productRows.length === 0 ? (
        <p className="muted" style={{ marginTop: 14 }}>
          {isAr ? "لا توجد منتجات بعد. أضف المنتجات من لوحة الإدارة." : "No products yet. Add products from Admin."}
        </p>
      ) : null}
    </div>
  );
}
