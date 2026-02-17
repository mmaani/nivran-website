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
  from_price_jod: string;
  default_variant_id: number | null;
  default_variant_label: string | null;
  category_key: string;
  inventory_qty: number;
  wear_times: string[] | null;
  seasons: string[] | null;
  audiences: string[] | null;
  image_id: number | null;
  promo_type: "PERCENT" | "FIXED" | null;
  promo_value: string | null;
  discounted_price_jod: string | null;
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

function promoBadgeText(locale: "en" | "ar", promoType: string | null, promoValue: number): string {
  if (promoType === "PERCENT") {
    return locale === "ar" ? `وفّر ${promoValue}%` : `Save ${promoValue}%`;
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
            v.from_price_jod::text as from_price_jod,
            v.default_variant_id,
            v.default_variant_label,
            p.category_key,
            p.inventory_qty,
            t.wear_times,
            t.seasons,
            t.audiences,
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
                when bp.discount_type='PERCENT' then greatest(0, v.from_price_jod - (v.from_price_jod * (bp.discount_value / 100)))
                when bp.discount_type='FIXED' then greatest(0, v.from_price_jod - bp.discount_value)
                else null
              end
            )::text as discounted_price_jod
       from products p
       left join lateral (
         select
           min(v2.price_jod) filter (where v2.is_active=true) as from_price_jod,
           (array_agg(v2.id order by v2.is_default desc, v2.sort_order asc, v2.price_jod asc, v2.id asc))[1] as default_variant_id,
           (array_agg(v2.label order by v2.is_default desc, v2.sort_order asc, v2.price_jod asc, v2.id asc))[1] as default_variant_label
         from product_variants v2
         where v2.product_id=p.id and v2.is_active=true
       ) v on true
       left join product_tags t on t.product_id=p.id
       left join lateral (
         select pr.id, pr.discount_type, pr.discount_value, pr.priority
         from promotions pr
         where pr.promo_kind='AUTO'
           and pr.is_active=true
           and (pr.starts_at is null or pr.starts_at <= now())
           and (pr.ends_at is null or pr.ends_at >= now())
           and (pr.category_keys is null or array_length(pr.category_keys, 1) is null or p.category_key = any(pr.category_keys))
           and (pr.product_slugs is null or array_length(pr.product_slugs, 1) is null or p.slug = any(pr.product_slugs))
           and (pr.min_order_jod is null or pr.min_order_jod <= v.from_price_jod)
         order by pr.priority desc,
                  case
                    when pr.discount_type='PERCENT' then (v.from_price_jod * (pr.discount_value / 100))
                    when pr.discount_type='FIXED' then pr.discount_value
                    else 0
                  end desc,
                  pr.created_at desc
         limit 1
       ) bp on true
      where p.is_active=true and v.from_price_jod is not null
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
          const price = Number(p.from_price_jod || 0);
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


              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                {([...(p.wear_times || []), ...(p.seasons || []), ...(p.audiences || [])].slice(0, 2)).map((tag) => (
                  <span key={`${p.slug}-${tag}`} className="badge" style={{ fontSize: 11, padding: "2px 8px" }}>{tag}</span>
                ))}
              </div>
              <p>
                {hasPromo ? (
                  <>
                    <span style={{ textDecoration: "line-through", opacity: 0.7, marginInlineEnd: 8 }}>
                      {price.toFixed(2)} JOD
                    </span>
                    <strong>{discounted.toFixed(2)} JOD</strong>
                  </>
                ) : (
                  <strong>{isAr ? "من" : "From"} {price.toFixed(2)} JOD</strong>
                )}
              </p>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                <a className="btn" href={`/${locale}/product/${p.slug}`}>
                  {isAr ? "عرض المنتج" : "View product"}
                </a>

                <AddToCartButton
                  locale={locale}
                  slug={p.slug}
                  variantId={p.default_variant_id}
                  variantLabel={p.default_variant_label || ""}
                  name={name}
                  priceJod={price}
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
