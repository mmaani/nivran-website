import SafeImg from "@/components/SafeImg";
import AddToCartButton from "@/components/AddToCartButton";
import { db } from "@/lib/db";
import { ensureCatalogTables } from "@/lib/catalog";

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

function promoBadgeText(locale: "en" | "ar", promoType: string | null, promoValue: number): string {
  if (promoType === "PERCENT") {
    return locale === "ar" ? `خصم ${promoValue}%` : `-${promoValue}%`;
  }
  return locale === "ar" ? `وفر ${promoValue.toFixed(2)} د.أ` : `Save ${promoValue.toFixed(2)} JOD`;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ProductCatalogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = rawLocale === "ar" ? "ar" : "en";
  const isAr = locale === "ar";

  await ensureCatalogTables();

  const categoriesRes = await db.query<CategoryRow>(
    `select key, name_en, name_ar, is_active, is_promoted, sort_order
       from categories
      where is_active=true
      order by sort_order asc, key asc`
  );

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
            coalesce(p.wear_times, "{}"::text[]) as wear_times,
            coalesce(p.seasons, "{}"::text[]) as seasons,
            coalesce(p.audiences, "{}"::text[]) as audiences
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
         where pr.promo_kind='AUTO'
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

  const cats: Array<{ key: string; label: string }> = categoriesRes.rows.length
    ? categoriesRes.rows.map((c) => ({ key: c.key, label: locale === "ar" ? c.name_ar : c.name_en }))
    : Object.entries(FALLBACK_CATS).map(([key, v]) => ({ key, label: v[locale] }));

  const catLabel = (key: string) => {
    const found = categoriesRes.rows.find((c) => c.key === key);
    if (found) return locale === "ar" ? found.name_ar : found.name_en;
    return (FALLBACK_CATS[key] || { en: key, ar: key })[locale];
  };

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

      <div className="grid-3">
        {productsRes.rows.map((p) => {
          const name = isAr ? p.name_ar : p.name_en;
          const desc = isAr ? p.description_ar : p.description_en;
          const baseFromPrice = Number(p.min_variant_price_jod || p.price_jod || 0);
          const price = baseFromPrice;
          const defaultVariantId = typeof p.default_variant_id === "number" && Number.isFinite(p.default_variant_id) ? p.default_variant_id : null;
          const defaultVariantLabel = p.default_variant_label ? String(p.default_variant_label) : "";
          const defaultVariantPrice = Number(p.default_variant_price_jod || p.price_jod || 0);
          const discounted = p.discounted_price_jod != null ? Number(p.discounted_price_jod) : null;
          const promoValue = Number(p.promo_value || 0);
          const hasPromo = discounted != null && discounted < price;
          const outOfStock = Number(p.inventory_qty || 0) <= 0;

          const apiSrc = p.image_id ? `/api/catalog/product-image/${p.image_id}` : "";
          const fallbackSrc = fallbackFromSlug(p.slug);
          const imgSrc = apiSrc || fallbackSrc;

          return (
            <article key={p.slug} className="panel">
              <p className="muted" style={{ marginTop: 0 }}>
                {catLabel(p.category_key)}
                {outOfStock ? (isAr ? " · غير متوفر" : " · Out of stock") : ""}
              </p>

              <div
                style={{
                  position: "relative",
                  width: "100%",
                  aspectRatio: "4 / 3",
                  overflow: "hidden",
                  borderRadius: 14,
                  marginBottom: 10,
                  background: "#f7f7f8",
                  border: "1px solid #eee",
                }}
              >
                <SafeImg
                  src={imgSrc}
                  fallbackSrc={fallbackSrc}
                  alt={name}
                  style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                  loading="lazy"
                />
                {hasPromo ? (
                  <div
                    style={{
                      position: "absolute",
                      top: 10,
                      insetInlineStart: 10,
                      background: "linear-gradient(135deg, #141414, #2a2622)",
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 700,
                      padding: "6px 10px",
                      borderRadius: 999,
                    }}
                  >
                    {promoBadgeText(locale, p.promo_type, promoValue)}
                  </div>
                ) : null}
              </div>

              <h3 style={{ margin: "0 0 .35rem" }}>{name}</h3>
              {desc ? <p className="muted">{desc}</p> : null}

              <p>
                {hasPromo ? (
                  <>
                    <span style={{ textDecoration: "line-through", opacity: 0.7, marginInlineEnd: 8 }}>
                      {price.toFixed(2)} JOD
                    </span>
                    <strong>{discounted.toFixed(2)} JOD</strong>
                  </>
                ) : (
                  <strong>{isAr ? `ابتداءً من ${price.toFixed(2)} JOD` : `From ${price.toFixed(2)} JOD`}</strong>
                )}
              </p>

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                {[...p.wear_times, ...p.seasons, ...p.audiences].slice(0, 2).map((chip) => (
                  <span key={`${p.slug}-${chip}`} className="badge" style={{ fontSize: 11, padding: "2px 8px" }}>{tagLabel(locale, chip)}</span>
                ))}
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                <a className="btn" href={`/${locale}/product/${p.slug}`}>
                  {isAr ? "عرض المنتج" : "View product"}
                </a>

                <AddToCartButton
                  locale={locale}
                  slug={p.slug}
                  name={name}
                  variantId={defaultVariantId}
                  variantLabel={defaultVariantLabel}
                  priceJod={defaultVariantPrice}
                  label={outOfStock ? (isAr ? "غير متوفر" : "Out of stock") : (isAr ? "أضف إلى السلة" : "Add to cart")}
                  addedLabel={isAr ? "تمت الإضافة ✓" : "Added ✓"}
                  updatedLabel={isAr ? "تم التحديث ✓" : "Updated ✓"}
                  className={"btn btn-outline" + (outOfStock ? " btn-disabled" : "")}
                  disabled={outOfStock}
                />
              </div>
            </article>
          );
        })}
      </div>

      {productsRes.rows.length === 0 ? (
        <p className="muted" style={{ marginTop: 14 }}>
          {isAr ? "لا توجد منتجات بعد. أضف المنتجات من لوحة الإدارة." : "No products yet. Add products from Admin."}
        </p>
      ) : null}
    </div>
  );
}
