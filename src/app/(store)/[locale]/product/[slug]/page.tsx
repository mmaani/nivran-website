import ProductImageGallery from "./ProductImageGallery";
import ProductPurchasePanel from "./ProductPurchasePanel";
import SafeImg from "@/components/SafeImg";
import { notFound } from "next/navigation";
import { db, isDbConnectivityError } from "@/lib/db";
import { ensureCatalogTablesSafe, isRecoverableCatalogSetupError } from "@/lib/catalog";
import {
  fallbackProductBySlug,
  localizedName,
  syntheticVariantId,
  fallbackCatalogRows,
} from "@/lib/catalogFallback";
import { categoryLabels } from "@/lib/siteContent";
import styles from "./page.module.css";



function shuffle<T>(arr: T[]): T[] {
  const clone = [...arr];
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = clone[i];
    clone[i] = clone[j];
    clone[j] = tmp;
  }
  return clone;
}

type RelatedProductRow = {
  slug: string;
  name_en: string;
  name_ar: string;
  category_key: string;
  min_variant_price_jod: string | null;
  price_jod: string;
  image_id: number | null;
};

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

function promoTimingLabel(locale: "en" | "ar", startsAt: string | null, endsAt: string | null): string {
  const now = Date.now();
  const start = startsAt ? new Date(startsAt).getTime() : null;
  const end = endsAt ? new Date(endsAt).getTime() : null;
  if (start && now < start) return locale === "ar" ? "تبدأ الحملة قريبًا" : "Campaign starts soon";
  if (!end) return locale === "ar" ? "حملة مستمرة" : "Always-on campaign";
  const diffHours = Math.floor((end - now) / (1000 * 60 * 60));
  if (diffHours <= 0) return locale === "ar" ? "تنتهي اليوم" : "Ends today";
  if (diffHours < 24) return locale === "ar" ? `تنتهي خلال ${diffHours} ساعة` : `Ends in ${diffHours}h`;
  const days = Math.ceil(diffHours / 24);
  return locale === "ar" ? `تنتهي خلال ${days} يوم` : `Ends in ${days}d`;
}

