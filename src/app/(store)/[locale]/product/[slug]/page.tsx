import ProductImageGallery from "./ProductImageGallery";
import AddToCartButton from "@/components/AddToCartButton";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ensureCatalogTables } from "@/lib/catalog";
import styles from "./page.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fallbackFromSlug(slug: string) {
  const s = String(slug || "").toLowerCase();
  const family = s.includes("noir") ? "noir" : s.includes("bloom") ? "bloom" : "calm";
  return `/products/${family}-1.svg`;
}

function promoBadgeText(locale: "en" | "ar", promoType: "PERCENT" | "FIXED", promoValue: number): string {
  if (promoType === "PERCENT") {
    return locale === "ar" ? `خصم ${promoValue}%` : `-${promoValue}%`;
  }
  return locale === "ar" ? `وفر ${promoValue.toFixed(2)} د.أ` : `Save ${promoValue.toFixed(2)} JOD`;
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
};

type CategoryRow = { key: string; name_en: string; name_ar: string };

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;
  const locale = rawLocale === "ar" ? "ar" : "en";
  const isAr = locale === "ar";

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
            )::text as discounted_price_jod
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

  const name = isAr ? product.name_ar : product.name_en;
  const desc = isAr ? product.description_ar : product.description_en;
  const catLabel = cat ? (isAr ? cat.name_ar : cat.name_en) : product.category_key;

  const price = Number(product.price_jod || 0);
  const compareAt = product.compare_at_price_jod ? Number(product.compare_at_price_jod) : null;
  const discounted = product.discounted_price_jod ? Number(product.discounted_price_jod) : null;
  const promoType = product.promo_type;
  const promoValue = Number(product.promo_value || 0);
  const hasPromo = discounted != null && discounted < price && (promoType === "PERCENT" || promoType === "FIXED");
  const outOfStock = Number(product.inventory_qty || 0) <= 0;

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

          <p style={{ marginTop: 0 }}>
            {hasPromo ? (
              <>
                <span style={{ textDecoration: "line-through", opacity: 0.7, marginInlineEnd: 10 }}>
                  {price.toFixed(2)} JOD
                </span>
                <strong>{discounted.toFixed(2)} JOD</strong>
              </>
            ) : compareAt && compareAt > price ? (
              <>
                <span style={{ textDecoration: "line-through", opacity: 0.7, marginInlineEnd: 10 }}>
                  {compareAt.toFixed(2)} JOD
                </span>
                <strong>{price.toFixed(2)} JOD</strong>
              </>
            ) : (
              <strong>{price.toFixed(2)} JOD</strong>
            )}
          </p>

          {outOfStock ? <p className="muted">{isAr ? "غير متوفر حالياً." : "Currently out of stock."}</p> : null}

          {desc ? <p className="muted">{desc}</p> : null}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14, alignItems: "center" }}>
            <AddToCartButton
              locale={locale}
              slug={product.slug}
              name={name}
              priceJod={hasPromo ? discounted ?? price : price}
              label={outOfStock ? (isAr ? "غير متوفر" : "Out of stock") : (isAr ? "أضف إلى السلة" : "Add to cart")}
              addedLabel={isAr ? "تمت الإضافة ✓" : "Added ✓"}
              updatedLabel={isAr ? "تم التحديث ✓" : "Updated ✓"}
              className={"btn btn-outline" + (outOfStock ? " btn-disabled" : "")}
              disabled={outOfStock}
              minQty={1}
              maxQty={99}
              buyNowLabel={isAr ? "شراء الآن" : "Buy now"}
            />

            <a className="btn btn-outline" href={`/${locale}/product`}>
              {isAr ? "العودة للمتجر" : "Back to shop"}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
