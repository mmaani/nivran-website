import ProductImageGallery from "./ProductImageGallery";
import ProductPurchasePanel from "./ProductPurchasePanel";
import { notFound } from "next/navigation";
import { db, isDbConnectivityError } from "@/lib/db";
import { ensureCatalogTables } from "@/lib/catalog";
import { categoryLabels, products as staticProducts } from "@/lib/siteContent";
import styles from "./page.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fallbackFromSlug(slug: string) {
  const s = String(slug || "").toLowerCase();
  const family = s.includes("noir") ? "noir" : s.includes("bloom") ? "bloom" : "calm";
  return `/products/${family}-1.svg`;
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

function promoBadgeText(locale: "en" | "ar", promoType: "PERCENT" | "FIXED", promoValue: number): string {
  if (promoType === "PERCENT") {
    return locale === "ar" ? `AUTO • وفر ${promoValue}%` : `AUTO • Save ${promoValue}%`;
  }
  return locale === "ar" ? `AUTO • وفر ${promoValue.toFixed(2)} د.أ` : `AUTO • Save ${promoValue.toFixed(2)} JOD`;
}

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
  promo_type: "PERCENT" | "FIXED" | null;
  promo_value: string | null;
  discounted_price_jod: string | null;
  wear_times: string[];
  seasons: string[];
  audiences: string[];
};

type CategoryRow = { key: string; name_en: string; name_ar: string };