function promoBadgeText(locale: "en" | "ar", promoType: "PERCENT" | "FIXED", promoValue: number): string {
  if (promoType === "PERCENT") {
    return locale === "ar" ? `Campaign • وفر ${promoValue}%` : `Campaign • Save ${promoValue}%`;
  }
  return locale === "ar" ? `Campaign • وفر ${promoValue.toFixed(2)} د.أ` : `Campaign • Save ${promoValue.toFixed(2)} JOD`;
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
  promo_ends_at: string | null;
  promo_starts_at: string | null;
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

  const renderFallbackPdp = (reason: string) => {
    const fallback = fallbackProductBySlug(slug);
    if (!fallback) return notFound();

    console.warn(`[pdp] Falling back to static product details due to ${reason}.`);

    const name = localizedName(fallback.name, locale);
    const desc = fallback.description[locale];
    const catLabel = categoryLabels[fallback.category][locale];
    const variants = (fallback.variants || []).map((v, index) => ({
      id: syntheticVariantId(fallback.slug, index),
      label: v.sizeLabel,
      priceJod: Number(v.priceJod || 0),
      compareAtPriceJod: null,
      isDefault: !!v.isDefault,
    }));

    const safeVariants = variants.length
      ? variants
      : [{ id: syntheticVariantId(fallback.slug), label: isAr ? "القياسي" : "Standard", priceJod: Number(fallback.priceJod || 0), compareAtPriceJod: null, isDefault: true }];

    const fallbackSrc = fallback.images?.[0] || fallbackFromSlug(fallback.slug);
    const fallbackRelatedPool = fallbackCatalogRows().filter((item) => item.slug !== fallback.slug);
    const fallbackRelated = shuffle(fallbackRelatedPool).slice(0, 3);

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

        {fallbackRelated.length > 0 ? (
          <section style={{ marginTop: 30 }}>
            <h2 style={{ marginBottom: 10 }}>{isAr ? "منتجات مقترحة" : "Related products"}</h2>
            <div className="grid-3">
              {fallbackRelated.map((r) => {
                const rName = locale === "ar" ? r.name_ar : r.name_en;
                const rPrice = Number(r.min_variant_price_jod || r.price_jod || 0);
                const rImage = fallbackFromSlug(r.slug);
                return (
                  <article key={r.slug} className="panel">
                    <div style={{ position: "relative", width: "100%", aspectRatio: "4 / 3", borderRadius: 12, overflow: "hidden", border: "1px solid #eee", marginBottom: 10 }}>
                      <SafeImg
                        src={rImage}
                        fallbackSrc={fallbackFromSlug(r.slug)}
                        alt={rName}
                        style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                        loading="lazy"
                        sizes="(max-width: 900px) 100vw, 33vw"
                      />
                    </div>
                    <p className="muted" style={{ marginTop: 0 }}>{categoryLabels[r.category_key as keyof typeof categoryLabels]?.[locale] || r.category_key}</p>
                    <h3 style={{ margin: "0 0 .35rem" }}>{rName}</h3>
                    <p style={{ marginTop: 0 }}><strong>{isAr ? `ابتداءً من ${rPrice.toFixed(2)} JOD` : `From ${rPrice.toFixed(2)} JOD`}</strong></p>
                    <a className="btn" href={`/${locale}/product/${r.slug}`}>{isAr ? "عرض المنتج" : "View product"}</a>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>
    );
  };

  try {

  const bootstrap = await ensureCatalogTablesSafe();
  if (!bootstrap.ok) return renderFallbackPdp(bootstrap.reason);

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
            bp.ends_at::text as promo_ends_at,
            bp.starts_at::text as promo_starts_at,
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
         select pr.id, pr.discount_type, pr.discount_value, pr.priority, pr.ends_at, pr.starts_at
         from promotions pr
         where pr.promo_kind in ('AUTO','SEASONAL')
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
    `select id::int as id
       from product_images
      where product_id=$1
      order by "position" asc, id asc`,
    [product.id]
  );

  const variantsRes = await db.query<VariantRow>(
    `select id::int as id, label, price_jod::text as price_jod, compare_at_price_jod::text as compare_at_price_jod, is_default, sort_order
       from product_variants
      where product_id=$1 and is_active=true
      order by is_default desc, sort_order asc, id asc`,
    [product.id]
  );

  const relatedRes = await db.query<RelatedProductRow>(
    `select p.slug,
            p.name_en,
            p.name_ar,
            p.category_key,
            vm.min_variant_price_jod::text as min_variant_price_jod,
            p.price_jod::text as price_jod,
            (
                            select pi.id::int
              from product_images pi
              where pi.product_id=p.id
              order by pi."position" asc, pi.id asc
              limit 1
            ) as image_id
       from products p
       left join lateral (
         select min(v.price_jod) as min_variant_price_jod
         from product_variants v
         where v.product_id=p.id and v.is_active=true
       ) vm on true
      where p.is_active=true and p.slug <> $1
      limit 120`,
    [product.slug]
  );

  const name = isAr ? product.name_ar : product.name_en;
  const desc = isAr ? product.description_ar : product.description_en;
  const catLabel = cat ? (isAr ? cat.name_ar : cat.name_en) : product.category_key;

  const promoType = product.promo_type;
  const promoValue = Number(product.promo_value || 0);
  const hasPromo = promoType === "PERCENT" || promoType === "FIXED";
  const promoTiming = hasPromo ? promoTimingLabel(locale, product.promo_starts_at, product.promo_ends_at) : null;
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

  const relatedPool = relatedRes.rows;
  const sameCategory = shuffle(relatedPool.filter((r) => r.category_key === product.category_key)).slice(0, 2);
  const used = new Set(sameCategory.map((r) => r.slug));
  const differentCategory = shuffle(relatedPool.filter((r) => r.category_key !== product.category_key && !used.has(r.slug))).slice(0, 1);
  for (const row of differentCategory) used.add(row.slug);
  const fill = shuffle(relatedPool.filter((r) => !used.has(r.slug))).slice(0, Math.max(0, 3 - sameCategory.length - differentCategory.length));
  const relatedProducts = [...sameCategory, ...differentCategory, ...fill].slice(0, 3);

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

          {hasPromo && promoType ? (
            <div className="panel" style={{ padding: 12, marginBottom: 12, background: "linear-gradient(130deg,#fff,#fff8ee)", border: "1px solid #f0e1c4" }}>
              <strong>{promoBadgeText(locale, promoType, promoValue)}</strong>
              <p className="muted" style={{ margin: "6px 0 0" }}>{promoTiming}</p>
            </div>
          ) : null}

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

      {relatedProducts.length > 0 ? (
        <section style={{ marginTop: 30 }}>
          <h2 style={{ marginBottom: 10 }}>{isAr ? "منتجات مقترحة" : "Related products"}</h2>
          <div className="grid-3">
            {relatedProducts.map((r) => {
              const rName = isAr ? r.name_ar : r.name_en;
              const rPrice = Number(r.min_variant_price_jod || r.price_jod || 0);
              const rImg = r.image_id ? `/api/catalog/product-image/${r.image_id}` : fallbackFromSlug(r.slug);
              const rFallback = fallbackFromSlug(r.slug);
              const rCategory = categoryLabels[r.category_key as keyof typeof categoryLabels]?.[locale] || r.category_key;

              return (
                <article key={r.slug} className="panel">
                  <div style={{ position: "relative", width: "100%", aspectRatio: "4 / 3", borderRadius: 12, overflow: "hidden", border: "1px solid #eee", marginBottom: 10 }}>
                    <SafeImg
                      src={rImg}
                      fallbackSrc={rFallback}
                      alt={rName}
                      style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                      loading="lazy"
                      sizes="(max-width: 900px) 100vw, 33vw"
                    />
                  </div>
                  <p className="muted" style={{ marginTop: 0 }}>{rCategory}</p>
                  <h3 style={{ margin: "0 0 .35rem" }}>{rName}</h3>
                  <p style={{ marginTop: 0 }}><strong>{isAr ? `ابتداءً من ${rPrice.toFixed(2)} JOD` : `From ${rPrice.toFixed(2)} JOD`}</strong></p>
                  <a className="btn" href={`/${locale}/product/${r.slug}`}>{isAr ? "عرض المنتج" : "View product"}</a>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
  } catch (error: unknown) {
    if (!isDbConnectivityError(error) && !isRecoverableCatalogSetupError(error)) throw error;
    const reason = isDbConnectivityError(error) ? "DB_CONNECTIVITY" : "CATALOG_RECOVERABLE_ERROR";
    return renderFallbackPdp(reason);
  }
}