type VariantRow = {
  id: number;
  label: string;
  price_jod: string;
  compare_at_price_jod: string | null;
  is_default: boolean;
  sort_order: number;
};

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;
  const locale = rawLocale === "ar" ? "ar" : "en";
  const isAr = locale === "ar";

  try {

  await ensureCatalogTables();

  const pr = await db.query<ProductRow>(
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
            bp.discount_type as promo_type,
            bp.discount_value::text as promo_value,
            (
              case
                when bp.id is null then null
                when bp.discount_type='PERCENT' then greatest(0, p.price_jod - (p.price_jod * (bp.discount_value / 100)))
                when bp.discount_type='FIXED' then greatest(0, p.price_jod - bp.discount_value)
                else null
              end
            )::text as discounted_price_jod,
            coalesce(p.wear_times, '{}'::text[]) as wear_times,
            coalesce(p.seasons, '{}'::text[]) as seasons,
            coalesce(p.audiences, '{}'::text[]) as audiences
       from products p
       left join lateral (
         select pr.id, pr.discount_type, pr.discount_value, pr.priority
         from promotions pr
         where pr.promo_kind='AUTO'
           and pr.is_active=true
           and (pr.starts_at is null or pr.starts_at <= now())
           and (pr.ends_at is null or pr.ends_at >= now())
           and (pr.category_keys is null or array_length(pr.category_keys, 1) is null or p.category_key = any(pr.category_keys))
           and (pr.product_slugs is null or array_length(pr.product_slugs, 1) is null or p.slug = any(pr.product_slugs))
           and (pr.min_order_jod is null or pr.min_order_jod <= p.price_jod)
         order by pr.priority desc,
                  case
                    when pr.discount_type='PERCENT' then (p.price_jod * (pr.discount_value / 100))
                    when pr.discount_type='FIXED' then pr.discount_value
                    else 0
                  end desc,
                  pr.created_at desc
         limit 1
       ) bp on true
      where p.slug=$1
      limit 1`,
    [slug]
  );

  const product = pr.rows[0];
  if (!product || !product.is_active) return notFound();

  const cr = await db.query<CategoryRow>(
    `select key, name_en, name_ar
       from categories
      where key=$1
      limit 1`,
    [product.category_key]
  );
  const cat = cr.rows[0];

  const imgs = await db.query<{ id: number }>(
    `select id
       from product_images
      where product_id=$1
      order by "position" asc, id asc`,
    [product.id]
  );

  const variantsRes = await db.query<VariantRow>(
    `select id, label, price_jod::text as price_jod, compare_at_price_jod::text as compare_at_price_jod, is_default, sort_order
       from product_variants
      where product_id=$1 and is_active=true
      order by is_default desc, sort_order asc, id asc`,
    [product.id]
  );

  const name = isAr ? product.name_ar : product.name_en;
  const desc = isAr ? product.description_ar : product.description_en;
  const catLabel = cat ? (isAr ? cat.name_ar : cat.name_en) : product.category_key;

  const promoType = product.promo_type;
  const promoValue = Number(product.promo_value || 0);
  const hasPromo = promoType === "PERCENT" || promoType === "FIXED";
  const outOfStock = Number(product.inventory_qty || 0) <= 0;

  const variants = variantsRes.rows.length
    ? variantsRes.rows.map((v) => ({
        id: v.id,
        label: v.label,
        priceJod: Number(v.price_jod || 0),
        compareAtPriceJod: v.compare_at_price_jod ? Number(v.compare_at_price_jod) : null,
        isDefault: v.is_default,
      }))
    : [{
        id: 0,
        label: isAr ? "القياسي" : "Standard",
        priceJod: Number(product.price_jod || 0),
        compareAtPriceJod: product.compare_at_price_jod ? Number(product.compare_at_price_jod) : null,
        isDefault: true,
      }];

  const imageUrls = imgs.rows.map((img) => `/api/catalog/product-image/${img.id}`);
  const fallbackSrc = fallbackFromSlug(product.slug);

  return (
    <div style={{ padding: "1.2rem 0" }}>
      <p className="muted" style={{ marginTop: 0 }}>
        {catLabel}
      </p>

      <div className={styles.grid2} style={{ alignItems: "start" }}>
        <div style={{ position: "relative" }}>
          <ProductImageGallery name={name} images={imageUrls} fallbackSrc={fallbackSrc} />
          {hasPromo ? (
            <div
              style={{
                position: "absolute",
                top: 12,
                insetInlineStart: 12,
                background: "linear-gradient(135deg, #141414, #2a2622)",
                color: "#fff",
                fontSize: 12,
                fontWeight: 700,
                padding: "6px 10px",
                borderRadius: 999,
                zIndex: 3,
              }}
            >
              {promoBadgeText(locale, promoType, promoValue)}
            </div>
          ) : null}
        </div>

        <div>
          <h1 className="title" style={{ marginTop: 0 }}>
            {name}
          </h1>

          {outOfStock ? <p className="muted">{isAr ? "غير متوفر حالياً." : "Currently out of stock."}</p> : null}

          {desc ? <p className="muted">{desc}</p> : null}

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
            {[...product.wear_times, ...product.seasons, ...product.audiences].map((chip) => (
              <span key={`${product.slug}-${chip}`} className="badge" style={{ fontSize: 11 }}>{tagLabel(locale, chip)}</span>
            ))}
          </div>

          <ProductPurchasePanel
            locale={locale}
            slug={product.slug}
            name={name}
            variants={variants}
            promoType={promoType}
            promoValue={promoValue}
            outOfStock={outOfStock}
          />
        </div>
      </div>
    </div>
  );
  } catch (error: unknown) {
    if (!isDbConnectivityError(error)) throw error;

    const fallback = staticProducts.find((p) => p.slug === slug);
    if (!fallback) return notFound();

    const name = fallback.name[locale];
    const desc = fallback.description[locale];
    const catLabel = categoryLabels[fallback.category][locale];
    const variants = (fallback.variants || []).map((v, index) => ({
      id: 20000 + index,
      label: v.sizeLabel,
      priceJod: Number(v.priceJod || 0),
      compareAtPriceJod: null,
      isDefault: !!v.isDefault,
    }));

    const safeVariants = variants.length
      ? variants
      : [{ id: 20000, label: isAr ? "القياسي" : "Standard", priceJod: Number(fallback.priceJod || 0), compareAtPriceJod: null, isDefault: true }];

    const fallbackSrc = fallback.images?.[0] || fallbackFromSlug(fallback.slug);

    return (
      <div style={{ padding: "1.2rem 0" }}>
        <p className="muted" style={{ marginTop: 0 }}>{catLabel}</p>

        <div className={styles.grid2} style={{ alignItems: "start" }}>
          <div style={{ position: "relative" }}>
            <ProductImageGallery name={name} images={[fallbackSrc]} fallbackSrc={fallbackSrc} />
          </div>

          <div>
            <h1 className="title" style={{ marginTop: 0 }}>{name}</h1>
            {desc ? <p className="muted">{desc}</p> : null}

            <ProductPurchasePanel
              locale={locale}
              slug={fallback.slug}
              name={name}
              variants={safeVariants}
              promoType={null}
              promoValue={0}
              outOfStock={false}
            />
          </div>
        </div>
      </div>
    );
  }
}
